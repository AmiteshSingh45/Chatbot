"""
Chat API — SSE streaming endpoint + HITL approval + stop generation.
This is the primary chat interface (replaces WebSocket for simpler frontend integration).

Endpoints:
  POST /api/v1/chat/stream   ← Server-Sent Events streaming (main chat)
  POST /api/v1/chat          ← Non-streaming JSON response
  POST /api/v1/chat/approve  ← Resume interrupted HITL graph with approval
  POST /api/v1/chat/reject   ← Resume interrupted HITL graph with rejection
"""
import asyncio
import json
import time
import uuid
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.logging import get_logger
from app.db.session import get_db
from app.graph.graph import get_compiled_graph
from app.models.user import User
from app.repositories.user_repo import ConversationRepository, MessageRepository

logger = get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# In-memory stop signals: thread_id → asyncio.Event
_stop_signals: dict[str, asyncio.Event] = {}


class ChatRequest(BaseModel):
    thread_id: str
    content: str
    file_ids: list[str] = []
    model: Optional[str] = None


class HITLDecision(BaseModel):
    thread_id: str
    decision: str  # "approved" | "rejected"
    reason: Optional[str] = None


@router.post("/stream")
async def stream_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    SSE streaming chat endpoint.
    Streams: agent_step events, token events, done event.

    Frontend connects via EventSource or fetch with ReadableStream.

    SSE event format:
      data: {"type": "agent_step", "step": {...}}
      data: {"type": "token", "content": "hello "}
      data: {"type": "hitl", "action": "...", "args": {...}}
      data: {"type": "done", "metadata": {...}}
      data: {"type": "error", "message": "..."}
    """
    user_id = str(current_user.id)
    thread_id = req.thread_id

    # Validate conversation belongs to user
    conv_repo = ConversationRepository(db)
    conversation = await conv_repo.get_by_thread_id(thread_id)
    if not conversation or str(conversation.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    msg_repo = MessageRepository(db)
    await msg_repo.create(
        conversation_id=conversation.id,
        role="user",
        content=req.content,
    )

    # Build message history
    recent = await msg_repo.get_latest_messages(conversation.id, count=20)
    lc_messages = []
    for m in recent[:-1]:
        if m.role == "user":
            lc_messages.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            lc_messages.append(AIMessage(content=m.content))
    lc_messages.append(HumanMessage(content=req.content))

    # Initial state
    initial_state = {
        "messages": lc_messages,
        "thread_id": thread_id,
        "user_id": user_id,
        "route": None,
        "memory_context": None,
        "execution_plan": None,
        "active_tools": [],
        "requires_human": False,
        "human_approval": None,
        "hitl_action": None,
        "hitl_args": None,
        "reflection_score": None,
        "reflection_feedback": None,
        "reflection_done": False,
        "context": None,
        "retrieved_docs": [],
        "uploaded_file_ids": req.file_ids,
        "tool_results": [],
        "web_search_results": [],
        "final_response": None,
        "citations": [],
        "agent_steps": [],
        "error": None,
        "retry_count": 0,
        "metadata": {"model": req.model or conversation.model},
    }

    # Reset stop signal
    stop_event = asyncio.Event()
    _stop_signals[thread_id] = stop_event

    async def event_generator() -> AsyncGenerator[str, None]:
        start_time = time.time()
        full_response = ""
        agent_used = "general_chat"
        final_citations = []
        final_steps = []

        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        try:
            graph = await get_compiled_graph()
            config = {"configurable": {"thread_id": thread_id}}

            seen_steps: set[str] = set()

            async for event in graph.astream_events(
                initial_state, config=config, version="v2"
            ):
                if stop_event.is_set():
                    yield sse({"type": "stopped"})
                    return

                kind = event.get("event", "")
                node_name = event.get("name", "")
                data = event.get("data", {})

                # ── Stream LLM tokens ──────────────────────────────────────
                if kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        full_response += chunk.content
                        yield sse({"type": "token", "content": chunk.content})

                # ── Agent steps ────────────────────────────────────────────
                elif kind == "on_chain_end":
                    output = data.get("output", {})
                    if isinstance(output, dict):
                        # Emit new agent steps
                        steps = output.get("agent_steps", [])
                        for step in steps:
                            step_key = f"{step.get('step')}_{step.get('status')}"
                            if step_key not in seen_steps:
                                seen_steps.add(step_key)
                                yield sse({"type": "agent_step", "step": step})

                        # Capture metadata
                        if output.get("metadata"):
                            agent_used = output["metadata"].get("agent_used", agent_used)

                        if output.get("citations"):
                            final_citations = output["citations"]

                        # HITL interrupt
                        if output.get("requires_human"):
                            yield sse({
                                "type": "hitl",
                                "action": output.get("hitl_action", "Unknown action"),
                                "args": output.get("hitl_args", {}),
                                "thread_id": thread_id,
                            })
                            # Graph is now interrupted — don't stream done yet
                            return

            # ── Save assistant response ────────────────────────────────────
            latency_ms = round((time.time() - start_time) * 1000, 1)
            if full_response:
                await _save_assistant_message(
                    thread_id=thread_id,
                    user_id=user_id,
                    content=full_response,
                    agent_used=agent_used,
                    citations=final_citations,
                    agent_steps=final_steps,
                    latency_ms=latency_ms,
                )

                # Auto-title on first exchange
                if len(recent) <= 1:
                    title = req.content[:60] + ("..." if len(req.content) > 60 else "")
                    await conv_repo.update(conversation, title=title)
                    await db.commit()

            yield sse({
                "type": "done",
                "metadata": {
                    "agent_used": agent_used,
                    "latency_ms": latency_ms,
                    "citations": final_citations,
                    "thread_id": thread_id,
                },
            })

        except Exception as e:
            logger.error("chat.stream_error", error=str(e), thread_id=thread_id)
            yield sse({"type": "error", "message": "An error occurred. Please try again."})
        finally:
            _stop_signals.pop(thread_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/approve")
async def hitl_approve(
    req: HITLDecision,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Resume an interrupted HITL graph with approval.
    The graph was paused at hitl_check node — this resumes it.
    Returns SSE stream of the resumed execution.
    """
    user_id = str(current_user.id)

    async def resume_generator() -> AsyncGenerator[str, None]:
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        try:
            graph = await get_compiled_graph()
            config = {"configurable": {"thread_id": req.thread_id}}

            # Update state with approval
            await graph.aupdate_state(
                config,
                {
                    "human_approval": req.decision,
                    "requires_human": False,
                },
            )

            # Resume graph execution
            full_response = ""
            async for event in graph.astream_events(None, config=config, version="v2"):
                kind = event.get("event", "")
                data = event.get("data", {})

                if kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        full_response += chunk.content
                        yield sse({"type": "token", "content": chunk.content})

                elif kind == "on_chain_end":
                    output = data.get("output", {})
                    if isinstance(output, dict):
                        for step in output.get("agent_steps", []):
                            yield sse({"type": "agent_step", "step": step})

            if full_response:
                await _save_assistant_message(
                    thread_id=req.thread_id,
                    user_id=user_id,
                    content=full_response,
                    agent_used="hitl_resumed",
                    latency_ms=0,
                )

            yield sse({"type": "done", "metadata": {"hitl_decision": req.decision}})

        except Exception as e:
            logger.error("chat.hitl_resume_error", error=str(e))
            yield sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        resume_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/stop")
async def stop_generation(
    thread_id: str,
    current_user: User = Depends(get_current_user),
):
    """Signal the streaming generator to stop early."""
    signal = _stop_signals.get(thread_id)
    if signal:
        signal.set()
    return {"status": "stop_requested"}


@router.post("")
async def chat_sync(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Non-streaming chat endpoint (for simple clients)."""
    user_id = str(current_user.id)

    conv_repo = ConversationRepository(db)
    conversation = await conv_repo.get_by_thread_id(req.thread_id)
    if not conversation or str(conversation.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_repo = MessageRepository(db)
    await msg_repo.create(conversation_id=conversation.id, role="user", content=req.content)
    recent = await msg_repo.get_latest_messages(conversation.id, count=20)

    lc_messages = []
    for m in recent[:-1]:
        if m.role == "user":
            lc_messages.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            lc_messages.append(AIMessage(content=m.content))
    lc_messages.append(HumanMessage(content=req.content))

    initial_state = {
        "messages": lc_messages,
        "thread_id": req.thread_id,
        "user_id": user_id,
        "route": None,
        "memory_context": None,
        "execution_plan": None,
        "active_tools": [],
        "requires_human": False,
        "human_approval": None,
        "hitl_action": None,
        "hitl_args": None,
        "reflection_score": None,
        "reflection_feedback": None,
        "reflection_done": False,
        "context": None,
        "retrieved_docs": [],
        "uploaded_file_ids": req.file_ids,
        "tool_results": [],
        "web_search_results": [],
        "final_response": None,
        "citations": [],
        "agent_steps": [],
        "error": None,
        "retry_count": 0,
        "metadata": {"model": req.model},
    }

    graph = await get_compiled_graph()
    config = {"configurable": {"thread_id": req.thread_id}}
    result = await graph.ainvoke(initial_state, config=config)

    return {
        "response": result.get("final_response", ""),
        "agent_used": (result.get("metadata") or {}).get("agent_used", "general_chat"),
        "citations": result.get("citations", []),
        "agent_steps": result.get("agent_steps", []),
        "requires_human": result.get("requires_human", False),
    }


async def _save_assistant_message(
    thread_id: str,
    user_id: str,
    content: str,
    agent_used: str = "general_chat",
    citations: Optional[list] = None,
    agent_steps: Optional[list] = None,
    latency_ms: float = 0,
) -> None:
    """Save assistant message to DB asynchronously."""
    try:
        from app.db.session import AsyncSessionFactory
        async with AsyncSessionFactory() as db:
            conv_repo = ConversationRepository(db)
            conversation = await conv_repo.get_by_thread_id(thread_id)
            if not conversation:
                return

            msg_repo = MessageRepository(db)
            await msg_repo.create(
                conversation_id=conversation.id,
                role="assistant",
                content=content,
                agent_used=agent_used,
                metadata=json.dumps({"latency_ms": latency_ms}),
                citations=json.dumps(citations or []),
                agent_steps=json.dumps(agent_steps or []),
            )
            await db.commit()
    except Exception as e:
        logger.error("chat.save_message_error", error=str(e))

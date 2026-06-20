"""
Guest Chat API — works without authentication.
Uses X-Session-ID header as the guest identity.
Full SSE streaming + sync fallback.
"""
import json
import time
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Header, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# In-memory: session_id → [messages]
_session_messages: dict[str, list[dict]] = {}


class GuestChatRequest(BaseModel):
    content: str
    thread_id: str
    model: str | None = None


def _get_session_id(request: Request, x_session_id: str = "") -> str:
    """Get stable session ID from header or IP fingerprint."""
    sid = x_session_id or request.headers.get("X-Session-ID", "")
    if not sid or len(sid) < 8:
        import hashlib
        ip = request.client.host if request.client else "unknown"
        ua = request.headers.get("user-agent", "")
        sid = hashlib.sha256(f"{ip}:{ua}".encode()).hexdigest()[:32]
    return sid


@router.post("/guest")
async def guest_chat_stream(
    req: GuestChatRequest,
    request: Request,
    x_session_id: str = Header(default=""),
) -> StreamingResponse:
    """
    Guest SSE streaming chat — no auth required.
    Session identified by X-Session-ID header.
    """
    session_id = _get_session_id(request, x_session_id)

    # Build history
    history = _session_messages.get(session_id, [])
    history.append({"role": "user", "content": req.content})
    _session_messages[session_id] = history[-40:]  # Keep last 40 messages

    async def event_gen() -> AsyncGenerator[str, None]:
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        start = time.time()
        full_text = ""
        agent_used = "general_chat"

        try:
            from app.graph.graph import get_compiled_graph
            from app.core.config import settings

            # Build LangChain messages
            lc_msgs = []
            for m in history[:-1]:
                if m["role"] == "user":
                    lc_msgs.append(HumanMessage(content=m["content"]))
                elif m["role"] == "assistant":
                    lc_msgs.append(AIMessage(content=m["content"]))
            lc_msgs.append(HumanMessage(content=req.content))

            state = {
                "messages": lc_msgs,
                "thread_id": req.thread_id,
                "user_id": f"guest_{session_id}",
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
                "uploaded_file_ids": [],
                "tool_results": [],
                "web_search_results": [],
                "final_response": None,
                "citations": [],
                "agent_steps": [],
                "error": None,
                "retry_count": 0,
                "metadata": {"model": req.model or settings.GROQ_MODEL},
            }

            graph = await get_compiled_graph()
            config = {"configurable": {"thread_id": req.thread_id}}
            seen: set[str] = set()

            async for event in graph.astream_events(state, config=config, version="v2"):
                kind = event.get("event", "")
                data = event.get("data", {})

                if kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        full_text += chunk.content
                        yield sse({"type": "token", "content": chunk.content})

                elif kind == "on_chain_end":
                    output = data.get("output", {})
                    if isinstance(output, dict):
                        for step in output.get("agent_steps", []):
                            key = f"{step.get('step')}_{step.get('status')}"
                            if key not in seen:
                                seen.add(key)
                                yield sse({"type": "agent_step", "step": step})
                        if output.get("metadata"):
                            agent_used = output["metadata"].get("agent_used", agent_used)

        except Exception as e:
            logger.error("guest_chat.graph_error", error=str(e))
            # Fallback: simple Groq call
            try:
                from langchain_groq import ChatGroq
                from app.core.config import settings

                llm = ChatGroq(
                    api_key=settings.GROQ_API_KEY,
                    model=settings.GROQ_MODEL,
                    temperature=0.7,
                    max_tokens=2048,
                    streaming=True,
                )

                # Build simple message list
                from langchain_core.messages import SystemMessage
                msgs = [
                    SystemMessage(content=(
                        "You are a helpful, intelligent AI assistant. "
                        "You are concise, accurate, and friendly. "
                        "Use markdown formatting when it helps clarity."
                    ))
                ]
                for m in _session_messages.get(session_id, []):
                    if m["role"] == "user":
                        msgs.append(HumanMessage(content=m["content"]))
                    elif m["role"] == "assistant":
                        msgs.append(AIMessage(content=m["content"]))

                async for chunk in llm.astream(msgs):
                    if hasattr(chunk, "content") and chunk.content:
                        full_text += chunk.content
                        yield sse({"type": "token", "content": chunk.content})

            except Exception as e2:
                logger.error("guest_chat.fallback_error", error=str(e2))
                error_msg = "I'm having trouble connecting to the AI service. Please ensure the GROQ_API_KEY is set in backend/.env"
                yield sse({"type": "token", "content": error_msg})
                full_text = error_msg

        # Save assistant response
        if full_text:
            history.append({"role": "assistant", "content": full_text})
            _session_messages[session_id] = history[-40:]

        latency_ms = round((time.time() - start) * 1000, 1)
        yield sse({
            "type": "done",
            "metadata": {
                "agent_used": agent_used,
                "latency_ms": latency_ms,
                "session_id": session_id,
            },
        })

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/guest/sync")
async def guest_chat_sync(
    req: GuestChatRequest,
    request: Request,
    x_session_id: str = Header(default=""),
):
    """Sync (non-streaming) fallback for environments that don't support SSE."""
    session_id = _get_session_id(request, x_session_id)
    history = _session_messages.get(session_id, [])

    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage
        from app.core.config import settings

        llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=req.model or settings.GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048,
        )

        msgs = [SystemMessage(content=(
            "You are a helpful, intelligent AI assistant. Be concise, accurate and friendly. "
            "Use markdown when helpful."
        ))]
        for m in history:
            if m["role"] == "user":
                msgs.append(HumanMessage(content=m["content"]))
            elif m["role"] == "assistant":
                msgs.append(AIMessage(content=m["content"]))
        msgs.append(HumanMessage(content=req.content))

        result = await llm.ainvoke(msgs)
        response_text = result.content

        history.append({"role": "user", "content": req.content})
        history.append({"role": "assistant", "content": response_text})
        _session_messages[session_id] = history[-40:]

        return {"response": response_text, "agent_used": "general_chat"}

    except Exception as e:
        logger.error("guest_chat.sync_error", error=str(e))
        return {"response": f"Error: {str(e)}", "agent_used": "error"}

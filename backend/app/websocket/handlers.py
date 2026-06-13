"""
WebSocket route handler — the real-time streaming endpoint.
Each message goes through the full LangGraph pipeline with token-by-token streaming.
"""
import json
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.core.logging import get_logger
from app.db.session import AsyncSessionFactory
from app.graph.graph import get_compiled_graph
from app.models.message import Message
from app.repositories.user_repo import ConversationRepository, MessageRepository, UserRepository
from app.websocket.manager import manager

logger = get_logger(__name__)

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str) -> str | None:
    """Validate JWT from WebSocket connection. Returns user_id or None."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except Exception:
        return None


@router.websocket("/ws/chat/{thread_id}")
async def websocket_chat(websocket: WebSocket, thread_id: str):
    """
    WebSocket endpoint for real-time streaming chat.

    Protocol:
    Client → Server:
      { "type": "message", "content": "...", "token": "<jwt>", "file_ids": [...] }
      { "type": "stop" }

    Server → Client:
      { "type": "token", "data": "..." }        ← streamed tokens
      { "type": "done", "metadata": {...} }     ← stream complete
      { "type": "error", "message": "..." }     ← error occurred
    """
    # Peek at token before accepting
    await websocket.accept()

    # Wait for first message to authenticate
    try:
        raw = await websocket.receive_text()
        init_data = json.loads(raw)
    except Exception:
        await websocket.close(code=4000)
        return

    token = init_data.get("token", "")
    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.send_json({"type": "error", "message": "Unauthorized"})
        await websocket.close(code=4001)
        return

    # Re-register this connection with the manager (already accepted above)
    manager._connections.setdefault(user_id, {})[thread_id] = websocket
    import asyncio
    manager._stop_signals.setdefault(user_id, {})[thread_id] = asyncio.Event()

    try:
        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_error(user_id, thread_id, "Invalid JSON")
                continue

            msg_type = data.get("type")

            # ── Stop generation ──────────────────────────────────────────────
            if msg_type == "stop":
                manager.signal_stop(user_id, thread_id)
                logger.info("ws.stop_requested", user_id=user_id, thread_id=thread_id)
                continue

            # ── Chat message ─────────────────────────────────────────────────
            if msg_type == "message":
                content = data.get("content", "").strip()
                file_ids = data.get("file_ids", [])

                if not content:
                    await manager.send_error(user_id, thread_id, "Empty message")
                    continue

                manager.reset_stop(user_id, thread_id)

                await _handle_chat_message(
                    websocket=websocket,
                    user_id=user_id,
                    thread_id=thread_id,
                    content=content,
                    file_ids=file_ids,
                )

    finally:
        manager.disconnect(user_id, thread_id)


async def _handle_chat_message(
    websocket: WebSocket,
    user_id: str,
    thread_id: str,
    content: str,
    file_ids: list[str],
) -> None:
    """Run the LangGraph pipeline and stream tokens back to the client."""
    start_time = time.time()

    async with AsyncSessionFactory() as db:
        try:
            # Validate conversation belongs to user
            conv_repo = ConversationRepository(db)
            conversation = await conv_repo.get_by_thread_id(thread_id)
            if not conversation or str(conversation.user_id) != user_id:
                await manager.send_error(user_id, thread_id, "Conversation not found")
                return

            # Save the user message to DB
            msg_repo = MessageRepository(db)
            await msg_repo.create(
                conversation_id=conversation.id,
                role="user",
                content=content,
            )

            # Get recent messages for context (last 20)
            recent_msgs = await msg_repo.get_latest_messages(conversation.id, count=20)
            lc_messages = []
            for m in recent_msgs[:-1]:  # Exclude the just-saved user message
                if m.role == "user":
                    lc_messages.append(HumanMessage(content=m.content))
                elif m.role == "assistant":
                    lc_messages.append(AIMessage(content=m.content))

            lc_messages.append(HumanMessage(content=content))

            # Build initial state
            initial_state = {
                "messages": lc_messages,
                "thread_id": thread_id,
                "user_id": user_id,
                "route": None,
                "context": None,
                "uploaded_file_ids": file_ids or [],
                "tool_results": None,
                "web_search_results": None,
                "final_response": None,
                "citations": None,
                "error": None,
                "retry_count": 0,
                "metadata": {},
            }

            graph = get_compiled_graph()
            config = {"configurable": {"thread_id": thread_id}}

            # ── Stream tokens from LangGraph ─────────────────────────────────
            full_response = ""
            agent_used = "general_chat"

            async for event in graph.astream_events(
                initial_state, config=config, version="v2"
            ):
                # Stop if user requested
                if manager.is_stop_requested(user_id, thread_id):
                    await manager.send_json(user_id, thread_id, {"type": "stopped"})
                    break

                kind = event.get("event")
                # Stream LLM tokens
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        token = chunk.content
                        full_response += token
                        await manager.send_token(user_id, thread_id, token)

                # Capture which agent ran
                elif kind == "on_chain_end":
                    output = event.get("data", {}).get("output", {})
                    if isinstance(output, dict) and "metadata" in output:
                        agent_used = output["metadata"].get("agent_used", "general_chat")

            # ── Save assistant response ──────────────────────────────────────
            latency_ms = (time.time() - start_time) * 1000
            if full_response:
                await msg_repo.create(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=full_response,
                    agent_used=agent_used,
                    metadata={"latency_ms": round(latency_ms, 2)},
                )

                # Auto-update conversation title after first exchange
                if len(recent_msgs) <= 1:
                    title = content[:60] + ("..." if len(content) > 60 else "")
                    await conv_repo.update(conversation, title=title)

            await db.commit()

            await manager.send_done(
                user_id,
                thread_id,
                metadata={
                    "agent_used": agent_used,
                    "latency_ms": round(latency_ms, 2),
                    "thread_id": thread_id,
                },
            )

        except Exception as e:
            logger.error("ws.chat_error", error=str(e), user_id=user_id)
            await manager.send_error(user_id, thread_id, "An error occurred. Please try again.")
            await db.rollback()

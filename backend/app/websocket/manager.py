"""
WebSocket connection manager.
Handles multiple concurrent streaming connections per user.
"""
import asyncio
import json
from typing import Optional
from uuid import UUID

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections keyed by (user_id, thread_id).
    Supports broadcasting tokens to the correct client.
    Also supports stop-generation via cancellation tokens.
    """

    def __init__(self) -> None:
        # {user_id: {thread_id: WebSocket}}
        self._connections: dict[str, dict[str, WebSocket]] = {}
        # {user_id: {thread_id: asyncio.Event}} — set to signal stop
        self._stop_signals: dict[str, dict[str, asyncio.Event]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, thread_id: str) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = {}
            self._stop_signals[user_id] = {}
        self._connections[user_id][thread_id] = websocket
        self._stop_signals[user_id][thread_id] = asyncio.Event()
        logger.info("ws.connected", user_id=user_id, thread_id=thread_id)

    def disconnect(self, user_id: str, thread_id: str) -> None:
        if user_id in self._connections:
            self._connections[user_id].pop(thread_id, None)
            self._stop_signals[user_id].pop(thread_id, None)
        logger.info("ws.disconnected", user_id=user_id, thread_id=thread_id)

    def signal_stop(self, user_id: str, thread_id: str) -> None:
        """Signal the streaming coroutine to stop generating."""
        try:
            self._stop_signals[user_id][thread_id].set()
        except KeyError:
            pass

    def is_stop_requested(self, user_id: str, thread_id: str) -> bool:
        try:
            return self._stop_signals[user_id][thread_id].is_set()
        except KeyError:
            return False

    def reset_stop(self, user_id: str, thread_id: str) -> None:
        try:
            self._stop_signals[user_id][thread_id].clear()
        except KeyError:
            pass

    async def send_token(self, user_id: str, thread_id: str, token: str) -> None:
        """Stream a single token to the client."""
        ws = self._get_ws(user_id, thread_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json({"type": "token", "data": token})

    async def send_done(
        self,
        user_id: str,
        thread_id: str,
        metadata: Optional[dict] = None,
    ) -> None:
        """Signal that streaming is complete."""
        ws = self._get_ws(user_id, thread_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json({"type": "done", "metadata": metadata or {}})

    async def send_error(self, user_id: str, thread_id: str, error: str) -> None:
        ws = self._get_ws(user_id, thread_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json({"type": "error", "message": error})

    async def send_json(self, user_id: str, thread_id: str, data: dict) -> None:
        ws = self._get_ws(user_id, thread_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json(data)

    def _get_ws(self, user_id: str, thread_id: str) -> Optional[WebSocket]:
        return self._connections.get(user_id, {}).get(thread_id)


# Global singleton — shared across all WebSocket routes
manager = ConnectionManager()

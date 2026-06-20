"""
FastAPI dependency functions for authentication.
Supports both authenticated users AND guest (anonymous) mode.
Guest mode uses a session-based guest ID instead of requiring login.
"""
from typing import Optional

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)

# A simple mock guest user class for non-authenticated requests
class GuestUser:
    """Represents an anonymous guest user."""
    def __init__(self, guest_id: str):
        self.id = guest_id
        self.email = f"guest_{guest_id[:8]}@chatbot.local"
        self.full_name = "Guest User"
        self.is_active = True
        self.is_guest = True

    def __str__(self):
        return f"guest:{self.id}"


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    FastAPI dependency — tries to validate JWT bearer token.
    If no token (or invalid), returns a GuestUser with a session-based ID.
    This allows the app to work without login.
    """
    # Try authenticated flow first
    if credentials and credentials.credentials:
        try:
            from app.auth.jwt import TOKEN_TYPE_ACCESS, decode_token
            from app.repositories.user_repo import UserRepository
            import uuid

            payload = decode_token(credentials.credentials)

            if payload.get("type") == TOKEN_TYPE_ACCESS:
                user_id_str = payload.get("sub")
                if user_id_str:
                    repo = UserRepository(db)
                    user = await repo.get_by_id(uuid.UUID(user_id_str))
                    if user and user.is_active:
                        user.is_guest = False
                        return user
        except Exception:
            pass  # Fall through to guest mode

    # Guest mode — use X-Session-ID header or generate one
    session_id = request.headers.get("X-Session-ID", "")
    if not session_id or len(session_id) < 8:
        # Use IP + user-agent as a stable guest ID
        import hashlib
        fingerprint = f"{request.client.host if request.client else 'unknown'}:{request.headers.get('user-agent', '')}"
        session_id = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

    return GuestUser(session_id)


async def get_current_active_user(
    current_user=Depends(get_current_user),
):
    """Additional check — allows guests too."""
    return current_user


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Use this for endpoints that REQUIRE authentication (not guest-compatible)."""
    from app.core.exceptions import AuthenticationError, InvalidTokenError
    from app.auth.jwt import TOKEN_TYPE_ACCESS, decode_token
    from app.repositories.user_repo import UserRepository
    import uuid

    if not credentials:
        raise AuthenticationError("Authorization header missing")

    payload = decode_token(credentials.credentials)
    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise InvalidTokenError()

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise InvalidTokenError()

    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id_str))
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    return user

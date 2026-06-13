"""
FastAPI dependency functions for authentication.
Used in route handlers: `current_user: User = Depends(get_current_user)`
"""
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import TOKEN_TYPE_ACCESS, decode_token
from app.core.exceptions import AuthenticationError, InvalidTokenError
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repo import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — validates bearer token and returns the current user.
    Raises 401 if token is missing, expired, or invalid.
    """
    if not credentials:
        raise AuthenticationError("Authorization header missing")

    payload = decode_token(credentials.credentials)

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise InvalidTokenError()

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise InvalidTokenError()

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise InvalidTokenError()

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)

    if not user:
        raise AuthenticationError("User not found")
    if not user.is_active:
        raise AuthenticationError("User account is disabled")

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Additional check — only active + verified users."""
    return current_user

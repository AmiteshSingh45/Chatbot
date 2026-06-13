"""
JWT authentication — access + refresh token pair.
Access tokens: short-lived (60 min).
Refresh tokens: long-lived (30 days), stored in Redis for revocation support.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from redis.asyncio import Redis

from app.core.config import settings
from app.core.exceptions import InvalidTokenError, TokenExpiredError
from app.core.logging import get_logger

logger = get_logger(__name__)

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
REFRESH_TOKEN_PREFIX = "refresh_token:"


def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: Optional[dict] = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: UUID, email: str) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_ACCESS,
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims={"email": email},
    )


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_REFRESH,
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises TokenExpiredError or InvalidTokenError."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError()
    except JWTError:
        raise InvalidTokenError()


async def store_refresh_token(redis: Redis, user_id: UUID, token: str) -> None:
    """Store refresh token in Redis for revocation support."""
    key = f"{REFRESH_TOKEN_PREFIX}{user_id}"
    await redis.setex(
        key,
        timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        token,
    )


async def validate_refresh_token(redis: Redis, user_id: UUID, token: str) -> bool:
    """Validate that refresh token is in Redis (not revoked)."""
    key = f"{REFRESH_TOKEN_PREFIX}{user_id}"
    stored = await redis.get(key)
    return stored == token


async def revoke_refresh_token(redis: Redis, user_id: UUID) -> None:
    """Revoke a refresh token (logout)."""
    key = f"{REFRESH_TOKEN_PREFIX}{user_id}"
    await redis.delete(key)

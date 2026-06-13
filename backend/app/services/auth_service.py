"""
Auth service — registration, login, OAuth, token refresh, password reset.
Business logic lives here, not in routes.
"""
import json
import secrets
from datetime import timedelta
from typing import Optional
from uuid import UUID

from passlib.context import CryptContext
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    revoke_refresh_token,
    store_refresh_token,
    validate_refresh_token,
    decode_token,
)
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    InvalidTokenError,
    NotFoundError,
)
from app.core.logging import get_logger
from app.models.user import User
from app.repositories.user_repo import UserRepository

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


class AuthService:
    def __init__(self, db: AsyncSession, redis: Redis) -> None:
        self.db = db
        self.redis = redis
        self.user_repo = UserRepository(db)

    async def register(
        self,
        email: str,
        password: str,
        username: Optional[str] = None,
    ) -> dict:
        """Register a new user with email/password."""
        if await self.user_repo.email_exists(email):
            raise ConflictError(f"Email '{email}' is already registered")

        hashed = hash_password(password)
        user = await self.user_repo.create(
            email=email,
            hashed_password=hashed,
            username=username or email.split("@")[0],
            provider="credentials",
            is_verified=False,
        )
        logger.info("user.registered", user_id=str(user.id), email=email)
        return await self._generate_token_pair(user)

    async def login(self, email: str, password: str) -> dict:
        """Authenticate with email/password."""
        user = await self.user_repo.get_by_email(email)
        if not user or not user.hashed_password:
            raise AuthenticationError("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")
        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        logger.info("user.login", user_id=str(user.id))
        return await self._generate_token_pair(user)

    async def oauth_login(
        self,
        email: str,
        provider: str,
        provider_id: str,
        profile_image: Optional[str] = None,
        username: Optional[str] = None,
    ) -> dict:
        """Login or register via OAuth (Google / GitHub)."""
        user = await self.user_repo.get_by_provider(provider, provider_id)

        if not user:
            # Also check if email already exists
            user = await self.user_repo.get_by_email(email)
            if user:
                # Link OAuth to existing account
                user = await self.user_repo.update(
                    user,
                    provider=provider,
                    provider_id=provider_id,
                    profile_image=profile_image or user.profile_image,
                )
            else:
                user = await self.user_repo.create(
                    email=email,
                    provider=provider,
                    provider_id=provider_id,
                    profile_image=profile_image,
                    username=username or email.split("@")[0],
                    is_verified=True,
                )
                logger.info("user.oauth_registered", provider=provider, email=email)

        logger.info("user.oauth_login", provider=provider, user_id=str(user.id))
        return await self._generate_token_pair(user)

    async def refresh_tokens(self, refresh_token: str) -> dict:
        """Exchange a valid refresh token for new access + refresh tokens."""
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise InvalidTokenError()

        user_id = UUID(payload["sub"])
        if not await validate_refresh_token(self.redis, user_id, refresh_token):
            raise InvalidTokenError()

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        # Revoke old, issue new (rotation)
        await revoke_refresh_token(self.redis, user_id)
        return await self._generate_token_pair(user)

    async def logout(self, user_id: UUID) -> None:
        """Revoke the user's refresh token."""
        await revoke_refresh_token(self.redis, user_id)
        logger.info("user.logout", user_id=str(user_id))

    async def _generate_token_pair(self, user: User) -> dict:
        access_token = create_access_token(user.id, user.email)
        refresh_token = create_refresh_token(user.id)
        await store_refresh_token(self.redis, user.id, refresh_token)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "profile_image": user.profile_image,
                "provider": user.provider,
            },
        }

"""
Auth service — registration, login, token refresh.
Stateless JWT — no Redis. Refresh tokens are client-held (rotate on use).
"""
import uuid
from typing import Optional
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    InvalidTokenError,
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
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
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
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            hashed_password=hashed,
            username=username or email.split("@")[0],
            provider="credentials",
            is_verified=False,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.commit()
        logger.info("user.registered", user_id=str(user.id), email=email)
        return self._generate_token_pair(user)

    async def login(self, email: str, password: str) -> dict:
        """Authenticate with email/password."""
        user = await self.user_repo.get_by_email(email)
        if not user or not getattr(user, "hashed_password", None):
            raise AuthenticationError("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid email or password")
        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        logger.info("user.login", user_id=str(user.id))
        return self._generate_token_pair(user)

    async def refresh_tokens(self, refresh_token: str) -> dict:
        """Exchange a valid refresh token for new access + refresh tokens."""
        try:
            payload = decode_token(refresh_token)
        except Exception:
            raise InvalidTokenError()

        if payload.get("type") != "refresh":
            raise InvalidTokenError()

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise InvalidTokenError()

        user = await self.user_repo.get_by_id(UUID(user_id_str))
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        logger.info("user.token_refresh", user_id=str(user.id))
        return self._generate_token_pair(user)

    def _generate_token_pair(self, user: User) -> dict:
        access_token = create_access_token(user.id, user.email)
        refresh_token = create_refresh_token(user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": getattr(user, "username", None) or user.email.split("@")[0],
                "profile_image": getattr(user, "profile_image", None),
                "provider": getattr(user, "provider", "credentials"),
            },
        }

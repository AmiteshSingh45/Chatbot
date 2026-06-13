"""
Auth API routes — register, login, OAuth callback, refresh, logout.
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, field_validator
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.redis import get_redis
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Schemas ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    username: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class OAuthRequest(BaseModel):
    email: EmailStr
    provider: str
    provider_id: str
    profile_image: str | None = None
    username: str | None = None


# --- Routes ---
@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Register a new user with email and password."""
    service = AuthService(db, redis)
    return await service.register(
        email=body.email,
        password=body.password,
        username=body.username,
    )


@router.post("/login")
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Authenticate with email and password."""
    service = AuthService(db, redis)
    return await service.login(email=body.email, password=body.password)


@router.post("/oauth")
async def oauth_login(
    body: OAuthRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Login or register via OAuth provider (Google/GitHub)."""
    service = AuthService(db, redis)
    return await service.oauth_login(
        email=body.email,
        provider=body.provider,
        provider_id=body.provider_id,
        profile_image=body.profile_image,
        username=body.username,
    )


@router.post("/refresh")
async def refresh_tokens(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Rotate refresh token and issue new access token."""
    service = AuthService(db, redis)
    return await service.refresh_tokens(body.refresh_token)


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """Revoke refresh token and clear session."""
    service = AuthService(db, redis)
    await service.logout(current_user.id)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "profile_image": current_user.profile_image,
        "provider": current_user.provider,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at.isoformat(),
    }

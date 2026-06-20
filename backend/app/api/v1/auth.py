"""
Auth API routes — register, login, refresh, logout, me.
No Redis required — JWT is stateless. Refresh tokens stored in SQLite.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with email and password."""
    service = AuthService(db)
    return await service.register(
        email=body.email,
        password=body.password,
        username=body.username,
    )


@router.post("/login")
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password."""
    service = AuthService(db)
    return await service.login(email=body.email, password=body.password)


@router.post("/refresh")
async def refresh_tokens(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Issue a new access token using a valid refresh token."""
    service = AuthService(db)
    return await service.refresh_tokens(body.refresh_token)


@router.post("/logout")
async def logout(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke session (stateless — client should discard token)."""
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    # Handle guest users
    if getattr(current_user, "is_guest", False):
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "username": "Guest",
            "is_guest": True,
        }
    return {
        "id": str(current_user.id),
        "email": getattr(current_user, "email", ""),
        "username": getattr(current_user, "username", None) or getattr(current_user, "full_name", "User"),
        "profile_image": getattr(current_user, "profile_image", None),
        "provider": getattr(current_user, "provider", "email"),
        "is_guest": False,
        "created_at": current_user.created_at.isoformat() if hasattr(current_user, "created_at") else None,
    }

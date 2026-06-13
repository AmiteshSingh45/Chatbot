"""API v1 router — registers all sub-routers."""
from fastapi import APIRouter

from app.api.v1 import auth, conversations, files
from app.api.v1.chat import router as chat_router
from app.api.v1.memory import router as memory_router
from app.api.v1.mcp import router as mcp_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(conversations.router)
api_router.include_router(files.router)
api_router.include_router(chat_router)
api_router.include_router(memory_router)
api_router.include_router(mcp_router)

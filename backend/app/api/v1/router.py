"""API v1 router — registers all sub-routers."""
from fastapi import APIRouter

api_router = APIRouter(prefix="/api/v1")

# Auth (register/login/refresh/me)
try:
    from app.api.v1.auth import router as auth_router
    api_router.include_router(auth_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"auth router failed: {e}")

# Guest Chat (no auth required — main entry for new users)
try:
    from app.api.v1.guest_chat import router as guest_chat_router
    api_router.include_router(guest_chat_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"guest_chat router failed: {e}")

# Authenticated Chat (SSE streaming with full LangGraph + memory)
try:
    from app.api.v1.chat import router as chat_router
    api_router.include_router(chat_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"chat router failed: {e}")

# Conversations (CRUD)
try:
    from app.api.v1.conversations import router as conv_router
    api_router.include_router(conv_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"conversations router failed: {e}")

# Files / RAG
try:
    from app.api.v1.files import router as files_router
    api_router.include_router(files_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"files router failed: {e}")

# Memory
try:
    from app.api.v1.memory import router as memory_router
    api_router.include_router(memory_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"memory router failed: {e}")

# MCP Tools
try:
    from app.api.v1.mcp import router as mcp_router
    api_router.include_router(mcp_router)
except Exception as e:
    import logging; logging.getLogger(__name__).error(f"mcp router failed: {e}")

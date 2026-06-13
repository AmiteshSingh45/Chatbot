"""
FastAPI application entry point — NexusAI v2.0
Production-grade AI Agent Platform with LangGraph, FAISS, MCP.
No external services required: SQLite + local FAISS + Groq API.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import NexusAIException, http_exception_from_domain
from app.core.logging import get_logger, setup_logging
from app.middleware.rate_limit import RateLimitMiddleware, SecurityHeadersMiddleware

# Set LangSmith env vars before any LangChain imports
if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    setup_logging(
        log_level="DEBUG" if settings.DEBUG else "INFO",
        json_logs=not settings.DEBUG,
    )
    logger.info(
        "nexusai.starting",
        env=settings.APP_ENV,
        version=settings.APP_VERSION,
    )

    # 1. Create database tables (SQLite auto-creates if not exists)
    from app.db.session import create_all_tables
    await create_all_tables()
    logger.info("nexusai.db_ready", db=settings.SQLITE_PATH)

    # 2. Ensure upload and FAISS directories exist
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.faiss_index_path.mkdir(parents=True, exist_ok=True)
    logger.info("nexusai.dirs_ready")

    # 3. Pre-compile LangGraph graph (runs once, caches globally)
    from app.graph.graph import get_compiled_graph
    await get_compiled_graph()
    logger.info("nexusai.langgraph_compiled")

    # 4. Initialize MCP service (discovers tools from configured servers)
    try:
        from app.services.mcp_service import get_mcp_service
        mcp = get_mcp_service()
        await mcp.initialize()
        logger.info("nexusai.mcp_initialized", tools=len(mcp.get_tools()))
    except Exception as e:
        logger.warning("nexusai.mcp_init_failed", error=str(e))

    # 5. Warm up embedding model (loads SentenceTransformer into memory)
    try:
        from app.utils.embeddings import embed_batch
        embed_batch(["warmup"])
        logger.info("nexusai.embeddings_ready")
    except Exception as e:
        logger.warning("nexusai.embeddings_warmup_failed", error=str(e))

    logger.info("nexusai.ready")
    yield  # ── App is running ──

    # Shutdown cleanup
    logger.info("nexusai.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="NexusAI API",
        description=(
            "Production-grade AI Agent Platform — "
            "LangGraph + Groq + FAISS + MCP + SQLite"
        ),
        version=settings.APP_VERSION,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Security Headers ──────────────────────────────────────────────────
    app.add_middleware(SecurityHeadersMiddleware)

    # ── In-Memory Rate Limiting ───────────────────────────────────────────
    app.add_middleware(RateLimitMiddleware)

    # ── Exception Handlers ────────────────────────────────────────────────
    @app.exception_handler(NexusAIException)
    async def domain_exception_handler(request: Request, exc: NexusAIException):
        http_exc = http_exception_from_domain(exc)
        return JSONResponse(
            status_code=http_exc.status_code,
            content={"detail": http_exc.detail},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": "Internal server error", "code": "INTERNAL_ERROR"}},
        )

    # ── API Routers ───────────────────────────────────────────────────────
    app.include_router(api_router)

    # ── WebSocket (kept for backwards compatibility) ───────────────────────
    try:
        from app.websocket.handlers import router as ws_router
        app.include_router(ws_router)
    except Exception as e:
        logger.warning("nexusai.ws_router_failed", error=str(e))

    # ── Static file serving for uploads (optional) ───────────────────────
    uploads_dir = settings.upload_path
    if uploads_dir.exists():
        app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

    # ── Health Check ──────────────────────────────────────────────────────
    @app.get("/health", tags=["health"])
    async def health_check():
        from app.services.mcp_service import get_mcp_service
        mcp_status = get_mcp_service().get_status()
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "env": settings.APP_ENV,
            "db": settings.SQLITE_PATH,
            "mcp_tools": mcp_status.get("total_tools", 0),
        }

    return app


app = create_app()

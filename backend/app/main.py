"""
FastAPI application entry point — AI Chatbot
Production AI Agent Platform with LangGraph, FAISS, Groq.
No external services required: SQLite + local FAISS + Groq API.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger, setup_logging

# Setup logging immediately at module level (before any logger calls)
setup_logging(
    log_level="DEBUG" if settings.DEBUG else "INFO",
    json_logs=False,
)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("chatbot.starting", env=settings.APP_ENV, version=settings.APP_VERSION)

    # 1. Create database tables
    try:
        from app.db.session import create_all_tables
        await create_all_tables()
        logger.info("chatbot.db_ready", db=settings.SQLITE_PATH)
    except Exception as e:
        logger.error("chatbot.db_failed", error=str(e))

    # 2. Ensure directories exist
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.faiss_index_path.mkdir(parents=True, exist_ok=True)
    logger.info("chatbot.dirs_ready")

    # 3. Pre-compile LangGraph graph
    try:
        from app.graph.graph import get_compiled_graph
        await get_compiled_graph()
        logger.info("chatbot.graph_compiled")
    except Exception as e:
        logger.warning("chatbot.graph_failed", error=str(e))

    # 4. Initialize MCP service
    try:
        from app.services.mcp_service import get_mcp_service
        mcp = get_mcp_service()
        await mcp.initialize()
        logger.info("chatbot.mcp_initialized", tools=len(mcp.get_tools()))
    except Exception as e:
        logger.warning("chatbot.mcp_init_failed", error=str(e))

    # 5. Warm up embedding model
    try:
        from app.utils.embeddings import embed_batch
        embed_batch(["warmup"])
        logger.info("chatbot.embeddings_ready")
    except Exception as e:
        logger.warning("chatbot.embeddings_warmup_failed", error=str(e))

    # Set LangSmith if configured
    if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT

    logger.info("chatbot.ready")
    yield

    logger.info("chatbot.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Chatbot API",
        description="AI Agent Platform — LangGraph + Groq + FAISS + SQLite",
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", error=str(exc), path=str(request.url.path))
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": "Internal server error", "code": "INTERNAL_ERROR"}},
        )

    # Domain exception handler
    try:
        from app.core.exceptions import NexusAIException, http_exception_from_domain

        @app.exception_handler(NexusAIException)
        async def domain_exception_handler(request: Request, exc: NexusAIException):
            http_exc = http_exception_from_domain(exc)
            return JSONResponse(
                status_code=http_exc.status_code,
                content={"detail": http_exc.detail},
            )
    except Exception:
        pass

    # Rate limiting (optional)
    try:
        from app.middleware.rate_limit import RateLimitMiddleware, SecurityHeadersMiddleware
        app.add_middleware(SecurityHeadersMiddleware)
        app.add_middleware(RateLimitMiddleware)
    except Exception as e:
        logger.warning("chatbot.middleware_failed", error=str(e))

    # API Routers
    try:
        from app.api.v1.router import api_router
        app.include_router(api_router)
    except Exception as e:
        logger.error("chatbot.router_failed", error=str(e))

    # Static uploads
    try:
        from fastapi.staticfiles import StaticFiles
        uploads_dir = settings.upload_path
        if uploads_dir.exists():
            app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
    except Exception:
        pass

    # Health Check
    @app.get("/health", tags=["health"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "env": settings.APP_ENV,
            "db": settings.SQLITE_PATH,
        }

    @app.get("/", tags=["health"])
    async def root():
        return {"message": "AI Chatbot API", "docs": "/docs", "health": "/health"}

    return app


app = create_app()

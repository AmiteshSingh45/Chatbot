"""
Rate limiting middleware — in-memory sliding window (no Redis required).
Uses a thread-safe deque per identifier. Suitable for single-process deployments.
"""
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class InMemoryRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window = window_seconds
        self._buckets: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def is_allowed(self, identifier: str) -> bool:
        now = time.time()
        cutoff = now - self.window

        with self._lock:
            bucket = self._buckets[identifier]
            # Remove expired timestamps
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                return False

            bucket.append(now)
            return True


# Singleton limiter
_limiter = InMemoryRateLimiter(
    max_requests=settings.RATE_LIMIT_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW,
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding window rate limiter (replaces Redis-based limiter).
    Limits per token prefix (authenticated) or per IP (anonymous).
    """

    EXCLUDED_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/favicon.ico"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)

        identifier = self._get_identifier(request)
        if not _limiter.is_allowed(identifier):
            logger.warning("rate_limit.exceeded", identifier=identifier[:20])
            return JSONResponse(
                status_code=429,
                content={
                    "detail": {
                        "message": "Rate limit exceeded. Please slow down.",
                        "code": "RATE_LIMIT_EXCEEDED",
                    }
                },
                headers={"Retry-After": str(settings.RATE_LIMIT_WINDOW)},
            )

        return await call_next(request)

    def _get_identifier(self, request: Request) -> str:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return f"token:{auth[7:39]}"  # first 32 chars of token
        client = request.client
        return f"ip:{client.host if client else 'unknown'}"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response

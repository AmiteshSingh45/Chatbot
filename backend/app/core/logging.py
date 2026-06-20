"""Structured logging — simple and compatible with Python 3.13."""
import logging
import sys
from typing import Any

import structlog


def setup_logging(log_level: str = "INFO", json_logs: bool = False) -> None:
    """Configure structlog for the application."""
    log_level_int = getattr(logging, log_level.upper(), logging.INFO)

    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
        structlog.processors.StackInfoRenderer(),
    ]

    if json_logs:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=False))

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level_int),
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Also configure stdlib logging
    logging.basicConfig(
        format="%(levelname)-8s %(name)s: %(message)s",
        stream=sys.stdout,
        level=log_level_int,
    )


def get_logger(name: str) -> Any:
    """Get a structlog logger bound with a name key."""
    return structlog.get_logger().bind(logger=name)

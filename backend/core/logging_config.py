"""Structured logging via structlog."""
import logging
import structlog
from typing import Any


def configure_logging(log_level: str = "INFO") -> None:
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, log_level.upper()),
    )
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)


class RequestContext:
    def __init__(self, request_id: str, **kwargs: Any):
        self.request_id = request_id
        self.context = kwargs

    def __enter__(self) -> None:
        structlog.threadlocal.bind_threadlocal(request_id=self.request_id, **self.context)

    def __exit__(self, *args: Any) -> None:
        structlog.threadlocal.clear_threadlocal()

"""Request metrics middleware — logs method, path, status, and duration.

Implemented as pure ASGI middleware (not BaseHTTPMiddleware) so exceptions
propagate cleanly to outer middleware (CORS, ServerErrorMiddleware) and
error responses retain CORS headers.
"""
import time
import uuid
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

from core.logging_config import get_logger

logger = get_logger(__name__)


class MetricsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()
        status_code: int = 500  # default if the app raises before sending

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers["X-Request-Id"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.info(
                "request",
                request_id=request_id,
                method=scope.get("method"),
                path=scope.get("path"),
                status=status_code,
                duration_ms=duration_ms,
            )

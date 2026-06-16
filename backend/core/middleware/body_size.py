"""Request body size limit — rejects oversized payloads early.

A memory-exhaustion / payload-flood guard (application-layer DoS). Enforced
from the declared Content-Length, which every JSON client here sets (extension
fetch + frontend ky). For chunked/unknown-length uploads, a reverse proxy
(nginx ``client_max_body_size`` / Cloudflare) should enforce the same cap —
this middleware is the in-app second layer.

Pure ASGI middleware so it composes cleanly with the other ASGI middleware
and rejected requests never reach route handlers.
"""
import json

from starlette.types import ASGIApp, Receive, Scope, Send

from core.config import get_settings


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.max_bytes = get_settings().MAX_REQUEST_BODY_BYTES

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            for name, value in scope.get("headers") or []:
                if name == b"content-length":
                    try:
                        if int(value) > self.max_bytes:
                            await self._reject(send)
                            return
                    except ValueError:
                        pass
                    break
        await self.app(scope, receive, send)

    async def _reject(self, send: Send) -> None:
        body = json.dumps({"detail": "Request body too large"}).encode()
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": body})

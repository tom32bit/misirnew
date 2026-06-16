"""Rate limiter (slowapi, memory or Redis) — DoS / abuse protection."""
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from core.config import get_settings

logger = logging.getLogger(__name__)


def _identity_key(request: Request) -> str:
    """Rate-limit bucket key.

    Prefer the authenticated Clerk user (set on ``request.state`` by
    ``get_current_user``) so one user cannot exhaust another's quota and
    per-route limits are fair. Falls back to client IP for unauthenticated
    or pre-dependency (global middleware) requests.

    NOTE: behind a proxy/CDN, run uvicorn with ``--forwarded-allow-ips`` so
    ``get_remote_address`` resolves the real client IP rather than the proxy.
    """
    uid = getattr(request.state, "clerk_user_id", None)
    if uid:
        return f"user:{uid}"
    return get_remote_address(request)


def _get_limiter() -> Limiter:
    settings = get_settings()
    default_limits = [settings.RATE_LIMIT_DEFAULT]
    if settings.RATE_LIMIT_STORAGE == "redis":
        try:
            return Limiter(
                key_func=_identity_key,
                default_limits=default_limits,
                storage_uri=settings.REDIS_URL,
            )
        except Exception as e:
            logger.warning(f"Redis rate limiter failed ({e}), falling back to memory")
    return Limiter(key_func=_identity_key, default_limits=default_limits)


limiter = _get_limiter()

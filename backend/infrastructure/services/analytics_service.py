"""Server-side product analytics (PostHog).

Best-effort, exactly like audit logging: a capture must never block or fail a
request. Disabled unless POSTHOG_API_KEY is set — with no key the module holds a
None client and every call is a no-op, so leaving the env blank keeps analytics
fully off (local dev, CI, self-hosters who opt out).

Events are keyed by the internal user_id so server-side events line up with the
frontend's identified person. Never pass raw personal data as properties.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)


class _AnalyticsClient:
    """Thin wrapper over posthog.Posthog with graceful degradation."""

    def __init__(self) -> None:
        self._client = None
        settings = get_settings()
        key = settings.POSTHOG_API_KEY
        if not key:
            logger.info("analytics disabled (no POSTHOG_API_KEY)")
            return
        try:
            from posthog import Posthog

            self._client = Posthog(
                project_api_key=key,
                host=settings.POSTHOG_HOST,
                # Don't let network hiccups slow request handling; drop on error.
                on_error=lambda err, batch: logger.warning("posthog flush failed", error=str(err)),
                # Server events are explicit; no feature-flag polling needed here.
                disable_geoip=False,
            )
            logger.info("analytics enabled", host=settings.POSTHOG_HOST)
        except Exception as exc:  # bad key/import — degrade to no-op
            logger.warning("analytics init failed; disabling", error=str(exc))
            self._client = None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def capture(
        self,
        distinct_id: Optional[str],
        event: str,
        properties: Optional[dict] = None,
    ) -> None:
        """Record one event. No-ops when disabled or without a distinct_id."""
        if self._client is None or not distinct_id:
            return
        try:
            self._client.capture(distinct_id=distinct_id, event=event, properties=properties or {})
        except Exception as exc:  # never block the request
            logger.warning("analytics capture failed", event=event, error=str(exc))

    def flush(self) -> None:
        """Flush + shut down the background sender (call on app shutdown)."""
        if self._client is None:
            return
        try:
            self._client.shutdown()
        except Exception as exc:
            logger.warning("analytics shutdown failed", error=str(exc))


@lru_cache
def get_analytics() -> _AnalyticsClient:
    return _AnalyticsClient()

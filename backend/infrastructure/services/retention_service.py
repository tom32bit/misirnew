"""Storage-limitation purge (GDPR 5(1)(e), CCPA, PDPO).

Primary production path is the pg_cron job created in privacy_migration.sql.
This service is the in-app fallback / manual trigger and is used by tests.
Deleting an artifact cascades to its synthesis, embedding, open-events, tags
and cross-space links.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)


def purge_expired(db, retention_days: int | None = None) -> dict:
    days = retention_days if retention_days is not None else get_settings().RETENTION_DAYS
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    misir = db.schema("misir")

    arts = misir.table("artifact").delete().lt("captured_at", cutoff).execute()
    gaps = (
        misir.table("gap").delete()
        .eq("status", "resolved").lt("resolved_at", cutoff).execute()
    )
    nudges = (
        misir.table("nudge").delete()
        .in_("status", ["dismissed", "acted"]).lt("dismissed_at", cutoff).execute()
    )

    result = {
        "retention_days": days,
        "cutoff": cutoff,
        "artifacts_deleted": len(arts.data or []),
        "gaps_deleted": len(gaps.data or []),
        "nudges_deleted": len(nudges.data or []),
    }
    logger.info("retention purge complete", **result)
    return result

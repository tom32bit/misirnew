"""Append-only audit logging for privacy-sensitive events (GDPR Art 5(2)).

Failures here never block the request — auditing is best-effort and must not
become an availability dependency.
"""
from __future__ import annotations

from typing import Optional

from core.logging_config import get_logger
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)


def record_audit(user_id: Optional[str], action: str, detail: Optional[dict] = None) -> None:
    """Write one audit row. `detail` must NOT contain raw personal data."""
    try:
        get_supabase().schema("misir").table("audit_log").insert({
            "user_id": user_id,
            "action": action,
            "detail": detail or {},
        }).execute()
    except Exception as exc:  # never block on audit failure
        logger.warning("audit_log write failed", action=action, error=str(exc))

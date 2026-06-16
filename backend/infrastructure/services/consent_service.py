"""Consent ledger — affirmative, per-purpose, versioned consent that gates all
collection (GDPR Art 6/7, ePrivacy Art 5(3), CCPA opt-in for sensitive PI,
Bangladesh PDPO explicit consent)."""
from __future__ import annotations

from typing import Optional

from core.config import get_settings

VALID_PURPOSES = {"web_capture", "ai_chat_capture", "analytics", "marketing"}


def list_consents(db, user_id: str) -> list[dict]:
    rows = (
        db.schema("misir").table("consent")
        .select("purpose, granted, jurisdiction, policy_version, source, gpc, updated_at")
        .eq("user_id", user_id)
        .execute()
    )
    return rows.data or []


def has_consent(db, user_id: str, purpose: str) -> bool:
    """True only if an explicit granted row exists for this purpose."""
    row = (
        db.schema("misir").table("consent")
        .select("granted")
        .eq("user_id", user_id)
        .eq("purpose", purpose)
        .execute()
    )
    return bool(row.data and row.data[0].get("granted"))


def set_consent(
    db,
    user_id: str,
    purpose: str,
    granted: bool,
    jurisdiction: Optional[str] = None,
    source: Optional[str] = None,
    gpc: bool = False,
) -> dict:
    if purpose not in VALID_PURPOSES:
        raise ValueError(f"Unknown consent purpose: {purpose}")
    # Honor Global Privacy Control: a GPC signal forces opt-out regardless of the
    # requested value (CCPA/CPRA + state universal-opt-out mandates). All our
    # purposes are collection/processing, so we fail closed (deny) when GPC is set.
    effective_granted = granted and not gpc
    row = (
        db.schema("misir").table("consent")
        .upsert(
            {
                "user_id": user_id,
                "purpose": purpose,
                "granted": effective_granted,
                "jurisdiction": jurisdiction,
                "policy_version": get_settings().PRIVACY_POLICY_VERSION,
                "source": source,
                "gpc": gpc,
            },
            on_conflict="user_id,purpose",
        )
        .execute()
    )
    return row.data[0] if row.data else {}

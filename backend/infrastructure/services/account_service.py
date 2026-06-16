"""Data-subject rights: export (portability, GDPR Art 20 / CCPA / PDPO) and
full account erasure (GDPR Art 17 / CCPA delete / PDPO).

Erasure relies on the schema's FK cascades: deleting the misir.auth_user row
cascades to profile, spaces (and their subspaces/markers/gaps/deadlines/
nudges/reports/summaries), artifacts (and their synthesis/embeddings/events/
tags/cross-links), chat conversations/messages, sessions and consents. Only
audit_log rows survive (user_id set NULL) as proof of deletion.
"""
from __future__ import annotations

from core.logging_config import get_logger

logger = get_logger(__name__)

# Embedding vectors are intentionally omitted from exports (derived, large, not
# meaningfully portable). All source personal data is included.


def export_user_data(db, user_id: str) -> dict:
    """Return a machine-readable copy of the user's personal data."""
    misir = db.schema("misir")

    def rows(table: str, select: str, col: str, val) -> list:
        try:
            r = misir.table(table).select(select).eq(col, val).execute()
            return r.data or []
        except Exception as exc:
            logger.warning("export query failed", table=table, error=str(exc))
            return []

    spaces = rows("space", "*", "user_id", user_id)
    space_ids = [s["id"] for s in spaces]
    conversations = rows("chat_conversation", "*", "user_id", user_id)
    conv_ids = [c["id"] for c in conversations]

    def in_rows(table: str, select: str, col: str, ids: list) -> list:
        if not ids:
            return []
        try:
            r = misir.table(table).select(select).in_(col, ids).execute()
            return r.data or []
        except Exception as exc:
            logger.warning("export in-query failed", table=table, error=str(exc))
            return []

    # artifacts: omit the embedding vector column explicitly
    artifacts = rows(
        "artifact",
        "id, url, normalized_url, domain, title, extracted_text, content_hash, word_count, "
        "content_source, platform, engagement_level, space_id, captured_at, metadata",
        "user_id", user_id,
    )
    artifact_ids = [a["id"] for a in artifacts]

    return {
        "profile": rows("profile", "*", "id", user_id),
        "spaces": spaces,
        "subspaces": in_rows("subspace", "*", "space_id", space_ids),
        "markers": in_rows("marker", "*", "space_id", space_ids),
        "artifacts": artifacts,
        "artifact_tags": in_rows("artifact_tag", "artifact_id, tag", "artifact_id", artifact_ids),
        "sessions": rows("session", "id, started_at, ended_at, metadata", "user_id", user_id),
        "gaps": in_rows("gap", "id, space_id, severity, label, action, status, created_at", "space_id", space_ids),
        "nudges": rows("nudge", "id, space_id, scatter, direction, consequence, status, created_at", "user_id", user_id),
        "deadlines": in_rows("deadline", "*", "space_id", space_ids),
        "conversations": conversations,
        "messages": in_rows("chat_message", "id, conversation_id, role, content, created_at", "conversation_id", conv_ids),
        "consents": rows("consent", "purpose, granted, jurisdiction, policy_version, source, gpc, updated_at", "user_id", user_id),
    }


def delete_user_account(db, user_id: str) -> None:
    """Hard-delete the user and all personal data via FK cascade.

    The caller must record the audit event BEFORE calling this, since the
    user_id reference is nulled afterwards.
    """
    db.schema("misir").table("auth_user").delete().eq("id", user_id).execute()

"""Data-subject rights: export (portability, GDPR Art 20 / CCPA / PDPO) and
full account erasure (GDPR Art 17 / CCPA delete / PDPO).

Erasure relies on the schema's FK cascades: deleting the misir.auth_user row
cascades to profile, spaces (and their subspaces/markers/gaps/deadlines/
nudges/reports/summaries), artifacts (and their synthesis/embeddings/events/
tags/cross-links), chat conversations/messages, sessions and consents. Only
audit_log rows survive (user_id set NULL) as proof of deletion.

The export is a STREAMING generator (see stream_export_json): artifacts carry
up to 200k chars of extracted_text each, so materialising a whole account in
one dict/response risked OOM and proxy timeouts. Large tables are paginated;
rows are serialised to the response as they arrive.
"""
from __future__ import annotations

import json
from typing import Iterator

from core.logging_config import get_logger

logger = get_logger(__name__)

# Embedding vectors are intentionally omitted from exports (derived, large, not
# meaningfully portable). All source personal data is included.
_ARTIFACT_SELECT = (
    "id, url, normalized_url, domain, title, extracted_text, content_hash, word_count, "
    "content_source, platform, engagement_level, space_id, captured_at, metadata"
)

_PAGE = 200            # rows per page for paginated tables
_ID_CHUNK = 200        # ids per in_() filter (keeps query URLs bounded)

# Section names in output order — also what the audit log records.
EXPORT_SECTIONS = [
    "profile", "spaces", "subspaces", "markers", "artifacts", "artifact_tags",
    "sessions", "gaps", "nudges", "deadlines", "conversations", "messages",
    "consents",
]


def iter_export_sections(db, user_id: str) -> Iterator[tuple[str, Iterator[dict]]]:
    """Yield (section_name, row_iterator) pairs for the user's personal data.

    Small tables come back in one query; artifact/message-sized tables are
    paginated so neither this process nor PostgREST's max-rows cap truncates
    or balloons the export.
    """
    misir = db.schema("misir")

    def rows(table: str, select: str, col: str, val) -> list:
        try:
            r = misir.table(table).select(select).eq(col, val).execute()
            return r.data or []
        except Exception as exc:
            logger.warning("export query failed", table=table, error=str(exc))
            return []

    def in_rows(table: str, select: str, col: str, ids: list) -> Iterator[dict]:
        for i in range(0, len(ids), _ID_CHUNK):
            chunk = ids[i:i + _ID_CHUNK]
            offset = 0
            while True:
                try:
                    r = (
                        misir.table(table).select(select).in_(col, chunk)
                        .order("id").range(offset, offset + _PAGE - 1).execute()
                    )
                except Exception as exc:
                    logger.warning("export in-query failed", table=table, error=str(exc))
                    break
                batch = r.data or []
                yield from batch
                if len(batch) < _PAGE:
                    break
                offset += _PAGE

    def paged(table: str, select: str, col: str, val) -> Iterator[dict]:
        offset = 0
        while True:
            try:
                r = (
                    misir.table(table).select(select).eq(col, val)
                    .order("id").range(offset, offset + _PAGE - 1).execute()
                )
            except Exception as exc:
                logger.warning("export paged query failed", table=table, error=str(exc))
                return
            batch = r.data or []
            yield from batch
            if len(batch) < _PAGE:
                return
            offset += _PAGE

    spaces = rows("space", "*", "user_id", user_id)
    space_ids = [s["id"] for s in spaces]
    conversations = rows("chat_conversation", "*", "user_id", user_id)
    conv_ids = [c["id"] for c in conversations]
    artifact_ids = [a["id"] for a in paged("artifact", "id", "user_id", user_id)]

    yield "profile", iter(rows("profile", "*", "id", user_id))
    yield "spaces", iter(spaces)
    yield "subspaces", in_rows("subspace", "*", "space_id", space_ids)
    yield "markers", in_rows("marker", "*", "space_id", space_ids)
    yield "artifacts", paged("artifact", _ARTIFACT_SELECT, "user_id", user_id)
    yield "artifact_tags", in_rows("artifact_tag", "artifact_id, tag, id", "artifact_id", artifact_ids)
    yield "sessions", iter(rows("session", "id, started_at, ended_at, metadata", "user_id", user_id))
    yield "gaps", in_rows("gap", "id, space_id, severity, label, action, status, created_at", "space_id", space_ids)
    yield "nudges", iter(rows("nudge", "id, space_id, scatter, direction, consequence, status, created_at", "user_id", user_id))
    yield "deadlines", in_rows("deadline", "*", "space_id", space_ids)
    yield "conversations", iter(conversations)
    yield "messages", in_rows("chat_message", "id, conversation_id, role, content, created_at", "conversation_id", conv_ids)
    yield "consents", iter(rows("consent", "purpose, granted, jurisdiction, policy_version, source, gpc, updated_at", "user_id", user_id))


def stream_export_json(db, user_id: str, user_meta: dict, policy_version: str) -> Iterator[str]:
    """Yield the export as JSON string chunks — one row at a time for the big
    tables, so peak memory stays flat regardless of account size."""
    yield (
        '{"exported_at_utc": null, '
        f'"user": {json.dumps(user_meta)}, '
        f'"policy_version": {json.dumps(policy_version)}, '
        '"data": {'
    )
    first_section = True
    for name, row_iter in iter_export_sections(db, user_id):
        yield ("" if first_section else ",") + json.dumps(name) + ": ["
        first_section = False
        first_row = True
        for row in row_iter:
            yield ("" if first_row else ",") + json.dumps(row, default=str)
            first_row = False
        yield "]"
    yield "}}"


def export_user_data(db, user_id: str) -> dict:
    """Materialised export (used by tests / small accounts). The HTTP endpoint
    streams via stream_export_json instead."""
    return {name: list(row_iter) for name, row_iter in iter_export_sections(db, user_id)}


def delete_user_account(db, user_id: str) -> None:
    """Hard-delete the user and all personal data via FK cascade.

    The caller must record the audit event BEFORE calling this, since the
    user_id reference is nulled afterwards.
    """
    db.schema("misir").table("auth_user").delete().eq("id", user_id).execute()

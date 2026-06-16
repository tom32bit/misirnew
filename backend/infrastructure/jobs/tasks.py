"""Job handlers run by the worker. Each reconstructs args from the JSON payload
and delegates to the same logic the in-process fallback uses, so behaviour is
identical whichever path runs."""
from __future__ import annotations

import asyncio

from core.logging_config import get_logger

logger = get_logger(__name__)


async def handle_post_capture(payload: dict) -> None:
    """Embed + synthesize + cross-link + invalidate caches for one artifact.

    Text is re-read from the stored artifact row (it's the already-redacted
    extracted_text), keeping the queued payload small.
    """
    from domain.entities.common import EngagementLevel
    from infrastructure.services.supabase_client import get_supabase
    from interfaces.api.artifacts import _post_capture_pipeline

    artifact_id = payload["artifact_id"]
    db = get_supabase()
    # No .single() — the artifact may have been deleted between enqueue and
    # processing; treat a missing row as a clean skip rather than an error.
    row = (
        db.schema("misir").table("artifact")
        .select("extracted_text, title")
        .eq("id", artifact_id).limit(1).execute()
    )
    if not row.data:
        logger.debug("post_capture: artifact gone, skipping", artifact_id=artifact_id)
        return
    data = row.data[0]
    text = data.get("extracted_text") or data.get("title") or ""

    try:
        engagement = EngagementLevel(payload.get("engagement", "passive"))
    except ValueError:
        engagement = EngagementLevel.passive

    await _post_capture_pipeline(
        artifact_id=artifact_id,
        user_id=payload["user_id"],
        space_id=payload.get("space_id"),
        text=text,
        engagement=engagement,
        content_source=payload.get("content_source", "web"),
        word_count=payload.get("word_count", 0),
    )


async def handle_embed_gap(payload: dict) -> None:
    from interfaces.api.gaps import _embed_gap
    # _embed_gap is sync (CPU/blocking) — run it off the worker's event loop.
    await asyncio.to_thread(_embed_gap, payload["gap_id"], payload["label"])


HANDLERS = {
    "post_capture": handle_post_capture,
    "embed_gap": handle_embed_gap,
}

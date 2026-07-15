"""
Cross-space link discovery (§2.1, §6).

At capture time: cosine similarity between the new artifact's content_embedding
and every open gap's gap_text_embedding (across all of the user's spaces).
If similarity ≥ threshold AND the gap is in a different space → insert cross_space_link.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

import numpy as np

from core.config import get_settings
from core.logging_config import get_logger
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)


def _cosine(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0


class CrossSpaceLinker:
    async def find_links(self, artifact_id: int, user_id: str, artifact_space_id: int) -> None:
        settings = get_settings()
        threshold = settings.CROSS_SPACE_SIMILARITY_THRESHOLD
        db = get_supabase()

        # Fetch artifact embedding. No .single() — supabase-py raises APIError on
        # 0 rows (artifact deleted between capture and this background step).
        art = db.schema("misir").table("artifact").select("content_embedding").eq("id", artifact_id).limit(1).execute()
        if not art.data or not art.data[0].get("content_embedding"):
            return
        art_vec = art.data[0]["content_embedding"]

        # Fetch all open gaps with embeddings for THIS user (across spaces)
        gaps = (
            db.schema("misir")
            .table("gap")
            .select("id, space_id, gap_text_embedding")
            .neq("space_id", artifact_space_id)
            .neq("status", "resolved")
            .not_.is_("gap_text_embedding", "null")
            .execute()
        )
        if not gaps.data:
            return

        # Filter to gaps in spaces owned by this user
        user_space_ids = {
            s["id"] for s in
            (db.schema("misir").table("space").select("id").eq("user_id", user_id).execute().data or [])
        }

        links = []
        for gap in gaps.data:
            if gap["space_id"] not in user_space_ids:
                continue
            sim = _cosine(art_vec, gap["gap_text_embedding"])
            if sim >= threshold:
                links.append({
                    "user_id": user_id,
                    "source_artifact_id": artifact_id,
                    "target_gap_id": gap["id"],
                    "similarity": round(sim, 4),
                })

        if links:
            db.schema("misir").table("cross_space_link").upsert(
                links,
                on_conflict="source_artifact_id,target_gap_id",
            ).execute()
            logger.info("Cross-space links created", artifact_id=artifact_id, count=len(links))


@lru_cache(maxsize=1)
def get_cross_space_linker() -> CrossSpaceLinker:
    return CrossSpaceLinker()

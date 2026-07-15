"""
Source-hash cache invalidation for Stage A (space_summary) and Stage B (report).

source_hash = sha256(sorted artifact_ids + their content_hashes + open_gap_ids)
If the hash matches the stored row, the cache is fresh and we skip the LLM call.
"""
import hashlib
from typing import Optional
from infrastructure.services.db_async import aexec
from infrastructure.services.supabase_client import get_supabase
from core.logging_config import get_logger

logger = get_logger(__name__)


def _compute_source_hash(artifact_ids: list[int], content_hashes: list[str], gap_ids: list[int]) -> str:
    payload = (
        ",".join(str(i) for i in sorted(artifact_ids))
        + "|"
        + ",".join(sorted(content_hashes))
        + "|"
        + ",".join(str(i) for i in sorted(gap_ids))
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


async def get_stage_a_cache(space_id: int, period: str, source_hash: str) -> Optional[dict]:
    db = get_supabase()
    row = await aexec(
        db.schema("misir")
        .table("space_summary")
        .select("payload")
        .eq("space_id", space_id)
        .eq("period", period)
        .eq("source_hash", source_hash)
    )
    if row.data:
        return row.data[0]["payload"]
    return None


async def set_stage_a_cache(space_id: int, period: str, source_hash: str, payload: dict) -> None:
    db = get_supabase()
    await aexec(db.schema("misir").table("space_summary").upsert(
        {"space_id": space_id, "period": period, "source_hash": source_hash, "payload": payload},
        on_conflict="space_id,period",
    ))


async def get_report_cache(user_id: str, space_id: int, kind: str, period: str, source_hash: str) -> Optional[dict]:
    db = get_supabase()
    row = await aexec(
        db.schema("misir")
        .table("report")
        .select("payload")
        .eq("user_id", user_id)
        .eq("space_id", space_id)
        .eq("kind", kind)
        .eq("period", period)
        .eq("source_hash", source_hash)
    )
    if row.data:
        return row.data[0]["payload"]
    return None


async def get_report_cache_any(user_id: str, space_id: int, kind: str, period: str) -> Optional[dict]:
    """The stored report for this key REGARDLESS of source_hash — i.e. possibly
    STALE. Used for stale-while-revalidate: serve this instantly and rebuild in
    the background instead of blocking the dashboard on an LLM call."""
    db = get_supabase()
    row = await aexec(
        db.schema("misir")
        .table("report")
        .select("payload")
        .eq("user_id", user_id)
        .eq("space_id", space_id)
        .eq("kind", kind)
        .eq("period", period)
    )
    if row.data:
        return row.data[0]["payload"]
    return None


async def set_report_cache(user_id: str, space_id: int, kind: str, period: str, source_hash: str, payload: dict) -> None:
    db = get_supabase()
    await aexec(db.schema("misir").table("report").upsert(
        {"user_id": user_id, "space_id": space_id, "kind": kind, "period": period, "source_hash": source_hash, "payload": payload},
        on_conflict="user_id,space_id,kind,period",
    ))


async def invalidate_space(space_id: int) -> None:
    """Called after artifact capture or gap change — clears Stage A for this space."""
    db = get_supabase()
    await aexec(db.schema("misir").table("space_summary").delete().eq("space_id", space_id))
    logger.info("Cache invalidated", space_id=space_id)

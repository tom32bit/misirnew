"""
Artifact routes.
Phase 2: POST /capture, POST /{id}/engagement, GET /cache
Phase 4: GET /artifacts (search + filter)
"""
# NOTE: deliberately NO `from __future__ import annotations` here. The
# @limiter.limit (slowapi) decorator wraps these endpoints, so FastAPI would
# resolve stringified annotations against slowapi's module globals (where
# CaptureRequest/BackgroundTasks don't exist) and misclassify them as query
# params — yielding 422 "query -> body: Field required". Real annotations avoid it.

import asyncio
import hashlib
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from auth.clerk import CurrentUser, get_current_user
from core.config import get_settings
from core.limiter import limiter
from core.logging_config import get_logger
from domain.entities.common import EngagementLevel, PlatformType
from infrastructure.jobs.queue import enqueue
from infrastructure.services import consent_service
from infrastructure.services.analytics_service import get_analytics
from infrastructure.services.db_async import aexec
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id

router = APIRouter(tags=["artifacts"])
_settings = get_settings()
_log = get_logger(__name__)


def _local_midnight(utc_now, tz_offset_minutes: int):
    """Return UTC datetime equal to local midnight for the given tz_offset.

    tz_offset_minutes is JS Date.getTimezoneOffset() — positive for timezones
    behind UTC (UTC-8 → 480), negative for ahead (UTC+6 → -360).
    """
    from datetime import timedelta
    local_now = utc_now + timedelta(minutes=-tz_offset_minutes)
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight + timedelta(minutes=tz_offset_minutes)


def _compute_window(period: str, date_str, tz_offset_minutes: int, now):
    """Return (since, until) UTC datetimes for the given period or specific date.

    until is None for rolling windows (week/month) — open-ended upper bound.
    For date_str or period="today", until = start of the following local day.
    """
    from datetime import datetime as _dt, timedelta, timezone
    if date_str:
        d = _dt.strptime(date_str, "%Y-%m-%d")
        since = _dt(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(minutes=tz_offset_minutes)
        return since, since + timedelta(days=1)
    elif period == "today":
        since = _local_midnight(now, tz_offset_minutes)
        return since, since + timedelta(days=1)
    elif period == "week":
        return now - timedelta(days=7), None
    elif period == "month":
        return now - timedelta(days=30), None
    else:
        return now - timedelta(days=7), None


def _sanitize_captured_at(raw, now):
    """Clamp a client-supplied capture timestamp to [now - 30d, now].

    30 days generously covers the extension's offline retry queue (5-min alarm,
    plus manually requeued failed saves); anything outside the window is a bug
    or abuse, so it's clamped rather than trusted. Unparseable → server time.
    """
    from datetime import datetime, timedelta, timezone
    if not raw:
        return now.isoformat()
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return now.isoformat()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    earliest = now - timedelta(days=30)
    if dt > now:
        dt = now
    elif dt < earliest:
        dt = earliest
    return dt.isoformat()


# ── Request / response models ─────────────────────────────────────────────────

class CaptureRequest(BaseModel):
    # Length caps bound LLM/embedding cost and storage abuse (resource-exhaustion DoS).
    url: str = Field(..., max_length=4000)
    normalized_url: str = Field(..., max_length=4000)
    domain: Optional[str] = Field(default=None, max_length=255)
    title: Optional[str] = Field(default=None, max_length=2000)
    extracted_text: Optional[str] = Field(default=None, max_length=200_000)
    content_hash: Optional[str] = Field(default=None, max_length=200)
    word_count: int = Field(default=0, ge=0, le=5_000_000)
    content_source: str = "web"          # 'web' | 'ai_chat'
    platform: PlatformType
    engagement_level: EngagementLevel = EngagementLevel.latent
    dwell_time_ms: int = 0
    scroll_depth: float = 0.0
    reading_depth: float = 0.0
    space_id: Optional[int] = None
    # The specific subspace the extension matched on-device (optional — a capture
    # can be confident about the space but not a subspace). Validated to belong to
    # space_id server-side; dropped to NULL if it doesn't.
    subspace_id: Optional[int] = None
    matched_marker_ids: List[int] = Field(default_factory=list, max_length=500)
    tags: List[str] = Field(default_factory=list, max_length=100)
    metadata: dict = {}
    # Client-supplied ISO UTC timestamp — preserves the actual capture moment for
    # offline retries (which would otherwise land with the server's retry time).
    # Falls back to server time if omitted (old extension versions).
    captured_at: Optional[str] = None


class EngagementUpdateRequest(BaseModel):
    engagement_level: EngagementLevel
    dwell_time_ms: int
    scroll_depth: float
    reading_depth: float


# ── POST /artifacts/capture ───────────────────────────────────────────────────

@router.post("/artifacts/capture", status_code=201)
@limiter.limit(_settings.RATE_LIMIT_CAPTURE)
def capture_artifact(
    request: Request,
    body: CaptureRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id, current_user.email)

    # Consent gate (GDPR Art 6/ePrivacy Art 5(3)/CCPA opt-in/BD PDPO): refuse
    # captured content unless the user granted the matching purpose. The
    # extension also gates client-side, but the server must not rely on that.
    if _settings.REQUIRE_CAPTURE_CONSENT:
        purpose = "ai_chat_capture" if body.content_source == "ai_chat" else "web_capture"
        if not consent_service.has_consent(db, user_id, purpose):
            what = "AI-chat capture" if purpose == "ai_chat_capture" else "web capture"
            # Structured, friendly "opt-in required" response (not a bare 403)
            # so clients can show a notice prompting the user to opt in.
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "consent_required",
                    "purpose": purpose,
                    "message": f"Capture is off. Open Misir and opt in to {what} to start saving.",
                },
            )

    # Validate space_id — extension cache can be stale after a space is deleted.
    # Fall back to NULL rather than 500ing on a FK violation.
    space_id = body.space_id
    if space_id is not None:
        owned = db.schema("misir").table("space").select("id").eq("id", space_id).eq("user_id", user_id).execute()
        if not owned.data:
            _log.warning("capture_artifact space_not_found", space_id=space_id, user_id=user_id)
            space_id = None
    # Whether the space the extension asked for was actually honoured — surfaced
    # in the response so the extension knows if its "matched" claim held.
    space_accepted = body.space_id is None or space_id is not None

    # Validate subspace_id the same way: it must belong to the (owned) space, or
    # we drop it. A subspace without a surviving space makes no sense either.
    subspace_id = body.subspace_id
    if subspace_id is not None:
        if space_id is None:
            subspace_id = None
        else:
            sub_owned = (
                db.schema("misir").table("subspace")
                .select("id").eq("id", subspace_id).eq("space_id", space_id)
                .execute()
            )
            if not sub_owned.data:
                _log.warning("capture_artifact subspace_not_found", subspace_id=subspace_id, space_id=space_id, user_id=user_id)
                subspace_id = None

    base_weight = body.engagement_level.base_weight

    from datetime import datetime, timezone
    # Use client-supplied timestamp when available (preserves offline capture
    # time through retries), but CLAMPED to a sane window — an unvalidated
    # timestamp lets a buggy/malicious client backdate artifacts past the
    # retention window or date them into the future. Falls back to server time.
    captured_now = _sanitize_captured_at(body.captured_at, datetime.now(timezone.utc))

    artifact_data = {
        "user_id": user_id,
        "space_id": space_id,
        "subspace_id": subspace_id,
        "captured_at": captured_now,
        "url": body.url,
        "normalized_url": body.normalized_url,
        "domain": body.domain,
        "title": body.title,
        "extracted_text": body.extracted_text,
        "content_hash": body.content_hash,
        "word_count": body.word_count,
        "content_source": body.content_source,
        "platform": body.platform.value,
        "engagement_level": body.engagement_level.value,
        "dwell_time_ms": body.dwell_time_ms,
        "scroll_depth": body.scroll_depth,
        "reading_depth": body.reading_depth,
        "base_weight": base_weight,
        "matched_marker_ids": body.matched_marker_ids,
        "metadata": body.metadata,
    }

    # Check if this URL was already captured by the user.
    # On re-capture: update content/engagement fields but NEVER overwrite
    # captured_at — the original capture date must stay intact so the
    # TodayTimeline doesn't show old articles as new captures.
    def _find_existing():
        return (
            db.schema("misir")
            .table("artifact")
            .select("id")
            .eq("user_id", user_id)
            .eq("normalized_url", body.normalized_url)
            .execute()
        )

    def _update_existing(existing_id: int) -> None:
        update_data = {k: v for k, v in artifact_data.items() if k != "captured_at"}
        db.schema("misir").table("artifact").update(update_data).eq("id", existing_id).execute()

    existing = _find_existing()
    if existing.data:
        artifact_id = existing.data[0]["id"]
        _update_existing(artifact_id)
        artifact = {"id": artifact_id, **artifact_data}
    else:
        try:
            row = db.schema("misir").table("artifact").insert(artifact_data).execute()
            artifact = row.data[0]
            artifact_id = artifact["id"]
        except APIError as exc:
            # A concurrent capture of the same URL won the race between our
            # existence check and this insert (unique idx_artifact_user_url).
            # Fall back to updating the winner's row instead of 500ing.
            if getattr(exc, "code", None) != "23505":
                raise
            existing = _find_existing()
            if not existing.data:
                raise
            artifact_id = existing.data[0]["id"]
            _update_existing(artifact_id)
            artifact = {"id": artifact_id, **artifact_data}

    # Insert open event
    db.schema("misir").table("artifact_open_event").insert({
        "artifact_id": artifact_id,
        "user_id": user_id,
    }).execute()

    # Tags
    if body.tags:
        tag_rows = [{"artifact_id": artifact_id, "tag": t} for t in body.tags]
        db.schema("misir").table("artifact_tag").upsert(tag_rows, on_conflict="artifact_id,tag").execute()

    # Post-capture pipeline: durable Redis queue when enabled (survives
    # ephemeral hosts), else in-process BackgroundTask (unchanged default).
    job = {
        "artifact_id": artifact_id, "user_id": user_id, "space_id": space_id,
        "engagement": body.engagement_level.value,
        "content_source": body.content_source, "word_count": body.word_count,
    }
    if not enqueue("post_capture", job):
        background_tasks.add_task(
            _post_capture_pipeline,
            artifact_id=artifact_id,
            user_id=user_id,
            space_id=space_id,
            text=body.extracted_text or body.title or "",
            engagement=body.engagement_level,
            content_source=body.content_source,
            word_count=body.word_count,
        )

    # Return the artifact row augmented with the resolved space/subspace and
    # whether the requested space survived validation, so the extension can trust
    # (or correct) its local "matched" state. `id` stays for backwards-compat.
    artifact["space_accepted"] = space_accepted

    # Product analytics (best-effort, non-blocking). Metadata only — never the
    # captured content itself.
    get_analytics().capture(
        user_id,
        "artifact_captured",
        {
            "content_source": body.content_source,
            "platform": getattr(body.platform, "value", body.platform),
            "engagement_level": body.engagement_level.value,
            "word_count": body.word_count,
            "space_accepted": space_accepted,
        },
    )
    return artifact


# ── POST /artifacts/{id}/engagement ──────────────────────────────────────────

@router.post("/artifacts/{artifact_id}/engagement")
def update_engagement(
    artifact_id: int,
    body: EngagementUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)

    # Fetch current level to detect upgrade. No .single() — supabase-py raises
    # APIError on 0 rows, which would surface as a 500 instead of this 404.
    existing = db.schema("misir").table("artifact").select("id, engagement_level, space_id, extracted_text, content_source, word_count").eq("id", artifact_id).eq("user_id", user_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Artifact not found")
    art = existing.data[0]

    old_level = art["engagement_level"]
    new_level = body.engagement_level.value
    new_weight = body.engagement_level.base_weight

    db.schema("misir").table("artifact").update({
        "engagement_level": new_level,
        "dwell_time_ms": body.dwell_time_ms,
        "scroll_depth": body.scroll_depth,
        "reading_depth": body.reading_depth,
        "base_weight": new_weight,
    }).eq("id", artifact_id).eq("user_id", user_id).execute()

    # If upgraded from latent to passive or above, queue synthesis
    ENGAGEMENT_ORDER = ["latent", "passive", "active", "deep"]
    if ENGAGEMENT_ORDER.index(new_level) > ENGAGEMENT_ORDER.index(old_level) and old_level == "latent":
        job = {
            "artifact_id": artifact_id, "user_id": user_id,
            "space_id": art.get("space_id"),
            "engagement": body.engagement_level.value,
            "content_source": art.get("content_source", "web"),
            "word_count": art.get("word_count", 0),
        }
        if not enqueue("post_capture", job):
            background_tasks.add_task(
                _post_capture_pipeline,
                artifact_id=artifact_id,
                user_id=user_id,
                space_id=art.get("space_id"),
                text=art.get("extracted_text") or "",
                engagement=body.engagement_level,
                content_source=art.get("content_source", "web"),
                word_count=art.get("word_count", 0),
            )

    return {"id": artifact_id, "engagement_level": new_level}


# ── GET /cache (extension offline bundle) ────────────────────────────────────

@router.get("/cache")
def get_cache(current_user: CurrentUser = Depends(get_current_user)):
    """Returns spaces, subspaces, and markers for extension's Dexie offline cache."""
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)

    spaces = db.schema("misir").table("space").select("*").eq("user_id", user_id).execute()
    space_ids = [s["id"] for s in (spaces.data or [])]

    subspaces_data, markers_data, subspace_markers_data = [], [], []
    if space_ids:
        subspaces = db.schema("misir").table("subspace").select("*").in_("space_id", space_ids).execute()
        markers = db.schema("misir").table("marker").select("*").in_("space_id", space_ids).execute()
        subspaces_data = subspaces.data or []
        markers_data = markers.data or []
        # The subspace→marker junction lets the extension match each subspace on
        # its OWN markers instead of the whole space's — so distinct subspaces
        # (e.g. "guava beverages" vs "common guava varieties") match correctly.
        subspace_ids = [s["id"] for s in subspaces_data]
        if subspace_ids:
            sm = (
                db.schema("misir")
                .table("subspace_marker")
                .select("subspace_id, marker_id")
                .in_("subspace_id", subspace_ids)
                .execute()
            )
            subspace_markers_data = sm.data or []

    return {
        "spaces": spaces.data or [],
        "subspaces": subspaces_data,
        "markers": markers_data,
        "subspace_markers": subspace_markers_data,
    }


# ── GET /artifacts ────────────────────────────────────────────────────────────

@router.get("/artifacts")
def list_artifacts(
    space_id: Optional[int] = Query(None),
    platform: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    period: Optional[str] = Query("week"),
    date: Optional[str] = Query(None),
    tz_offset: int = Query(0),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)

    # Build base query — exclude extracted_text and content_embedding (large fields
    # not needed by the UI; including them in limit=200 calls caused HTTP/2 Server
    # disconnected errors due to multi-MB response payloads).
    query = (
        db.schema("misir")
        .table("artifact")
        .select(
            "id,user_id,space_id,subspace_id,url,normalized_url,domain,title,"
            "content_hash,word_count,content_source,platform,engagement_level,"
            "dwell_time_ms,scroll_depth,reading_depth,base_weight,"
            "matched_marker_ids,metadata,captured_at,updated_at,"
            "artifact_tag(tag),artifact_open_event(count)"
        )
        .eq("user_id", user_id)
    )

    if space_id:
        query = query.eq("space_id", space_id)
    if platform:
        query = query.eq("platform", platform)

    # Period / date filter
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    since, until = _compute_window(period or "week", date, tz_offset, now)
    query = query.gte("captured_at", since.isoformat())
    if until:
        query = query.lt("captured_at", until.isoformat())

    if q:
        # Full-text search over title AND extracted_text (websearch syntax, so
        # raw user input is safe). Commas/parens are stripped — they're the
        # PostgREST or= filter's own separators and would corrupt the filter.
        import re as _re
        safe_q = _re.sub(r"[,()]", " ", q).strip()
        if safe_q:
            query = query.or_(f"title.wfts.{safe_q},extracted_text.wfts.{safe_q}")

    rows = query.order("captured_at", desc=True).range(offset, offset + limit - 1).execute()
    return rows.data or []


# ── DELETE /artifacts/{id} ───────────────────────────────────────────────────

@router.delete("/artifacts/{artifact_id}", status_code=204)
def delete_artifact(artifact_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    existing = db.schema("misir").table("artifact").select("id").eq("id", artifact_id).eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Artifact not found")
    # One atomic delete — source_synthesis, open events, tags, and cross-links
    # all cascade via the schema's ON DELETE CASCADE FKs.
    db.schema("misir").table("artifact").delete().eq("id", artifact_id).eq("user_id", user_id).execute()


# ── Background pipeline ───────────────────────────────────────────────────────

async def _post_capture_pipeline(
    artifact_id: int,
    user_id: str,
    space_id: Optional[int],
    text: str,
    engagement: EngagementLevel,
    content_source: str,
    word_count: int,
):
    """
    Runs after every capture:
    1. Compute content_embedding (always)
    2. Run source_synthesis (if engagement gate passes, §2.2)
    3. Run cross-space linker (§4)
    4. Invalidate space_summary + report cache (§2.1)

    Each step is isolated so a failure in one does not skip the rest.
    """
    from core.logging_config import get_logger
    _log = get_logger(__name__)

    db = get_supabase()

    # 1. Embed — CPU-bound; offload off the event loop so this background task
    # doesn't block concurrent requests while the model runs.
    try:
        if text:
            from infrastructure.services.embedding_service import get_embedding_service
            emb = await asyncio.to_thread(get_embedding_service().embed_text, text)
            await aexec(db.schema("misir").table("artifact").update({"content_embedding": emb.vector}).eq("id", artifact_id))
    except Exception as exc:
        _log.warning("Embedding failed — synthesis will still run", artifact_id=artifact_id, error=str(exc))

    # 2. Synthesis gate (§2.2)
    try:
        should_synthesize = (
            content_source == "ai_chat"
            or word_count >= 200
        )
        if should_synthesize and text:
            from infrastructure.services.synthesis_service import get_synthesis_service
            await get_synthesis_service().synthesize_artifact(artifact_id, text, engagement)
    except Exception as exc:
        _log.error("Synthesis failed", artifact_id=artifact_id, error=str(exc))

    # 3. Cross-space linker
    try:
        if space_id and text:
            from infrastructure.services.cross_space_linker import get_cross_space_linker
            await get_cross_space_linker().find_links(artifact_id, user_id, space_id)
    except Exception as exc:
        _log.error("Cross-space linker failed", artifact_id=artifact_id, error=str(exc))

    # 4. Invalidate caches
    try:
        if space_id:
            from infrastructure.services.report_cache import invalidate_space
            await invalidate_space(space_id)
    except Exception as exc:
        _log.error("Cache invalidation failed", artifact_id=artifact_id, error=str(exc))

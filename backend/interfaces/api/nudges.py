"""Nudge routes (Phase 6)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from core.logging_config import get_logger
from infrastructure.services.db_async import aexec
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id

router = APIRouter(tags=["nudges"])
logger = get_logger(__name__)


class NudgePatch(BaseModel):
    status: str  # 'dismissed' | 'acted'


@router.get("/nudges")
async def list_nudges(
    status: Optional[str] = Query("active"),
    space_id: Optional[int] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)

    # Refresh nudges whenever the notifications page loads with a space filter.
    # This ensures fresh domain-specific text and correct cooldown enforcement.
    if space_id and status == "active":
        try:
            from infrastructure.services.nudge_engine import refresh_nudges_for_space
            await refresh_nudges_for_space(user_id, space_id)
        except Exception as exc:
            logger.warning("Nudge refresh failed on list", error=str(exc))

    query = db.schema("misir").table("nudge").select("*").eq("user_id", user_id)
    if status:
        query = query.eq("status", status)
    if space_id:
        query = query.eq("space_id", space_id)
    rows = await aexec(query.order("priority", desc=True).order("generated_at", desc=True))
    return rows.data or []


@router.patch("/nudges/{nudge_id}")
def patch_nudge(nudge_id: int, body: NudgePatch, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    if body.status not in ("dismissed", "acted"):
        raise HTTPException(status_code=400, detail="status must be 'dismissed' or 'acted'")
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    updates: dict = {"status": body.status, "updated_at": now_iso}
    if body.status == "dismissed":
        updates["dismissed_at"] = now_iso
    row = db.schema("misir").table("nudge").update(updates).eq("id", nudge_id).eq("user_id", user_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Nudge not found")
    return row.data[0]

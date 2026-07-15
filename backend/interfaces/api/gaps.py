"""
Gap routes (Phase 3 CRUD + Phase 6 full logic).

Phase 3: basic CRUD
Phase 6: recurring detection + gap_text_embedding + cross-space discovery
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from infrastructure.jobs.queue import enqueue
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id
from interfaces.api.subspaces import _assert_space_owned

router = APIRouter(tags=["gaps"])


class GapCreate(BaseModel):
    severity: str = "Medium"
    label: str
    action: Optional[str] = None
    subspace_id: Optional[int] = None


class GapUpdate(BaseModel):
    severity: Optional[str] = None
    label: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = None


@router.get("/spaces/{space_id}/gaps")
def list_gaps(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    rows = db.schema("misir").table("gap").select("*").eq("space_id", space_id).neq("status", "resolved").order("severity").execute()
    return rows.data or []


@router.post("/spaces/{space_id}/gaps", status_code=201)
def create_gap(
    space_id: int,
    body: GapCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)

    # Validate the optional subspace scoping belongs to this space; drop if not.
    subspace_id = body.subspace_id
    if subspace_id is not None:
        owned = (
            db.schema("misir").table("subspace")
            .select("id").eq("id", subspace_id).eq("space_id", space_id)
            .execute()
        )
        if not owned.data:
            subspace_id = None

    row = db.schema("misir").table("gap").insert({
        "space_id": space_id,
        "subspace_id": subspace_id,
        "severity": body.severity,
        "label": body.label,
        "action": body.action,
    }).execute()
    gap = row.data[0]
    # Compute gap_text_embedding off-request: durable queue if enabled, else BackgroundTask.
    if not enqueue("embed_gap", {"gap_id": gap["id"], "label": body.label}):
        background_tasks.add_task(_embed_gap, gap["id"], body.label)
    return gap


@router.patch("/spaces/{space_id}/gaps/{gap_id}")
def update_gap(space_id: int, gap_id: int, body: GapUpdate, current_user: CurrentUser = Depends(get_current_user)):
    from datetime import datetime, timezone
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)

    # Fetch the gap before updating so we have its label
    existing = db.schema("misir").table("gap").select("label").eq("id", gap_id).eq("space_id", space_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Gap not found")
    gap_label = existing.data[0].get("label", "unknown gap")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    row = db.schema("misir").table("gap").update(updates).eq("id", gap_id).eq("space_id", space_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Gap not found")

    if body.status == "resolved":
        now_iso = datetime.now(timezone.utc).isoformat()

        # Dismiss any active nudge that references this gap
        active = (
            db.schema("misir").table("nudge")
            .select("id, evidence_data")
            .eq("user_id", user_id)
            .eq("space_id", space_id)
            .eq("status", "active")
            .execute()
        )
        for n in (active.data or []):
            if str((n.get("evidence_data") or {}).get("gap_id", "")) == str(gap_id):
                db.schema("misir").table("nudge").update({
                    "status": "dismissed",
                    "dismissed_at": now_iso,
                    "updated_at": now_iso,
                }).eq("id", n["id"]).execute()

        # Insert a "gap resolved" success nudge
        # No .single() — supabase-py raises APIError on 0 rows.
        space_row = db.schema("misir").table("space").select("name").eq("id", space_id).limit(1).execute()
        space_name = (space_row.data[0] if space_row.data else {}).get("name", "your research")
        db.schema("misir").table("nudge").insert({
            "user_id": user_id,
            "space_id": space_id,
            "scatter": f"You closed the gap \"{gap_label}\" in your {space_name} research.",
            "direction": f"Connect what you learned about \"{gap_label}\" to the remaining open areas in your research.",
            "consequence": f"Closing this gap strengthens the foundation of your {space_name} work — build on it.",
            "cta_label": "Gap closed ✓",
            "priority": 1,
            "evidence_data": {"gap_id": gap_id, "resolved": True},
            "requires_deadline": False,
        }).execute()

    return row.data[0]


def _embed_gap(gap_id: int, label: str):
    """Background: compute gap_text_embedding for cross-space link discovery."""
    try:
        from infrastructure.services.embedding_service import get_embedding_service
        svc = get_embedding_service()
        result = svc.embed_text(label)
        db = get_supabase()
        db.schema("misir").table("gap").update({"gap_text_embedding": result.vector}).eq("id", gap_id).execute()
    except Exception as exc:
        from core.logging_config import get_logger
        get_logger(__name__).error("Failed to embed gap", gap_id=gap_id, error=str(exc))

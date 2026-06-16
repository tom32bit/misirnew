"""Deadline routes (Phase 3)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id
from interfaces.api.subspaces import _assert_space_owned

router = APIRouter(tags=["deadlines"])


class DeadlineUpsert(BaseModel):
    label: str
    due_at: datetime
    target_pct: int = 80


@router.get("/spaces/{space_id}/deadline")
def get_deadline(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    """Returns the deadline or null if none set."""
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    row = db.schema("misir").table("deadline").select("*").eq("space_id", space_id).eq("user_id", user_id).execute()
    return row.data[0] if row.data else None


@router.put("/spaces/{space_id}/deadline")
def upsert_deadline(space_id: int, body: DeadlineUpsert, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    row = db.schema("misir").table("deadline").upsert(
        {
            "user_id": user_id,
            "space_id": space_id,
            "label": body.label,
            "due_at": body.due_at.isoformat(),
            "target_pct": body.target_pct,
        },
        on_conflict="user_id,space_id",
    ).execute()
    return row.data[0]


@router.delete("/spaces/{space_id}/deadline", status_code=204)
def delete_deadline(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    db.schema("misir").table("deadline").delete().eq("space_id", space_id).eq("user_id", user_id).execute()

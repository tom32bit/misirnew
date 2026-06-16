"""Inbox — past Misir chat conversations (Phase 4)."""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id

router = APIRouter(tags=["inbox"])


@router.get("/inbox")
def list_conversations(
    space_id: Optional[int] = Query(None),
    limit: int = Query(30, le=100),
    offset: int = Query(0),
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    query = (
        db.schema("misir")
        .table("chat_conversation")
        .select("id, title, space_id, created_at, updated_at")
        .eq("user_id", user_id)
        .is_("archived_at", "null")
    )
    if space_id:
        query = query.eq("space_id", space_id)
    rows = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
    return rows.data or []

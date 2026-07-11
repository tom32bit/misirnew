"""Inbox — past Misir chat conversations (Phase 4)."""
from fastapi import APIRouter, Depends, HTTPException, Query
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
        # last_read_at lets the client compute real unread (updated_at newer).
        .select("id, title, space_id, created_at, updated_at, last_read_at")
        .eq("user_id", user_id)
        .is_("archived_at", "null")
    )
    if space_id:
        query = query.eq("space_id", space_id)
    rows = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
    return rows.data or []


@router.post("/inbox/{conversation_id}/read")
def mark_conversation_read(
    conversation_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark a conversation read (the user opened it) — clears its unread state."""
    from datetime import datetime, timezone
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    row = (
        db.schema("misir")
        .table("chat_conversation")
        .update({"last_read_at": now_iso})
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"id": conversation_id, "last_read_at": now_iso}

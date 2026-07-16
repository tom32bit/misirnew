"""Inbox — past Misir chat conversations (Phase 4)."""
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id

router = APIRouter(tags=["inbox"])

# Enough to fill one clamped line in the inbox; the full text lives in the thread.
PREVIEW_CHARS = 160

# Misir replies in markdown. The inbox renders the preview as plain text, so the
# syntax has to come off or the line reads "**Formula Two (F2)** is the...".
_MD_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")      # [label](url) -> label
_MD_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")      # drop images entirely
_MD_FENCE = re.compile(r"```[\s\S]*?```")            # drop fenced code blocks
_MD_MARKS = re.compile(r"[*_`~]+")                   # bold/italic/code/strike
_MD_LEAD = re.compile(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+", re.MULTILINE)


def _preview(text: str) -> str:
    """One-line, plain-text snippet of a markdown message."""
    s = _MD_FENCE.sub(" ", text or "")
    s = _MD_IMAGE.sub(" ", s)
    s = _MD_LINK.sub(r"\1", s)
    s = _MD_LEAD.sub("", s)
    s = _MD_MARKS.sub("", s)
    flat = " ".join(s.split())
    if len(flat) <= PREVIEW_CHARS:
        return flat
    return flat[:PREVIEW_CHARS].rsplit(" ", 1)[0] + "…"


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
    convs = rows.data or []
    if not convs:
        return []

    # The inbox row shows what was last said and whose turn it is, so each
    # conversation needs its newest message. PostgREST can't do a per-group
    # LIMIT 1, so fetch this page's messages newest-first and keep the first
    # hit per conversation — bounded by the page size (<=100 conversations).
    ids = [c["id"] for c in convs]
    msgs = (
        db.schema("misir")
        .table("chat_message")
        .select("conversation_id, role, content, created_at")
        .in_("conversation_id", ids)
        .order("created_at", desc=True)
        .execute()
    )
    last: dict[int, dict] = {}
    first_user: dict[int, str] = {}
    counts: dict[int, int] = {}
    for m in msgs.data or []:
        cid = m["conversation_id"]
        counts[cid] = counts.get(cid, 0) + 1
        if cid not in last:
            last[cid] = m
        if m["role"] == "user":
            # Rows come newest-first, so the last user message seen is the oldest.
            first_user[cid] = m["content"]

    for c in convs:
        cid = c["id"]
        m = last.get(cid)
        # Titling used to store "" on failure; normalise so clients only ever
        # branch on null. Until a thread is named, its opening line stands in.
        c["title"] = (c.get("title") or "").strip() or None
        c["last_message_role"] = m["role"] if m else None
        c["last_message_preview"] = _preview(m["content"]) if m else None
        c["opening_message"] = _preview(first_user.get(cid, "")) or None
        c["message_count"] = counts.get(cid, 0)

    return convs


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

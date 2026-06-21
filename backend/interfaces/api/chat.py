"""
Chat routes — SSE streaming (Phase 7).
GET /chat/{id}/messages
POST /chat/{id}/messages  (SSE stream)
POST /chat               (create new conversation)
"""
# NOTE: no `from __future__ import annotations` — see artifacts.py. The
# @limiter.limit decorator + stringified annotations make FastAPI misclassify
# the request body / BackgroundTasks as query params (422 "Field required").

import json
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth.clerk import CurrentUser, get_current_user
from core.config import get_settings
from core.limiter import limiter
from infrastructure.services.db_async import aexec
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id
from interfaces.api.subspaces import _assert_space_owned

router = APIRouter(tags=["chat"])
_settings = get_settings()


class ConversationCreate(BaseModel):
    space_id: Optional[int] = None
    title: Optional[str] = Field(default=None, max_length=200)


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)


@router.post("/chat", status_code=201)
def create_conversation(body: ConversationCreate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    # IDOR guard: only let the caller attach a space they actually own, else the
    # conversation (stored under THIS user) would pull a victim's space context.
    if body.space_id is not None:
        _assert_space_owned(db, body.space_id, user_id)
    row = db.schema("misir").table("chat_conversation").insert({
        "user_id": user_id,
        "space_id": body.space_id,
        "title": body.title,
    }).execute()
    return row.data[0]


@router.get("/chat/{conversation_id}/messages")
def list_messages(conversation_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    # Verify ownership
    conv = db.schema("misir").table("chat_conversation").select("id").eq("id", conversation_id).eq("user_id", user_id).single().execute()
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = db.schema("misir").table("chat_message").select("*").eq("conversation_id", conversation_id).order("created_at").execute()
    return rows.data or []


@router.delete("/chat/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    conv = db.schema("misir").table("chat_conversation").select("id").eq("id", conversation_id).eq("user_id", user_id).execute()
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.schema("misir").table("chat_message").delete().eq("conversation_id", conversation_id).execute()
    db.schema("misir").table("chat_conversation").delete().eq("id", conversation_id).eq("user_id", user_id).execute()


@router.post("/chat/{conversation_id}/messages")
@limiter.limit(_settings.RATE_LIMIT_LLM)
async def send_message(
    request: Request,
    conversation_id: int,
    body: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
):
    """SSE streaming response. Client reads `data: ...` lines."""
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)

    conv = await aexec(db.schema("misir").table("chat_conversation").select("id, space_id").eq("id", conversation_id).eq("user_id", user_id).single())
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Persist user message
    await aexec(db.schema("misir").table("chat_message").insert({
        "conversation_id": conversation_id,
        "role": "user",
        "content": body.content,
    }))

    return StreamingResponse(
        _stream_response(conversation_id, user_id, conv.data["space_id"], body.content, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_response(
    conversation_id: int,
    user_id: str,
    space_id: Optional[int],
    user_message: str,
    db,
) -> AsyncGenerator[str, None]:
    from application.handlers.chat_handler import stream_chat_response
    full_response = ""
    async for chunk in stream_chat_response(conversation_id, user_id, space_id, user_message, db):
        full_response += chunk
        yield f"data: {json.dumps({'delta': chunk})}\n\n"

    # Persist assistant message
    await aexec(db.schema("misir").table("chat_message").insert({
        "conversation_id": conversation_id,
        "role": "misir",
        "content": full_response,
    }))

    # Auto-title on first exchange
    msg_count = await aexec(db.schema("misir").table("chat_message").select("id", count="exact").eq("conversation_id", conversation_id))
    if (msg_count.count or 0) <= 2:
        from application.handlers.chat_handler import auto_title
        title = await auto_title(user_message, full_response)
        await aexec(db.schema("misir").table("chat_conversation").update({"title": title}).eq("id", conversation_id))

    yield f"data: {json.dumps({'done': True})}\n\n"

"""
Chat handler — builds context and streams response.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

from core.config import get_settings
from core.logging_config import get_logger
from infrastructure.services.db_async import aexec
from infrastructure.services.groq_client import get_groq_client, TaskPriority
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)
settings = get_settings()

# Titling budget. Reasoning models burn tokens on hidden chain-of-thought
# before the first visible token, so this has to cover the thinking too. The
# old value of 20 always truncated mid-thought (finish_reason="length") and
# returned "" — measured: 256 still truncates on vaguer prompts, 512 lands.
# The title itself is ~8 tokens; the rest is headroom for the thinking.
TITLE_MAX_TOKENS = 512
TITLE_MAX_CHARS = 70


class ChatStreamError(Exception):
    """Raised when the chat stream cannot run/complete. The message is
    USER-SAFE — it is sent to the client verbatim in an SSE error frame;
    internal details must go to the log only."""


CHAT_SYSTEM = """\
You are Misir — a research intelligence assistant for founders.
You have deep context about the user's research: their spaces, artifacts, gaps, and goals.
Speak directly. No hedging. Reference specific evidence from the context.
When you cite something, be specific (artifact title, gap label, platform)."""


async def _build_context(user_id: str, space_id: Optional[int], db) -> str:
    parts = []

    # Spaces overview. Only claim an "Active space" when the conversation is
    # actually attached to one — presenting the user's first space as active in
    # a general chat fed the LLM misleading context.
    spaces = await aexec(db.schema("misir").table("space").select("id, name, goal").eq("user_id", user_id))
    if spaces.data:
        active_space = next((s for s in spaces.data if s["id"] == space_id), None) if space_id else None
        if active_space:
            parts.append(f"Active space: \"{active_space['name']}\" — goal: {active_space.get('goal') or 'not set'}")
        else:
            names = ", ".join(f"\"{s['name']}\"" for s in spaces.data[:10])
            parts.append(f"General chat (no active space). The user's spaces: {names}")

    if space_id:
        # Recent artifacts
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        arts = await aexec(
            db.schema("misir")
            .table("artifact")
            .select("id, title, platform, engagement_level, captured_at")
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .gte("captured_at", since)
            .order("base_weight", desc=True)
            .limit(settings.STAGE_A_K_WEEK)
        )
        if arts.data:
            art_lines = [f"- [{a['platform']}] {a.get('title') or 'Untitled'} (engagement:{a['engagement_level']})" for a in arts.data]
            parts.append("Recent artifacts (last 30 days):\n" + "\n".join(art_lines[:15]))

        # Open gaps
        gaps = await aexec(db.schema("misir").table("gap").select("label, severity, status").eq("space_id", space_id).neq("status", "resolved"))
        if gaps.data:
            parts.append("Open gaps:\n" + "\n".join(f"- [{g['severity']}] {g['label']}" for g in gaps.data))

        # Deadline — nearest first (deterministic if several exist), and say
        # OVERDUE instead of emitting a negative day count.
        dl = await aexec(
            db.schema("misir").table("deadline").select("label, due_at")
            .eq("space_id", space_id).eq("user_id", user_id)
            .order("due_at").limit(1)
        )
        if dl.data:
            due = datetime.fromisoformat(dl.data[0]["due_at"].replace("Z", "+00:00"))
            days = (due - datetime.now(timezone.utc)).days
            if days >= 0:
                parts.append(f"Upcoming deadline: {days} days to {dl.data[0]['label']}")
            else:
                parts.append(f"Deadline OVERDUE by {-days} days: {dl.data[0]['label']}")

    return "\n\n".join(parts)


def _prepare_history(rows_newest_first: list[dict], user_message: str) -> list[dict]:
    """Newest-first DB rows → chronological LLM messages, guaranteed to end
    with the current user message exactly once.

    The route persists the incoming user message BEFORE streaming, so history
    normally already ends with it — appending unconditionally would send it to
    the LLM twice. It's only appended when genuinely missing (e.g. the insert
    failed)."""
    messages = [
        {"role": "user" if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in reversed(rows_newest_first or [])
    ]
    if not (
        messages
        and messages[-1]["role"] == "user"
        and messages[-1]["content"] == user_message
    ):
        messages.append({"role": "user", "content": user_message})
    return messages


async def stream_chat_response(
    conversation_id: int,
    user_id: str,
    space_id: Optional[int],
    user_message: str,
    db,
) -> AsyncGenerator[str, None]:
    groq = get_groq_client()
    model = settings.CHAT_LLM_MODEL or settings.LLM_MODEL

    # Build context
    context = await _build_context(user_id, space_id, db)

    # Fetch the MOST RECENT history: descending + limit, then reverse back to
    # chronological. Ascending + limit would return the oldest N messages and
    # silently drop all recent turns once a conversation outgrows the limit.
    history = await aexec(
        db.schema("misir")
        .table("chat_message")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=True)
        .limit(settings.CHAT_MAX_HISTORY_MESSAGES)
    )
    messages = [
        {"role": "system", "content": f"{CHAT_SYSTEM}\n\n--- Research Context ---\n{context}"},
        *_prepare_history(history.data or [], user_message),
    ]

    if not groq.is_available:
        raise ChatStreamError("Chat is not configured on this server.")

    try:
        async for chunk in groq.chat_completion_stream(
            messages,
            model=model,
            max_tokens=settings.CHAT_MAX_RESPONSE_TOKENS,
            temperature=0.7,
            priority=TaskPriority.CHAT,
        ):
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content
    except Exception as exc:
        # Log the real error server-side; send only a user-safe message. The
        # route turns this into a `data: {"error": ...}` SSE frame — yielding
        # the text here would persist it as assistant content and never trigger
        # the frontend's error/retry UI.
        logger.error("Chat stream failed", conversation_id=conversation_id, error=str(exc))
        raise ChatStreamError("Misir couldn't finish that reply. Try again.") from exc


def fallback_title(user_message: str) -> str:
    """A readable title derived from the user's own words.

    Used whenever the model can't supply one. Never returns "" — an empty
    title reads as a bug in the inbox, so fall back to a fixed label instead.
    """
    text = " ".join((user_message or "").split())
    if not text:
        return "New conversation"
    # First sentence, if there's a natural break early enough to still be a title.
    for stop in (". ", "? ", "! "):
        head, sep, _ = text.partition(stop)
        if sep and len(head) <= TITLE_MAX_CHARS:
            text = head
            break
    text = text.rstrip("?.!,;: ")
    if len(text) > TITLE_MAX_CHARS:
        text = text[:TITLE_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",;: ") + "…"
    return text or "New conversation"


def _clean_title(raw: str) -> str:
    """Normalise a model-written title; "" means unusable."""
    text = " ".join((raw or "").split())
    # Models like to wrap titles in quotes or prefix them with "Title:".
    if ":" in text[:12] and text.split(":", 1)[0].strip().lower() in {"title", "conversation title"}:
        text = text.split(":", 1)[1]
    text = " ".join(text.split()).strip("\"'“”‘’ ").rstrip(".")
    if len(text) > TITLE_MAX_CHARS:
        text = text[:TITLE_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",;: ") + "…"
    return text


async def auto_title(user_message: str, assistant_response: str) -> str:
    """Generate a short conversation title from the first exchange.

    Always returns a non-empty title. LLM_MODEL is a reasoning model (Qwen3):
    it spends tokens on hidden chain-of-thought before emitting any visible
    content, so a small max_tokens gets truncated (finish_reason="length")
    and returns "" — not an error. Hence the generous budget and the explicit
    empty check: a silent "" here is what put blank rows in the inbox.
    """
    groq = get_groq_client()
    if not groq.is_available:
        return fallback_title(user_message)
    try:
        resp = await groq.chat_completion(
            [
                {"role": "system", "content": "Generate a 5-8 word title for this conversation. Return only the title, no punctuation."},
                {"role": "user", "content": f"User: {user_message[:200]}\nAssistant: {assistant_response[:200]}"},
            ],
            max_tokens=TITLE_MAX_TOKENS,
            temperature=0.3,
            priority=TaskPriority.SYNTHESIS,
        )
        title = _clean_title(resp.choices[0].message.content or "")
        return title or fallback_title(user_message)
    except Exception:
        return fallback_title(user_message)

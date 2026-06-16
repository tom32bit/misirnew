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

CHAT_SYSTEM = """\
You are Misir — a research intelligence assistant for founders.
You have deep context about the user's research: their spaces, artifacts, gaps, and goals.
Speak directly. No hedging. Reference specific evidence from the context.
When you cite something, be specific (artifact title, gap label, platform).
Do not reveal that you are an AI or that you have limitations."""


async def _build_context(user_id: str, space_id: Optional[int], db) -> str:
    parts = []

    # Spaces overview
    spaces = await aexec(db.schema("misir").table("space").select("id, name, goal").eq("user_id", user_id))
    if spaces.data:
        active_space = next((s for s in spaces.data if s["id"] == space_id), spaces.data[0]) if space_id else spaces.data[0]
        parts.append(f"Active space: \"{active_space['name']}\" — goal: {active_space.get('goal') or 'not set'}")

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

        # Deadline
        dl = await aexec(db.schema("misir").table("deadline").select("label, due_at").eq("space_id", space_id).eq("user_id", user_id))
        if dl.data:
            due = datetime.fromisoformat(dl.data[0]["due_at"].replace("Z", "+00:00"))
            days = (due - datetime.now(timezone.utc)).days
            parts.append(f"Upcoming deadline: {days} days to {dl.data[0]['label']}")

    return "\n\n".join(parts)


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

    # Fetch history
    history = await aexec(
        db.schema("misir")
        .table("chat_message")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .limit(settings.CHAT_MAX_HISTORY_MESSAGES)
    )
    history_messages = [
        {"role": "user" if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in (history.data or [])
    ]

    messages = [
        {"role": "system", "content": f"{CHAT_SYSTEM}\n\n--- Research Context ---\n{context}"},
        *history_messages,
        {"role": "user", "content": user_message},
    ]

    if not groq.is_available:
        yield "Groq is not configured. Please set GROQ_API_KEY."
        return

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
        logger.error("Chat stream failed", conversation_id=conversation_id, error=str(exc))
        yield f"\n\n[Error: {exc}]"


async def auto_title(user_message: str, assistant_response: str) -> str:
    """Generate a short conversation title from the first exchange."""
    groq = get_groq_client()
    if not groq.is_available:
        return user_message[:60]
    try:
        resp = await groq.chat_completion(
            [
                {"role": "system", "content": "Generate a 5-8 word title for this conversation. Return only the title, no punctuation."},
                {"role": "user", "content": f"User: {user_message[:200]}\nAssistant: {assistant_response[:200]}"},
            ],
            max_tokens=20,
            temperature=0.3,
            priority=TaskPriority.SYNTHESIS,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return user_message[:60]

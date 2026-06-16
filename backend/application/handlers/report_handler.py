"""
Report handler — Stage B composition.

Orchestrates: Stage A (per-space) → Stage B (four report kinds) →
assembles the full dashboard payload.

Dashboard payload shape matches the mock data exactly so frontend
components just replace their import.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.config import get_settings
from core.logging_config import get_logger
from infrastructure.services.confidence_service import (
    compute_readiness,
    compute_research_depth_pct,
    compute_theme_confidence,
)
from infrastructure.services.db_async import aexec
from infrastructure.services.groq_client import get_groq_client, TaskPriority
from infrastructure.services.report_cache import (
    get_report_cache,
    set_report_cache,
)
from infrastructure.services.synthesis_service import run_stage_a
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)
settings = get_settings()

# ── Stage B prompts ──────────────────────────────────────────────────────────

MISIR_READ_SYSTEM = """\
You are Misir. Write a concise research read for the founder.
Respond in JSON:
{
  "headline": "<≤20 words — the one thing they need to hear today>",
  "points": [
    {"label": "<bold label>", "body": "<1-2 sentences>", "accent": <bool>}
  ]
}
Rules:
- headline should reference the most urgent finding.
- If a deadline exists, open headline with "{days} days to {label}.".
- Maximum 3 points. Mark accent=true on the single most urgent point.
- Do NOT output any percentages, ratios, or numbers."""

COMPARISON_SYSTEM = """\
You are Misir. Synthesise source insights into a comparison payload.
Respond in JSON:
{
  "key_tension": {
    "points": [{"label": "<source:>", "text": "<claim>", "num": "<01/02/03>"}],
    "edge": "<1 sentence — the untested opportunity>",
    "meta": "<provenance string>"
  },
  "synthesis": {
    "consensus": "<what all sources agree on>",
    "conflict": "<where sources diverge>",
    "blindspot": "<what none of the research covers>"
  }
}
Rules:
- Do NOT output any percentages or numbers.
- key_tension.points should reflect real tension between the sources provided."""

DECISION_SYSTEM = """\
You are Misir, a research assistant. Based on the user's space goal and open knowledge gaps,
derive two meaningful research strategy options and write pros/cons for each.
Respond in JSON:
{
  "option_a": {
    "label": "<action-oriented label — 3-5 words specific to the domain>",
    "pros": ["<string>", ...],
    "cons": ["<string>", ...]
  },
  "option_b": {
    "label": "<action-oriented label — 3-5 words specific to the domain>",
    "pros": ["<string>", ...],
    "cons": ["<string>", ...]
  }
}
Rules:
- Derive the two options from the space goal and open gaps (e.g. "Go Deep on Fundamentals" vs "Explore Applications").
- Labels must be specific to the research domain — never use generic startup language like "Raise Series A" or "Extend Runway".
- Maximum 4 pros and 4 cons per option.
- If requires_deadline=false, do NOT reference specific timing or deadlines.
- Do NOT output any percentages or numbers."""


def _extract_ai_chat_insight(extracted_text: str, max_len: int = 280) -> str:
    """Return the first meaningful Assistant turn from serialised AI-chat text.

    Serialised format (from chatCaptureToText):
      [PLATFORM — title]

      User: ...
      Assistant: ...
    """
    for line in extracted_text.split('\n'):
        if line.startswith('Assistant: '):
            content = line[len('Assistant: '):].strip()
            # Strip markdown bold markers the LLM sometimes leaves in
            content = content.replace('**', '').strip()
            if len(content) > max_len:
                content = content[:max_len].rsplit(' ', 1)[0].rstrip(',:;') + '…'
            if content:
                return content
    # Fallback: first non-header, non-user line
    for line in extracted_text.split('\n'):
        stripped = line.strip()
        if stripped and not stripped.startswith('[') and not stripped.startswith('User:'):
            return stripped[:max_len]
    return extracted_text[:max_len]


async def get_dashboard_payload(user_id: str, space_id: int, period: str, db) -> dict:
    """
    Full dashboard payload. One DB call returns everything the four tabs need.
    Backed by Stage A + Stage B caches.
    """
    # ── Fetch context ────────────────────────────────────────────────────────
    space_row = await aexec(db.schema("misir").table("space").select("name, goal, description").eq("id", space_id).single())
    space = space_row.data or {}

    deadline_row = await aexec(db.schema("misir").table("deadline").select("*").eq("space_id", space_id).eq("user_id", user_id))
    deadline = deadline_row.data[0] if deadline_row.data else None

    gaps_row = await aexec(db.schema("misir").table("gap").select("*").eq("space_id", space_id).neq("status", "resolved"))
    gaps = gaps_row.data or []

    # Refresh nudges before reading so this response gets fresh nudges
    try:
        from infrastructure.services.nudge_engine import refresh_nudges_for_space
        await refresh_nudges_for_space(user_id, space_id)
    except Exception as exc:
        logger.warning("Nudge refresh failed", error=str(exc))

    nudges_row = await aexec(db.schema("misir").table("nudge").select("*").eq("user_id", user_id).eq("space_id", space_id).eq("status", "active").order("priority", desc=True).limit(5))
    nudges = nudges_row.data or []

    # ── Period window ────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    if period == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        since = now - timedelta(days=7)
    else:
        since = now - timedelta(days=30)

    # ── Artifacts for this period ────────────────────────────────────────────
    arts_row = await aexec(
        db.schema("misir")
        .table("artifact")
        .select("id, title, platform, engagement_level, base_weight, captured_at, content_hash, extracted_text, content_source, word_count")
        .eq("space_id", space_id)
        .gte("captured_at", since.isoformat())
    )
    artifacts = arts_row.data or []

    # ── Stage A ──────────────────────────────────────────────────────────────
    stage_a = await run_stage_a(space_id, period, db)

    # Auto-create gaps from Stage A open_questions (if not already present)
    if stage_a and stage_a.get("open_questions"):
        existing_gaps = await aexec(db.schema("misir").table("gap").select("label").eq("space_id", space_id))
        existing_labels = {g["label"].strip().lower() for g in (existing_gaps.data or [])}
        new_gaps = [
            {"space_id": space_id, "severity": "Medium", "label": q, "status": "open"}
            for q in stage_a["open_questions"]
            if q.strip().lower() not in existing_labels
        ]
        if new_gaps:
            await aexec(db.schema("misir").table("gap").insert(new_gaps))

    # ── source_synthesis aggregation by platform ──────────────────────────────
    artifact_ids = [a["id"] for a in artifacts]
    synth_rows = await aexec(
        db.schema("misir")
        .table("source_synthesis")
        .select("artifact_id, top_insight, themes, unique_signal")
        .in_("artifact_id", artifact_ids)
    )
    synth_by_id = {s["artifact_id"]: s for s in (synth_rows.data or [])}

    # Re-trigger synthesis for:
    # - artifacts with no synthesis row at all
    # - artifacts whose synthesis row has empty themes (LLM returned [] on first pass)
    # Fires-and-forgets so it doesn't block the current response.
    art_by_id = {a["id"]: a for a in artifacts}
    needs_synthesis = [
        a["id"] for a in artifacts
        if a["id"] not in synth_by_id
        or not (synth_by_id[a["id"]].get("themes") or [])
    ]
    if needs_synthesis:
        async def _bg_synthesize(art_id: int) -> None:
            try:
                art = art_by_id.get(art_id, {})
                text = art.get("extracted_text") or art.get("title") or ""
                if not text:
                    return
                from domain.entities.common import EngagementLevel as _EL
                eng_str = art.get("engagement_level", "passive")
                try:
                    eng = _EL(eng_str)
                except ValueError:
                    eng = _EL.passive
                from infrastructure.services.synthesis_service import get_synthesis_service
                await get_synthesis_service().synthesize_artifact(art_id, text, eng)
            except Exception as exc:
                logger.warning("bg re-synthesis failed", artifact_id=art_id, error=str(exc))

        for _mid in needs_synthesis:
            asyncio.ensure_future(_bg_synthesize(_mid))

    # Group artifacts by platform
    from collections import defaultdict
    platform_arts: dict[str, list] = defaultdict(list)
    for a in artifacts:
        platform_arts[a["platform"]].append(a)

    sources = []
    for platform, p_arts in platform_arts.items():
        p_synths = [synth_by_id[a["id"]] for a in p_arts if a["id"] in synth_by_id]

        # topInsight: use synthesis if available, else fall back to first artifact's content.
        # unique_signal: scan all synthesis rows for this platform — first non-empty wins.
        if p_synths:
            top_insight = next((s["top_insight"] for s in p_synths if s.get("top_insight")), "")
            unique_signal = next((s["unique_signal"] for s in p_synths if s.get("unique_signal")), "")
        else:
            first_art = next(
                (a for a in p_arts if a.get("extracted_text") or a.get("title")), None
            )
            if first_art:
                raw_text = first_art.get("extracted_text") or first_art.get("title") or ""
                if first_art.get("content_source") == "ai_chat" and raw_text:
                    top_insight = _extract_ai_chat_insight(raw_text)
                else:
                    top_insight = raw_text[:300].strip()
            else:
                top_insight = ""
            unique_signal = ""

        # Aggregate themes from synthesis.
        # LLMs return themes in various formats — handle dicts with any key name,
        # plain strings, and nested structures.
        # Fallback chain (each level only runs if the previous produced nothing):
        #   1. synthesis themes  2. Stage A key_findings  3. synthesis top_insight/unique_signal  4. artifact titles
        theme_map: dict[str, list] = {}

        # Level 1: per-artifact synthesis themes
        if p_synths:
            for s in p_synths:
                for t in (s.get("themes") or []):
                    if isinstance(t, str):
                        key = t[:60].strip()
                    elif isinstance(t, dict):
                        text_val = (
                            t.get("text") or t.get("name") or
                            t.get("theme") or t.get("label") or
                            t.get("topic") or t.get("title") or
                            next((v for v in t.values() if isinstance(v, str) and v.strip()), "")
                        )
                        key = text_val[:60].strip()
                    else:
                        key = ""
                    if key:
                        theme_map.setdefault(key, []).append(t)

        # Level 2: Stage A space-wide key_findings (no platform filter — better than nothing)
        if not theme_map and stage_a:
            for finding in stage_a.get("key_findings", []):
                key = (finding.get("text") or "")[:60].strip()
                if key:
                    theme_map.setdefault(key, []).append(finding)

        # Level 3: use synthesis top_insight / unique_signal as pseudo-themes
        if not theme_map and p_synths:
            for s in p_synths:
                for field in ("top_insight", "unique_signal"):
                    val = (s.get(field) or "").strip()
                    if val:
                        key = val[:60].rstrip(".,;:!?")
                        if key:
                            theme_map.setdefault(key, []).append(s)

        # Level 4: artifact titles (absolute last resort)
        if not theme_map:
            for a in p_arts:
                title = (a.get("title") or "").strip()
                if title:
                    theme_map.setdefault(title[:60], []).append(a)

        if not theme_map:
            logger.warning("No themes found for platform", platform=platform, artifact_count=len(p_arts))

        themes = []
        for text_key, t_list in list(theme_map.items())[:4]:
            # compute confidence
            eng_mults = []
            for a in p_arts:
                from domain.entities.common import EngagementLevel
                try:
                    eng_mults.append(EngagementLevel(a["engagement_level"]).multiplier)
                except Exception:
                    eng_mults.append(0.5)
            avg_eng = sum(eng_mults) / len(eng_mults) if eng_mults else 0.5
            most_recent = max((datetime.fromisoformat(a["captured_at"].replace("Z", "+00:00")) for a in p_arts), default=now)
            conf = compute_theme_confidence(
                supporting_artifact_count=len(p_arts),
                avg_engagement_multiplier=avg_eng,
                most_recent_artifact_at=most_recent,
                platforms_used=1,
            )
            themes.append({"text": text_key, "conf": conf})

        # Assign a colour per platform
        PLATFORM_COLORS = {
            "claude": "#C44820", "chatgpt": "#10A37F", "gemini": "#2A6A4A",
            "perplexity": "#6B46C1", "deepseek": "#1E40AF", "grok": "#000000",
            "copilot": "#0078D4", "notebooklm": "#EA4335", "kimi": "#FF6B35",
            "web": "#2A4A7A",
        }
        sources.append({
            "key": platform,
            "label": platform.capitalize(),
            "artifacts": len(p_arts),
            "color": PLATFORM_COLORS.get(platform, "#666"),
            "topInsight": top_insight,
            "themes": sorted(themes, key=lambda x: -x["conf"]),
            "signal": unique_signal,
        })

    # ── Compute readiness ────────────────────────────────────────────────────
    distinct_platforms = len(platform_arts)
    research_depth_pcts = []
    for p, p_arts in platform_arts.items():
        eng_mults = []
        for a in p_arts:
            from domain.entities.common import EngagementLevel
            try:
                eng_mults.append(EngagementLevel(a["engagement_level"]).multiplier)
            except Exception:
                eng_mults.append(0.5)
        avg_eng = sum(eng_mults) / len(eng_mults) if eng_mults else 0.5
        pct = compute_research_depth_pct(len(p_arts), avg_eng, settings.RESEARCH_DEPTH_TARGET)
        research_depth_pcts.append(pct)

    readiness = compute_readiness(
        gaps=[{"severity": g["severity"], "status": g["status"]} for g in gaps],
        research_depth_pcts=research_depth_pcts,
        distinct_platforms=distinct_platforms,
    )

    # ── Research depth bars (matching RESEARCH_DEPTH mock shape) ─────────────
    research_depth = []
    for p, p_arts in platform_arts.items():
        eng_mults = []
        for a in p_arts:
            from domain.entities.common import EngagementLevel
            try:
                eng_mults.append(EngagementLevel(a["engagement_level"]).multiplier)
            except Exception:
                eng_mults.append(0.5)
        avg_eng = sum(eng_mults) / len(eng_mults) if eng_mults else 0.5
        pct = round(compute_research_depth_pct(len(p_arts), avg_eng, settings.RESEARCH_DEPTH_TARGET) * 100)

        # warn=true if this is the weakest topic and below 30%
        research_depth.append({"label": p.capitalize(), "pct": pct, "warn": pct < 30})

    # ── Stage B: Misir's Read ─────────────────────────────────────────────────
    stage_a_hash = hashlib.sha256(json.dumps(stage_a or {}, sort_keys=True).encode()).hexdigest()[:16]
    misirs_read = await _get_or_build_report(
        user_id, space_id, "misir_read", period, stage_a_hash, db,
        lambda: _build_misir_read(space, stage_a, deadline, readiness, len(gaps))
    )

    # ── Stage B: Comparison ───────────────────────────────────────────────────
    comparison = await _get_or_build_report(
        user_id, space_id, "comparison", period, stage_a_hash, db,
        lambda: _build_comparison(space, stage_a, sources)
    )

    # ── Stage B: Decision ─────────────────────────────────────────────────────
    decision = await _get_or_build_report(
        user_id, space_id, "decision", period, stage_a_hash, db,
        lambda: _build_decision(space, stage_a, deadline, gaps)
    )

    # ── Activity timeline ─────────────────────────────────────────────────────
    activity_arts = await aexec(
        db.schema("misir")
        .table("artifact")
        .select("id, title, platform, captured_at")
        .eq("space_id", space_id)
        .gte("captured_at", since.isoformat())
        .order("captured_at", desc=True)
        .limit(20)
    )

    # Revisit + crossLink flags
    open_events = await aexec(
        db.schema("misir")
        .table("artifact_open_event")
        .select("artifact_id")
        .eq("user_id", user_id)
        .gte("opened_at", since.isoformat())
    )
    from collections import Counter
    open_counts = Counter(e["artifact_id"] for e in (open_events.data or []))

    cross_links = set()
    if artifact_ids:
        cl_rows = await aexec(
            db.schema("misir")
            .table("cross_space_link")
            .select("source_artifact_id")
            .in_("source_artifact_id", artifact_ids)
            .in_("status", ["suggested", "accepted"])
        )
        cross_links = {r["source_artifact_id"] for r in (cl_rows.data or [])}

    activity = []
    for a in (activity_arts.data or []):
        # Tags
        tags_row = await aexec(db.schema("misir").table("artifact_tag").select("tag").eq("artifact_id", a["id"]))
        tags = [t["tag"] for t in (tags_row.data or [])]
        activity.append({
            "time": a["captured_at"],
            "source": a["platform"].capitalize(),
            "title": a.get("title") or "Untitled",
            "tags": tags,
            "revisit": open_counts.get(a["id"], 0) >= 2,
            "crossLink": a["id"] in cross_links,
        })

    # ── Cross-space connections ───────────────────────────────────────────────
    cs_links = await aexec(
        db.schema("misir")
        .table("cross_space_link")
        .select("*, artifact:source_artifact_id(title, captured_at), gap:target_gap_id(label, space_id)")
        .eq("user_id", user_id)
        .in_("source_artifact_id", artifact_ids)
        .eq("status", "suggested")
        .limit(3)
    )

    return {
        "misirs_read": {
            **(misirs_read or {}),
            "coverage": readiness,
            "gaps": len([g for g in gaps if g["status"] == "open"]),
        },
        "sources": sources,
        "synthesis": {**(comparison.get("synthesis") or {}), "readiness": readiness} if comparison else None,
        "key_tension": comparison.get("key_tension") if comparison else None,
        "decision": decision,
        "research_depth": research_depth,
        "activity": activity,
        "gaps": [
            {"severity": g["severity"], "label": g["label"], "action": g.get("action") or ""}
            for g in gaps
        ],
        "nudges": nudges,
        "cross_space": [
            {
                "source_title": lnk.get("artifact", {}).get("title") if isinstance(lnk.get("artifact"), dict) else "",
                "target_gap": lnk.get("gap", {}).get("label") if isinstance(lnk.get("gap"), dict) else "",
                "similarity": lnk.get("similarity"),
            }
            for lnk in (cs_links.data or [])
        ],
        "deadline": deadline,
    }


async def _get_or_build_report(user_id, space_id, kind, period, source_hash, db, builder):
    cached = await get_report_cache(user_id, space_id, kind, period, source_hash)
    if cached:
        return cached
    result = await builder()
    if result:
        await set_report_cache(user_id, space_id, kind, period, source_hash, result)
    return result


async def _build_misir_read(space, stage_a, deadline, readiness, gap_count) -> Optional[dict]:
    groq = get_groq_client()
    if not groq.is_available or not stage_a:
        return {"headline": "Research in progress.", "points": [], "coverage": readiness, "gaps": gap_count}

    dl_ctx = ""
    if deadline:
        due = datetime.fromisoformat(deadline["due_at"].replace("Z", "+00:00"))
        days = (due - datetime.now(timezone.utc)).days
        dl_ctx = f"Deadline: {days} days to {deadline['label']}. "

    user_prompt = f"""{dl_ctx}Space goal: {space.get('goal') or 'Not specified'}
Stage A summary:
headline: {stage_a.get('headline')}
key_findings: {json.dumps(stage_a.get('key_findings', [])[:4])}
open_questions: {json.dumps(stage_a.get('open_questions', [])[:3])}
patterns: {json.dumps(stage_a.get('patterns', [])[:3])}"""

    try:
        resp = await groq.chat_completion(
            [{"role": "system", "content": MISIR_READ_SYSTEM}, {"role": "user", "content": user_prompt}],
            max_tokens=400, temperature=0.3, priority=TaskPriority.SYNTHESIS,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as exc:
        logger.error("Misir's Read build failed", error=str(exc))
        return {"headline": stage_a.get("headline", "Research in progress."), "points": []}


async def _build_comparison(space, stage_a, sources) -> Optional[dict]:
    groq = get_groq_client()
    if not groq.is_available or not stage_a:
        return None

    # Build source summary — works with 1 or more sources.
    # When there's only 1 platform, the LLM contrasts what's known vs unknown
    # instead of comparing platforms against each other.
    source_summary = "\n".join(
        f"Platform {s['key']} ({s['artifacts']} artifacts): topInsight=\"{s.get('topInsight', '')[:200]}\""
        for s in sources
    ) or "No specific platform data yet."

    single_source_note = (
        "\nOnly one source platform is present — synthesise what is known vs what remains unknown."
        if len(sources) <= 1 else ""
    )

    user_prompt = f"""Space goal: {space.get('goal') or 'Not specified'}
Sources:\n{source_summary}{single_source_note}
Stage A key findings: {json.dumps(stage_a.get('key_findings', [])[:5])}
Stage A open questions: {json.dumps(stage_a.get('open_questions', [])[:3])}"""

    try:
        resp = await groq.chat_completion(
            [{"role": "system", "content": COMPARISON_SYSTEM}, {"role": "user", "content": user_prompt}],
            max_tokens=600, temperature=0.3, priority=TaskPriority.SYNTHESIS,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        # Ensure required keys exist so the frontend guard doesn't hide the tab
        if not result.get("key_tension") or not result.get("synthesis"):
            logger.warning("Comparison LLM response missing required keys", keys=list(result.keys()))
            return None
        return result
    except Exception as exc:
        logger.error("Comparison build failed", error=str(exc))
        return None


async def _build_decision(space, stage_a, deadline, gaps) -> Optional[dict]:
    groq = get_groq_client()
    if not groq.is_available or not stage_a:
        return None

    has_deadline = deadline is not None
    dl_ctx = ""
    if has_deadline:
        due = datetime.fromisoformat(deadline["due_at"].replace("Z", "+00:00"))
        days = (due - datetime.now(timezone.utc)).days
        dl_ctx = f"Deadline: {days} days to {deadline['label']}. "

    gap_summary = "\n".join(f"- [{g['severity']}] {g['label']}" for g in gaps[:5])
    user_prompt = f"""{dl_ctx}Space goal: {space.get('goal') or 'Not specified'}
Open gaps:\n{gap_summary or 'None'}
Stage A key findings: {json.dumps(stage_a.get('key_findings', [])[:4])}
requires_deadline={has_deadline}"""

    try:
        resp = await groq.chat_completion(
            [{"role": "system", "content": DECISION_SYSTEM}, {"role": "user", "content": user_prompt}],
            max_tokens=600, temperature=0.3, priority=TaskPriority.SYNTHESIS,
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as exc:
        logger.error("Decision build failed", error=str(exc))
        return None

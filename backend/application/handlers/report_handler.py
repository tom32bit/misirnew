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
    get_report_cache_any,
    set_report_cache,
)
from infrastructure.services.synthesis_service import run_stage_a
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)
settings = get_settings()

# Background re-synthesis guardrails (see get_dashboard_payload): artifact ids
# currently being synthesized (dedupe across concurrent dashboard loads) and a
# cap on how many Groq syntheses run at once per process.
_bg_synthesis_inflight: set[int] = set()
_BG_SYNTHESIS_SEM = asyncio.Semaphore(3)

# Per-(user, space, kind, period) build locks so concurrent dashboard requests
# don't each pay for the same Stage B LLM build (cache stampede).
_report_build_locks: dict[tuple, asyncio.Lock] = {}

# Spaces with a nudge refresh currently running in the background — dashboard
# loads must not stack a second refresh behind the first.
_nudge_refresh_inflight: set[int] = set()

# Canonical per-platform display names + colours. Labels are brand-correct
# ("ChatGPT", not str.capitalize()'s "Chatgpt") — the frontend renders these
# verbatim, so every surface shows the same spelling.
PLATFORM_LABELS = {
    "web": "Web", "claude": "Claude", "chatgpt": "ChatGPT", "gemini": "Gemini",
    "perplexity": "Perplexity", "deepseek": "DeepSeek", "grok": "Grok",
    "copilot": "Copilot", "notebooklm": "NotebookLM", "kimi": "Kimi",
    "youtube": "YouTube",
}
PLATFORM_COLORS = {
    "claude": "#C44820", "chatgpt": "#10A37F", "gemini": "#2A6A4A",
    "perplexity": "#6B46C1", "deepseek": "#1E40AF", "grok": "#000000",
    "copilot": "#0078D4", "notebooklm": "#EA4335", "kimi": "#FF6B35",
    "web": "#2A4A7A",
}


def _platform_label(platform: str) -> str:
    return PLATFORM_LABELS.get(platform, platform.capitalize())


def _local_midnight(utc_now: datetime, tz_offset_minutes: int) -> datetime:
    """Return UTC datetime equal to local midnight for the given tz_offset.

    tz_offset_minutes is JS Date.getTimezoneOffset() — positive for timezones
    behind UTC (UTC-8 → 480), negative for ahead (UTC+6 → -360).
    """
    local_now = utc_now + timedelta(minutes=-tz_offset_minutes)
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight + timedelta(minutes=tz_offset_minutes)


def _compute_window(period: str, date_str: Optional[str], tz_offset_minutes: int, now: datetime):
    """Return (since, until) UTC datetimes. until is None for rolling windows."""
    if date_str:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        since = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(minutes=tz_offset_minutes)
        return since, since + timedelta(days=1)
    elif period == "today":
        since = _local_midnight(now, tz_offset_minutes)
        return since, since + timedelta(days=1)
    elif period == "week":
        return now - timedelta(days=7), None
    else:
        return now - timedelta(days=30), None

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
- Plain text only — do NOT use markdown (no **, *, _, #, backticks). Labels are already styled by the UI.
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
frame the single strategic decision this space is trying to answer, derive two meaningful
research strategy options with pros/cons, and suggest one follow-up question Misir could ask.
Respond in JSON:
{
  "question": "<the single strategic decision this space is trying to answer, phrased as a question ending in '?'>",
  "option_a": {
    "label": "<action-oriented label — 3-5 words specific to the domain>",
    "note": "<3-5 word qualifier for this option, e.g. 'Critical gaps remain'>",
    "pros": ["<string>", ...],
    "cons": ["<string>", ...]
  },
  "option_b": {
    "label": "<action-oriented label — 3-5 words specific to the domain>",
    "note": "<3-5 word qualifier for this option>",
    "pros": ["<string>", ...],
    "cons": ["<string>", ...]
  },
  "ask": "<a short first-person question Misir can ask the user to move this decision forward, ending in '?'>"
}
Rules:
- Derive everything from the space goal and open gaps (e.g. "Go Deep on Fundamentals" vs "Explore Applications").
- The question and labels must be specific to the research domain — never use generic startup language like "Raise Series A" or "Extend Runway" unless the goal is literally about that.
- Maximum 4 pros and 4 cons per option.
- If requires_deadline=false, do NOT reference specific timing or deadlines.
- Do NOT output any percentages or numbers."""


# ── Gap dedupe helpers ────────────────────────────────────────────────────────
# Token-set similarity so rephrased open questions don't accumulate as
# near-duplicate gaps run after run.

_GAP_STOPWORDS = frozenset({
    "the", "a", "an", "of", "to", "in", "for", "on", "and", "or", "is", "are",
    "what", "how", "does", "do", "which", "with", "there", "their", "your",
    "this", "that", "will", "would", "should", "can", "be", "it", "its",
})


def _gap_tokens(label: str) -> frozenset[str]:
    import re as _re
    return frozenset(_re.findall(r"[a-z0-9]+", (label or "").lower())) - _GAP_STOPWORDS


def _gap_similar(a: frozenset[str], b: frozenset[str], threshold: float = 0.6) -> bool:
    """Jaccard similarity on content tokens — catches LLM rephrasings."""
    if not a or not b:
        return a == b
    union = len(a | b)
    return union > 0 and len(a & b) / union >= threshold


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


async def get_dashboard_payload(user_id: str, space_id: int, period: str, db, tz_offset: int = 0, date: Optional[str] = None) -> dict:
    """
    Full dashboard payload. One DB call returns everything the four tabs need.
    Backed by Stage A + Stage B caches.
    """
    # ── Fetch context ────────────────────────────────────────────────────────
    # No .single() — supabase-py raises APIError on 0 rows (500 on a just-deleted space).
    space_row = await aexec(db.schema("misir").table("space").select("name, goal, description").eq("id", space_id).limit(1))
    space = space_row.data[0] if space_row.data else {}

    deadline_row = await aexec(db.schema("misir").table("deadline").select("*").eq("space_id", space_id).eq("user_id", user_id))
    deadline = deadline_row.data[0] if deadline_row.data else None

    gaps_row = await aexec(db.schema("misir").table("gap").select("*").eq("space_id", space_id).neq("status", "resolved"))
    gaps = gaps_row.data or []

    # Kick a nudge refresh in the BACKGROUND (fire-and-forget, deduped per
    # space) instead of awaiting it — the refresh fires several Groq calls and
    # was a big chunk of first-load latency. This response serves the current
    # active nudges; fresh ones appear on the next load. The engine's own
    # cooldown still applies inside refresh_nudges_for_space.
    if space_id not in _nudge_refresh_inflight:
        _nudge_refresh_inflight.add(space_id)

        async def _bg_nudge_refresh() -> None:
            try:
                from infrastructure.services.nudge_engine import refresh_nudges_for_space
                await refresh_nudges_for_space(user_id, space_id)
            except Exception as exc:
                logger.warning("Nudge refresh failed", error=str(exc))
            finally:
                _nudge_refresh_inflight.discard(space_id)

        asyncio.ensure_future(_bg_nudge_refresh())

    nudges_row = await aexec(db.schema("misir").table("nudge").select("*").eq("user_id", user_id).eq("space_id", space_id).eq("status", "active").order("priority", desc=True).limit(5))
    nudges = nudges_row.data or []

    # ── Period window ────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    since, until = _compute_window(period, date, tz_offset, now)

    # ── Artifacts for this period ────────────────────────────────────────────
    arts_q = (
        db.schema("misir")
        .table("artifact")
        .select("id, title, platform, engagement_level, base_weight, captured_at, content_hash, extracted_text, content_source, word_count, matched_marker_ids")
        .eq("space_id", space_id)
        .gte("captured_at", since.isoformat())
    )
    if until:
        arts_q = arts_q.lt("captured_at", until.isoformat())
    arts_row = await aexec(arts_q)
    artifacts = arts_row.data or []

    # ── Stage A (synthesis) — skipped for custom dates; synthesis is period-scoped ──
    stage_a = None if date else await run_stage_a(space_id, period, db)

    # Auto-create gaps from Stage A open_questions (if not already present).
    # Dedupe is FUZZY, not exact: the LLM rephrases the same question slightly
    # differently each run ("How big is the market?" vs "What is the market
    # size?"), and exact-match dedupe let those pile up as near-duplicate gaps.
    if stage_a and stage_a.get("open_questions"):
        existing_gaps = await aexec(db.schema("misir").table("gap").select("label").eq("space_id", space_id))
        existing_token_sets = [
            _gap_tokens(g["label"]) for g in (existing_gaps.data or [])
        ]
        new_gaps = []
        for q in stage_a["open_questions"]:
            q_tokens = _gap_tokens(q)
            if any(_gap_similar(q_tokens, ex) for ex in existing_token_sets):
                continue
            new_gaps.append({"space_id": space_id, "severity": "Medium", "label": q, "status": "open"})
            existing_token_sets.append(q_tokens)  # also dedupe within this batch
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
    # Fires-and-forgets so it doesn't block the current response — but bounded:
    # the in-flight set dedupes across concurrent dashboard loads (two tabs on
    # the same space must not double-pay for the same Groq call), and the
    # semaphore caps how many syntheses run at once.
    art_by_id = {a["id"]: a for a in artifacts}
    needs_synthesis = [
        a["id"] for a in artifacts
        if a["id"] not in synth_by_id
        or not (synth_by_id[a["id"]].get("themes") or [])
    ]
    if needs_synthesis:
        async def _bg_synthesize(art_id: int) -> None:
            try:
                async with _BG_SYNTHESIS_SEM:
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
            finally:
                _bg_synthesis_inflight.discard(art_id)

        for _mid in needs_synthesis:
            if _mid in _bg_synthesis_inflight:
                continue
            _bg_synthesis_inflight.add(_mid)
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
        # theme_map values are the SUPPORTING ARTIFACT IDS for each theme, so
        # confidence below is computed per theme (not from the whole platform,
        # which gave every theme the same score and made the sort meaningless).
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
                        theme_map.setdefault(key, []).append(s["artifact_id"])

        # Level 2: Stage A space-wide key_findings (no platform filter — better than nothing)
        if not theme_map and stage_a:
            for finding in stage_a.get("key_findings", []):
                key = (finding.get("text") or "")[:60].strip()
                if key:
                    theme_map.setdefault(key, []).extend(finding.get("supporting_artifact_ids") or [])

        # Level 3: use synthesis top_insight / unique_signal as pseudo-themes
        if not theme_map and p_synths:
            for s in p_synths:
                for field in ("top_insight", "unique_signal"):
                    val = (s.get(field) or "").strip()
                    if val:
                        key = val[:60].rstrip(".,;:!?")
                        if key:
                            theme_map.setdefault(key, []).append(s["artifact_id"])

        # Level 4: artifact titles (absolute last resort)
        if not theme_map:
            for a in p_arts:
                title = (a.get("title") or "").strip()
                if title:
                    theme_map.setdefault(title[:60], []).append(a["id"])

        if not theme_map:
            logger.warning("No themes found for platform", platform=platform, artifact_count=len(p_arts))

        themes = []
        from domain.entities.common import EngagementLevel
        for text_key, support_ids in list(theme_map.items())[:4]:
            # Confidence from the artifacts supporting THIS theme; fall back to
            # the platform's artifacts when support isn't attributable (e.g. a
            # Stage A finding citing artifacts outside this period window).
            support_arts = [art_by_id[i] for i in set(support_ids) if i in art_by_id] or p_arts
            eng_mults = []
            for a in support_arts:
                try:
                    eng_mults.append(EngagementLevel(a["engagement_level"]).multiplier)
                except Exception:
                    eng_mults.append(0.5)
            avg_eng = sum(eng_mults) / len(eng_mults) if eng_mults else 0.5
            most_recent = max((datetime.fromisoformat(a["captured_at"].replace("Z", "+00:00")) for a in support_arts), default=now)
            conf = compute_theme_confidence(
                supporting_artifact_count=len(support_arts),
                avg_engagement_multiplier=avg_eng,
                most_recent_artifact_at=most_recent,
                platforms_used=1,
            )
            themes.append({"text": text_key, "conf": conf})

        sources.append({
            "key": platform,
            "label": _platform_label(platform),
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
        research_depth.append({"label": _platform_label(p), "pct": pct, "warn": pct < 30})

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
    act_q = (
        db.schema("misir")
        .table("artifact")
        .select("id, title, platform, captured_at")
        .eq("space_id", space_id)
        .gte("captured_at", since.isoformat())
    )
    if until:
        act_q = act_q.lt("captured_at", until.isoformat())
    activity_arts = await aexec(act_q.order("captured_at", desc=True).limit(20))

    # Revisit + crossLink flags
    open_ev_q = (
        db.schema("misir")
        .table("artifact_open_event")
        .select("artifact_id")
        .eq("user_id", user_id)
        .gte("opened_at", since.isoformat())
    )
    if until:
        open_ev_q = open_ev_q.lt("opened_at", until.isoformat())
    open_events = await aexec(open_ev_q)
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

    # Tags for the whole timeline in ONE query (was an N+1: one round trip per
    # activity row).
    activity_rows = activity_arts.data or []
    tags_by_artifact: dict[int, list[str]] = {}
    if activity_rows:
        tag_rows = await aexec(
            db.schema("misir")
            .table("artifact_tag")
            .select("artifact_id, tag")
            .in_("artifact_id", [a["id"] for a in activity_rows])
        )
        for t in (tag_rows.data or []):
            tags_by_artifact.setdefault(t["artifact_id"], []).append(t["tag"])

    activity = []
    for a in activity_rows:
        activity.append({
            "time": a["captured_at"],
            "source": _platform_label(a["platform"]),
            "title": a.get("title") or "Untitled",
            "tags": tags_by_artifact.get(a["id"], []),
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

    # ── Per-subspace stats ────────────────────────────────────────────────────
    # The artifact→subspace link is via shared markers: an artifact belongs to a
    # subspace when its matched_marker_ids intersect that subspace's markers
    # (subspace_marker). Captures carry no subspace_id, so this join is the only
    # real attribution available. Without it every subspace reads 0 captures / 0%.
    subspace_stats = []
    subs_row = await aexec(
        db.schema("misir").table("subspace").select("id, name, description").eq("space_id", space_id)
    )
    subspaces = subs_row.data or []
    if subspaces:
        sub_ids = [s["id"] for s in subspaces]
        sm_row = await aexec(
            db.schema("misir").table("subspace_marker").select("subspace_id, marker_id").in_("subspace_id", sub_ids)
        )
        markers_by_sub: dict[int, set] = {}
        for r in (sm_row.data or []):
            markers_by_sub.setdefault(r["subspace_id"], set()).add(r["marker_id"])

        # Attribute a capture to every subspace it SUBSTANTIALLY supports, not
        # every subspace it merely grazes. Matched-marker sets are broad (one
        # artifact can touch all subspaces), so a plain "any overlap" count made
        # every subspace identical; a single best-match made all but one empty.
        # Relevance score = |artifact markers ∩ subspace markers| / |subspace
        # markers| (a subspace with more markers isn't unfairly favoured); a
        # capture counts for the subspace when it matched at least half its
        # markers. This mirrors tagging: a pre-seed explainer legitimately informs
        # several topics, while a topic with no supporting material stays low —
        # real signal, not a bug.
        SUBSPACE_RELEVANCE_THRESHOLD = 0.5
        owned_by_sub: dict[int, list] = {s["id"]: [] for s in subspaces}
        for a in artifacts:
            amarkers = set(a.get("matched_marker_ids") or [])
            if not amarkers:
                continue
            for s in subspaces:
                sset = markers_by_sub.get(s["id"], set())
                if not sset:
                    continue
                if len(amarkers & sset) / len(sset) >= SUBSPACE_RELEVANCE_THRESHOLD:
                    owned_by_sub[s["id"]].append(a)

        from domain.entities.common import EngagementLevel as _EL2
        for s in subspaces:
            owned = owned_by_sub.get(s["id"], [])
            if owned:
                eng_mults = []
                for a in owned:
                    try:
                        eng_mults.append(_EL2(a["engagement_level"]).multiplier)
                    except Exception:
                        eng_mults.append(0.5)
                avg_eng = sum(eng_mults) / len(eng_mults)
                pct = round(
                    compute_research_depth_pct(len(owned), avg_eng, settings.RESEARCH_DEPTH_TARGET) * 100
                )
                last_at = max(a["captured_at"] for a in owned)
            else:
                pct = 0
                last_at = None
            subspace_stats.append({
                "id": s["id"],
                "name": s["name"],
                "captures": len(owned),
                "completeness": pct,
                "last_captured_at": last_at,
            })

    return {
        "misirs_read": {
            **(misirs_read or {}),
            "coverage": readiness,
            "gaps": len([g for g in gaps if g["status"] == "open"]),
        },
        "subspaces": subspace_stats,
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
    """Fresh-cache hit → return it. Stale cache (older source_hash) → return the
    stale payload NOW and rebuild in the background (stale-while-revalidate), so
    a dashboard load never blocks on an LLM call once a report exists. Only the
    very first build for a key runs inline.

    Builds are serialized per (user, space, kind, period): without the lock,
    concurrent loads each miss the cache and pay for their own LLM build before
    one wins the upsert. The lock loser re-checks the cache and gets the
    winner's result for free. (Per-process only — good enough to kill the
    common two-tabs/refresh stampede.)"""
    key = (user_id, space_id, kind, period)
    lock = _report_build_locks.setdefault(key, asyncio.Lock())

    cached = await get_report_cache(user_id, space_id, kind, period, source_hash)
    if cached:
        return cached

    stale = await get_report_cache_any(user_id, space_id, kind, period)
    if stale is not None:
        async def _revalidate() -> None:
            try:
                async with lock:
                    if await get_report_cache(user_id, space_id, kind, period, source_hash):
                        return  # another request already rebuilt it
                    result = await builder()
                    if result:
                        await set_report_cache(user_id, space_id, kind, period, source_hash, result)
            except Exception as exc:
                logger.warning("Background report revalidation failed", kind=kind, space_id=space_id, error=str(exc))

        asyncio.ensure_future(_revalidate())
        return stale

    # First ever build for this key — nothing to serve, so build inline.
    async with lock:
        cached = await get_report_cache(user_id, space_id, kind, period, source_hash)
        if cached:
            return cached
        result = await builder()
        if result:
            await set_report_cache(user_id, space_id, kind, period, source_hash, result)
        return result


def _parse_json_object(raw: str) -> dict:
    """Parse a JSON object from an LLM response. The structured builds request
    Groq JSON mode (response_format=json_object), so content is normally clean
    JSON — but stay defensive: strip code fences and fall back to the first
    {...} block so a stray prefix (e.g. "Here is the response …") can't null the
    whole build, which previously made the dashboard fall back to placeholders."""
    import re
    s = (raw or "").strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", s, re.DOTALL)
    if fenced:
        return json.loads(fenced.group(1))
    bare = re.search(r"\{.*\}", s, re.DOTALL)
    if bare:
        return json.loads(bare.group(0))
    raise ValueError("no JSON object in LLM response")


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
            extra={"response_format": {"type": "json_object"}},
        )
        return _parse_json_object(resp.choices[0].message.content)
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
            extra={"response_format": {"type": "json_object"}},
        )
        result = _parse_json_object(resp.choices[0].message.content)
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
            extra={"response_format": {"type": "json_object"}},
        )
        return _parse_json_object(resp.choices[0].message.content)
    except Exception as exc:
        logger.error("Decision build failed", error=str(exc))
        return None

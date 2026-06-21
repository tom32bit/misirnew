"""
Synthesis service — per-artifact LLM extraction (source_synthesis table) +
Stage A (per-space space_summary) + Stage B (dashboard-level report).

§2.1: Two-stage pipeline. §2.2: Engagement gate.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional

from pydantic import BaseModel, ValidationError

from core.config import get_settings
from core.logging_config import get_logger
from domain.entities.common import EngagementLevel, ReportPeriod
from infrastructure.services.db_async import aexec
from infrastructure.services.groq_client import get_groq_client, TaskPriority
from infrastructure.services.report_cache import (
    get_stage_a_cache, set_stage_a_cache,
    get_report_cache, set_report_cache,
)
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)

# ── Pydantic schemas for LLM output validation ───────────────────────────────

class ArtifactSynthesisOutput(BaseModel):
    top_insight: str
    themes: list[dict]   # [{text, supporting_artifact_ids[]}]
    unique_signal: str


class StageAOutput(BaseModel):
    space_id: int
    headline: str
    key_findings: list[dict]  # [{text, supporting_artifact_ids[], raw_relevance}]
    open_questions: list[str]
    patterns: list[str]
    top_platforms: list[dict]  # [{platform, artifact_count}]


class StageBMisirRead(BaseModel):
    headline: str
    points: list[dict]  # [{label, body, accent}]
    coverage: int       # from confidence_service, NOT from LLM
    gaps: int


class StageBComparison(BaseModel):
    sources: list[dict]  # [{platform, topInsight, themes[], signal}]
    key_tension: dict    # {points[], edge, meta}
    synthesis: dict      # {consensus, conflict, blindspot, readiness}


class StageBDecision(BaseModel):
    raise_now: dict      # {pros[], cons[]}
    extend_runway: dict  # {pros[], cons[]}
    readiness: int


# ── Per-artifact synthesis (§2.2) ─────────────────────────────────────────────

ARTIFACT_SYNTHESIS_SYSTEM = """\
You are Misir, a research assistant that extracts structured insights from captured content.
Extract the following from the text provided. Respond in valid JSON only.
Schema:
{
  "top_insight": "<1 sentence — most actionable finding for the user's stated goal>",
  "themes": [{"text": "<theme>", "supporting_artifact_ids": []}],
  "unique_signal": "<1 sentence — what this source reveals that others typically miss>"
}
Rules:
- Do NOT output any numbers, percentages, ratios, or counts.
- Do NOT reference yourself or the user directly.
- supporting_artifact_ids should be an empty array (IDs are assigned by the system).
- Maximum 4 themes."""


async def synthesize_artifact_text(artifact_id: int, text: str, space_context: Optional[str] = None) -> Optional[dict]:
    groq = get_groq_client()
    if not groq.is_available:
        return None

    messages = [
        {"role": "system", "content": ARTIFACT_SYNTHESIS_SYSTEM},
        {"role": "user", "content": f"Content to analyse:\n\n{text[:6000]}"},
    ]
    if space_context:
        messages[1]["content"] = f"Space goal: {space_context}\n\n" + messages[1]["content"]

    try:
        resp = await groq.chat_completion(
            messages, max_tokens=512, temperature=0.3, priority=TaskPriority.SYNTHESIS,
            extra={"response_format": {"type": "json_object"}},
        )
        raw = resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = ArtifactSynthesisOutput.model_validate_json(raw)
        return parsed.model_dump()
    except (ValidationError, Exception) as exc:
        logger.error("Artifact synthesis failed", artifact_id=artifact_id, error=str(exc))
        return None


# ── Stage A — per-space summary ───────────────────────────────────────────────

STAGE_A_SYSTEM = """\
You are Misir. Produce a structured research summary for this space.
Respond in valid JSON only. Schema:
{
  "space_id": <int>,
  "headline": "<15-word max headline capturing the strategic situation>",
  "key_findings": [
    {"text": "<finding>", "supporting_artifact_ids": [<id>, ...], "raw_relevance": <0.0-1.0>}
  ],
  "open_questions": ["<question>"],
  "patterns": ["<pattern, e.g. revisit:GoMechanic>"],
  "top_platforms": [{"platform": "<name>", "artifact_count": <int>}]
}
Rules:
- Every key_finding MUST cite at least 1 supporting_artifact_id from the provided artifact list.
- If you cannot cite an artifact, omit the finding.
- Do NOT output any percentages, ratios, or assessments not derivable from the artifact list.
- Maximum 6 key_findings, 4 open_questions, 5 patterns."""


async def run_stage_a(space_id: int, period: str, db) -> Optional[dict]:
    """Run Stage A for one space. Returns cached payload if source_hash matches."""
    settings = get_settings()

    # Determine period window
    now = datetime.now(timezone.utc)
    if period == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
        k = settings.STAGE_A_K_TODAY
    elif period == "week":
        since = now - timedelta(days=7)
        k = settings.STAGE_A_K_WEEK
    else:  # month
        since = now - timedelta(days=30)
        k = settings.STAGE_A_K_MONTH

    # Fetch top-K artifacts by effective_weight DESC
    arts = await aexec(
        db.schema("misir")
        .table("artifact")
        .select("id, title, extracted_text, content_hash, platform, engagement_level, base_weight, captured_at, matched_marker_ids")
        .eq("space_id", space_id)
        .gte("captured_at", since.isoformat())
        .order("base_weight", desc=True)
        .limit(k)
    )
    artifacts = arts.data or []

    # Fetch open gaps
    gaps = await aexec(
        db.schema("misir")
        .table("gap")
        .select("id, label, severity, status")
        .eq("space_id", space_id)
        .neq("status", "resolved")
    )
    gap_list = gaps.data or []

    # Compute source_hash
    import hashlib
    artifact_ids = [a["id"] for a in artifacts]
    content_hashes = [a.get("content_hash") or "" for a in artifacts]
    gap_ids = [g["id"] for g in gap_list]
    payload_str = (
        ",".join(str(i) for i in sorted(artifact_ids))
        + "|"
        + ",".join(sorted(content_hashes))
        + "|"
        + ",".join(str(i) for i in sorted(gap_ids))
    )
    source_hash = hashlib.sha256(payload_str.encode()).hexdigest()[:32]

    # Cache hit?
    cached = await get_stage_a_cache(space_id, period, source_hash)
    if cached:
        return cached

    # Fetch space metadata
    space_row = await aexec(db.schema("misir").table("space").select("name, goal, description").eq("id", space_id).single())
    space = space_row.data or {}

    # Fetch pre-computed source_synthesis for these artifacts
    synth_rows = await aexec(
        db.schema("misir")
        .table("source_synthesis")
        .select("artifact_id, top_insight, themes, unique_signal")
        .in_("artifact_id", artifact_ids)
    )
    synth_by_id = {s["artifact_id"]: s for s in (synth_rows.data or [])}

    # Build artifact context lines
    artifact_lines = []
    for a in artifacts:
        synth = synth_by_id.get(a["id"])
        line = f"[artifact_id:{a['id']}] platform:{a['platform']} engagement:{a['engagement_level']}"
        if a.get("title"):
            line += f" title:\"{a['title']}\""
        if synth and synth.get("top_insight"):
            line += f" insight:\"{synth['top_insight']}\""
        elif a.get("extracted_text"):
            line += f" excerpt:\"{a['extracted_text'][:200]}\""
        artifact_lines.append(line)

    gap_lines = [f"[gap_id:{g['id']}] severity:{g['severity']} label:\"{g['label']}\"" for g in gap_list]

    user_prompt = f"""Space: "{space.get('name', '')}"
Goal: {space.get('goal') or 'Not specified'}
Period: {period}

Artifacts ({len(artifacts)}):
{chr(10).join(artifact_lines)}

Open gaps ({len(gap_list)}):
{chr(10).join(gap_lines) or 'None'}

space_id: {space_id}"""

    groq = get_groq_client()
    if not groq.is_available:
        return None

    messages = [
        {"role": "system", "content": STAGE_A_SYSTEM},
        {"role": "user", "content": user_prompt},
    ]

    payload = None
    for attempt in range(2):
        try:
            resp = await groq.chat_completion(
                messages, max_tokens=1024, temperature=0.3, priority=TaskPriority.SYNTHESIS,
                extra={"response_format": {"type": "json_object"}},
            )
            raw = resp.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = StageAOutput.model_validate_json(raw)

            # Quality check: >20% uncited findings → retry
            cited_count = sum(1 for f in parsed.key_findings if f.get("supporting_artifact_ids"))
            if cited_count < len(parsed.key_findings) * 0.8 and attempt == 0:
                messages.append({"role": "assistant", "content": raw})
                messages.append({"role": "user", "content": "Every key_finding must cite at least 1 supporting_artifact_id. Remove any finding that cannot be cited. Respond with corrected JSON only."})
                continue

            payload = parsed.model_dump()
            break
        except (ValidationError, Exception) as exc:
            logger.error("Stage A failed", space_id=space_id, attempt=attempt, error=str(exc))
            if attempt == 0:
                continue
            # Fallback: deterministic stitch
            payload = _stage_a_fallback(space_id, artifacts, gap_list)

    if payload:
        await set_stage_a_cache(space_id, period, source_hash, payload)

    return payload


def _stage_a_fallback(space_id: int, artifacts: list[dict], gaps: list[dict]) -> dict:
    """Deterministic fallback when LLM fails."""
    return {
        "space_id": space_id,
        "headline": f"{len(artifacts)} artifacts captured in this space.",
        "key_findings": [],
        "open_questions": [g["label"] for g in gaps[:4]],
        "patterns": [],
        "top_platforms": _count_platforms(artifacts),
    }


def _count_platforms(artifacts: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for a in artifacts:
        p = a.get("platform", "web")
        counts[p] = counts.get(p, 0) + 1
    return [{"platform": k, "artifact_count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]


# ── Singleton ─────────────────────────────────────────────────────────────────

class SynthesisService:
    async def synthesize_artifact(self, artifact_id: int, text: str, engagement: EngagementLevel) -> None:
        db = get_supabase()
        # Fetch space goal for context
        art = db.schema("misir").table("artifact").select("space_id").eq("id", artifact_id).single().execute()
        space_context = None
        if art.data and art.data.get("space_id"):
            sp = db.schema("misir").table("space").select("goal").eq("id", art.data["space_id"]).single().execute()
            if sp.data:
                space_context = sp.data.get("goal")

        result = await synthesize_artifact_text(artifact_id, text, space_context)
        if result:
            db.schema("misir").table("source_synthesis").upsert(
                {"artifact_id": artifact_id, **result},
                on_conflict="artifact_id",
            ).execute()


@lru_cache(maxsize=1)
def get_synthesis_service() -> SynthesisService:
    return SynthesisService()

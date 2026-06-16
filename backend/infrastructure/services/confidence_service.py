"""
Deterministic confidence blend (§2.4 of implementation plan).

All numeric outputs in the UI — theme conf%, readiness %, research depth % —
come from this service. LLMs never output numbers.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from core.config import get_settings


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


# ── Per-theme confidence ─────────────────────────────────────────────────────

def compute_theme_confidence(
    supporting_artifact_count: int,
    avg_engagement_multiplier: float,  # avg of EngagementLevel.multiplier across supporting artifacts
    most_recent_artifact_at: datetime,
    platforms_used: int,  # distinct platforms across supporting artifacts
) -> int:
    """
    Returns an integer 0–100.

    conf = round(100 × clamp01(
        0.40 × evidence_strength
      + 0.25 × engagement_quality
      + 0.20 × recency_score
      + 0.15 × source_diversity
    ))
    """
    settings = get_settings()
    lam = settings.RECENCY_LAMBDA

    evidence_strength = min(1.0, supporting_artifact_count / 5)
    engagement_quality = _clamp01(avg_engagement_multiplier)

    days_ago = (datetime.now(timezone.utc) - most_recent_artifact_at).days
    recency_score = math.exp(-lam * days_ago)

    source_diversity = 1.0 if platforms_used >= 2 else 0.5

    raw = (
        0.40 * evidence_strength
        + 0.25 * engagement_quality
        + 0.20 * recency_score
        + 0.15 * source_diversity
    )
    return round(100 * _clamp01(raw))


# ── Decision readiness % ─────────────────────────────────────────────────────

def compute_readiness(
    gaps: list[dict],           # [{severity, status}, ...]
    research_depth_pcts: list[float],  # per-topic 0–1 values
    distinct_platforms: int,
) -> int:
    """
    readiness = round(100 × (
        0.50 × gap_coverage
      + 0.30 × research_depth
      + 0.20 × source_diversity_overall
    ))
    Severity weights: Critical=3, High=2, Medium=1.

    Empty space (no gaps + no research) returns 0 — a fresh space has no
    signal yet, not "100% covered". When gaps exist, gap_coverage measures
    how much weighted gap mass has been resolved.
    """
    SEV_WEIGHT = {"Critical": 3, "High": 2, "Medium": 1}

    total_weight = sum(SEV_WEIGHT.get(g["severity"], 1) for g in gaps)
    if total_weight == 0:
        # No gaps articulated — gap_coverage is undefined. Mirror the
        # research signal so the formula reduces to research+diversity only.
        # Avoids "50% for an empty space" while still giving credit when
        # the user has done research but hasn't logged any gaps.
        gap_coverage = 0.0
    else:
        resolved = sum(SEV_WEIGHT.get(g["severity"], 1) for g in gaps if g["status"] == "resolved")
        in_progress = sum(SEV_WEIGHT.get(g["severity"], 1) * 0.5 for g in gaps if g["status"] == "in_progress")
        gap_coverage = (resolved + in_progress) / total_weight

    research_depth = sum(research_depth_pcts) / len(research_depth_pcts) if research_depth_pcts else 0.0
    source_diversity_overall = min(1.0, distinct_platforms / 3)

    # If gaps haven't been articulated, redistribute the gap-coverage weight
    # across the other two signals so the user isn't penalised for not yet
    # naming gaps. Research+diversity then carry the full score.
    if total_weight == 0:
        raw = 0.60 * research_depth + 0.40 * source_diversity_overall
    else:
        raw = (
            0.50 * gap_coverage
            + 0.30 * research_depth
            + 0.20 * source_diversity_overall
        )
    return round(100 * _clamp01(raw))


# ── Research depth per topic ─────────────────────────────────────────────────

def compute_research_depth_pct(artifact_count: int, avg_engagement: float, target: int) -> float:
    """
    pct = (artifact_count × avg_engagement_multiplier) / target
    Clamped to [0, 1].
    """
    if target <= 0:
        return 0.0
    return _clamp01((artifact_count * avg_engagement) / target)

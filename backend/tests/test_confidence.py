"""Deterministic confidence math — the numbers the LLM is never allowed to produce.

These are pure functions with no I/O, so they're asserted directly. The invariant
that matters most is the last test in each block: whatever the inputs, the output
stays a bounded int. A wrong number here is worse than a wrong sentence — it looks
authoritative and gets acted on.
"""
from datetime import datetime, timedelta, timezone

import pytest

from infrastructure.services.confidence_service import (
    compute_readiness,
    compute_research_depth_pct,
    compute_theme_confidence,
)


def _now():
    return datetime.now(timezone.utc)


# ── theme confidence ─────────────────────────────────────────────────────────

def test_theme_confidence_all_signals_maxed_is_100():
    # 5 artifacts, full engagement, captured today, 2+ platforms → every term is 1.0
    assert compute_theme_confidence(5, 1.0, _now(), 2) == 100


def test_theme_confidence_evidence_strength_caps_at_five_artifacts():
    # evidence_strength = min(1.0, count/5) — past 5, more artifacts add nothing.
    assert compute_theme_confidence(500, 1.0, _now(), 2) == compute_theme_confidence(5, 1.0, _now(), 2)


def test_theme_confidence_decays_with_age():
    fresh = compute_theme_confidence(5, 1.0, _now(), 2)
    stale = compute_theme_confidence(5, 1.0, _now() - timedelta(days=60), 2)
    assert stale < fresh


def test_theme_confidence_rewards_platform_diversity():
    # source_diversity is 0.5 for a single platform, 1.0 for two or more.
    assert compute_theme_confidence(5, 1.0, _now(), 2) > compute_theme_confidence(5, 1.0, _now(), 1)


def test_theme_confidence_clamps_engagement_multiplier():
    # EngagementLevel.deep carries multiplier 1.5; the blend clamps it to 1.0,
    # so "deep" cannot push a theme past what full engagement already scores.
    assert compute_theme_confidence(5, 1.5, _now(), 2) == compute_theme_confidence(5, 1.0, _now(), 2)


@pytest.mark.parametrize(
    "count, multiplier, days_old, platforms",
    [
        (0, 0.0, 0, 0),
        (0, 0.0, 10_000, 1),
        (-5, -1.0, 0, 0),          # nonsense input must not escape the range
        (10**6, 99.0, 0, 99),
        (5, 1.0, 0, 2),
    ],
)
def test_theme_confidence_is_always_an_int_0_to_100(count, multiplier, days_old, platforms):
    value = compute_theme_confidence(count, multiplier, _now() - timedelta(days=days_old), platforms)
    assert isinstance(value, int)
    assert 0 <= value <= 100


# ── readiness ────────────────────────────────────────────────────────────────

def test_readiness_of_an_empty_space_is_zero():
    # A fresh space has no signal yet — it must not read as "100% covered".
    assert compute_readiness([], [], 0) == 0


def test_readiness_resolved_gaps_earn_the_full_gap_weight():
    # gap_coverage 1.0 × 0.50 weight, with no research and no platforms.
    assert compute_readiness([{"severity": "Critical", "status": "resolved"}], [], 0) == 50


def test_readiness_in_progress_gap_counts_half():
    assert compute_readiness([{"severity": "Medium", "status": "in_progress"}], [], 0) == 25


def test_readiness_weights_gaps_by_severity():
    # Critical(3) resolved of Critical(3)+Medium(1) → 3/4 coverage → 0.375 → 38.
    gaps = [
        {"severity": "Critical", "status": "resolved"},
        {"severity": "Medium", "status": "open"},
    ]
    assert compute_readiness(gaps, [], 0) == 38


def test_readiness_unknown_severity_defaults_to_weight_one():
    assert compute_readiness([{"severity": "Bogus", "status": "resolved"}], [], 0) == 50


def test_readiness_without_gaps_redistributes_to_research_and_diversity():
    # No gaps logged → 0.60×research + 0.40×diversity, so a user who has done the
    # research but hasn't named any gaps still scores.
    assert compute_readiness([], [1.0], 3) == 100


def test_readiness_source_diversity_saturates_at_three_platforms():
    assert compute_readiness([], [0.0], 3) == compute_readiness([], [0.0], 30)


@pytest.mark.parametrize(
    "gaps, depths, platforms",
    [
        ([], [], 0),
        ([{"severity": "Critical", "status": "open"}], [], 0),
        ([{"severity": "Critical", "status": "resolved"}], [1.0], 10),
        ([{"severity": "Medium", "status": "resolved"}] * 50, [1.0] * 50, 99),
        ([], [-5.0, 99.0], -1),          # nonsense input must not escape the range
    ],
)
def test_readiness_is_always_an_int_0_to_100(gaps, depths, platforms):
    value = compute_readiness(gaps, depths, platforms)
    assert isinstance(value, int)
    assert 0 <= value <= 100


# ── research depth ───────────────────────────────────────────────────────────

def test_research_depth_is_proportional_to_target():
    assert compute_research_depth_pct(5, 1.0, 10) == 0.5


def test_research_depth_engagement_scales_the_count():
    # 2 artifacts at 2.0× engagement reach the same depth as 4 at 1.0×.
    assert compute_research_depth_pct(2, 2.0, 8) == compute_research_depth_pct(4, 1.0, 8)


@pytest.mark.parametrize("target", [0, -5])
def test_research_depth_guards_non_positive_target(target):
    # Division guard — a target of 0 must not raise.
    assert compute_research_depth_pct(10, 1.0, target) == 0.0


def test_research_depth_clamped_to_one():
    assert compute_research_depth_pct(100, 3.0, 5) == 1.0


def test_research_depth_never_negative():
    assert compute_research_depth_pct(-10, 1.0, 5) == 0.0

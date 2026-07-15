"""Nudge engine: the deterministic rules decide WHETHER to nudge; the LLM only
phrases it. These tests pin the rule thresholds and the guards around the
phrasing pass — never the LLM's prose.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from infrastructure.services import nudge_engine
from tests.fakes import FakeDB, FakeResp


def _now():
    return datetime.now(timezone.utc)


FALLBACK = {"scatter": "fallback scatter", "direction": "fallback direction", "consequence": "fallback consequence"}


class _FakeGroq:
    """Stands in for GroqClient: canned completion content, or unavailable/raising."""

    def __init__(self, content: str = "", available: bool = True, raises: bool = False):
        self._content, self._available, self._raises = content, available, raises

    @property
    def is_available(self) -> bool:
        return self._available

    async def chat_completion(self, *args, **kwargs):
        if self._raises:
            raise RuntimeError("groq exploded")
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self._content))])


@pytest.fixture
def groq(monkeypatch):
    def _install(**kwargs):
        client = _FakeGroq(**kwargs)
        monkeypatch.setattr(nudge_engine, "get_groq_client", lambda: client)
        return client
    return _install


def _quiet_db(**tables):
    """FakeDB with every rule's table empty unless overridden, so one rule can be
    exercised without the others firing."""
    responses = {t: FakeResp(data=[]) for t in
                 ("artifact_open_event", "artifact", "gap", "cross_space_link", "deadline")}
    responses.update({k: FakeResp(data=v) for k, v in tables.items()})
    return FakeDB(responses=responses)


# ── phrasing guards ──────────────────────────────────────────────────────────

async def test_phrasing_falls_back_when_groq_is_unavailable(groq):
    groq(available=False)
    assert await nudge_engine._phrase_nudge("evidence", FALLBACK) == FALLBACK


async def test_phrasing_falls_back_when_groq_raises(groq):
    groq(raises=True)
    assert await nudge_engine._phrase_nudge("evidence", FALLBACK) == FALLBACK


async def test_phrasing_falls_back_on_unparseable_json(groq):
    groq(content="not json at all")
    assert await nudge_engine._phrase_nudge("evidence", FALLBACK) == FALLBACK


async def test_phrasing_uses_the_llm_output_when_it_is_valid(groq):
    groq(content='{"scatter": "You drifted.", "direction": "Close it.", "consequence": "You stall."}')
    out = await nudge_engine._phrase_nudge("evidence", FALLBACK)
    assert out["scatter"] == "You drifted."


async def test_phrasing_strips_markdown_fences(groq):
    groq(content='```json\n{"scatter": "You drifted.", "direction": "Close it.", "consequence": "You stall."}\n```')
    out = await nudge_engine._phrase_nudge("evidence", FALLBACK)
    assert out["direction"] == "Close it."


@pytest.mark.parametrize("third_person", ["The user keeps revisiting it.", "The researcher has not synthesised."])
async def test_phrasing_rejects_third_person_and_falls_back(groq, third_person):
    """Nudges must address the reader as "you". The prompt demands it, but the
    fallback is what actually enforces it when the model ignores the prompt."""
    groq(content='{"scatter": "%s", "direction": "Close it.", "consequence": "You stall."}' % third_person)
    assert await nudge_engine._phrase_nudge("evidence", FALLBACK) == FALLBACK


# ── rule 1: revisit-without-resolve ──────────────────────────────────────────

async def test_revisit_rule_fires_at_three_opens(groq):
    groq(available=False)
    db = _quiet_db(
        artifact_open_event=[{"artifact_id": 1}] * 3,
        artifact=[{"id": 1, "title": "Eigenvalues", "space_id": 10}],
    )
    nudges = await nudge_engine.run_nudge_rules("uid", 10, db, space_name="Linear Algebra")

    assert len(nudges) == 1
    assert nudges[0]["evidence_data"] == {"artifact_id": 1, "open_count": 3}
    assert nudges[0]["cta_label"] == "Close it →"


async def test_revisit_rule_does_not_fire_below_three_opens(groq):
    groq(available=False)
    db = _quiet_db(
        artifact_open_event=[{"artifact_id": 1}] * 2,
        artifact=[{"id": 1, "title": "Eigenvalues", "space_id": 10}],
    )
    assert await nudge_engine.run_nudge_rules("uid", 10, db, space_name="Linear Algebra") == []


async def test_revisit_rule_ignores_artifacts_from_another_space(groq):
    groq(available=False)
    # The artifact lookup is scoped by space_id; no row back → no nudge.
    db = _quiet_db(artifact_open_event=[{"artifact_id": 1}] * 5, artifact=[])
    assert await nudge_engine.run_nudge_rules("uid", 10, db) == []


# ── rule 2: recurring-gap ────────────────────────────────────────────────────

async def test_recurring_gap_rule_fires_and_prioritises_critical(groq):
    groq(available=False)
    db = _quiet_db(gap=[{"id": 5, "label": "CAC payback", "severity": "Critical", "recurring_count": 2}])
    nudges = await nudge_engine.run_nudge_rules("uid", 10, db, space_name="Series A")

    assert len(nudges) == 1
    assert nudges[0]["evidence_data"] == {"gap_id": 5}
    assert nudges[0]["priority"] == 2          # Critical outranks the rest


async def test_recurring_gap_rule_lowers_priority_for_non_critical(groq):
    groq(available=False)
    db = _quiet_db(gap=[{"id": 5, "label": "CAC payback", "severity": "Medium", "recurring_count": 2}])
    nudges = await nudge_engine.run_nudge_rules("uid", 10, db, space_name="Series A")
    assert nudges[0]["priority"] == 1


# ── rule 4: deadline-pressure ────────────────────────────────────────────────

async def test_deadline_rule_fires_inside_the_seven_day_window(groq):
    groq(available=False)
    due = _now() + timedelta(days=3, hours=1)
    db = _quiet_db(deadline=[{"label": "Board meeting", "due_at": due.isoformat(), "target_pct": 80}])
    nudges = await nudge_engine.run_nudge_rules("uid", 10, db, space_name="Series A")

    assert len(nudges) == 1
    assert nudges[0]["requires_deadline"] is True
    assert nudges[0]["priority"] == 3          # deadline pressure outranks everything
    assert nudges[0]["evidence_data"]["days_left"] == 3


@pytest.mark.parametrize("delta", [timedelta(days=30), timedelta(days=-1), timedelta(hours=1)])
async def test_deadline_rule_stays_quiet_outside_the_window(groq, delta):
    """Fires only for 0 < days_left <= 7 — not for far-off deadlines, not for
    ones already past, and not for today (days_left == 0)."""
    groq(available=False)
    db = _quiet_db(deadline=[{"label": "Board meeting", "due_at": (_now() + delta).isoformat(), "target_pct": 80}])
    assert await nudge_engine.run_nudge_rules("uid", 10, db, space_name="Series A") == []


async def test_deadline_rule_accepts_zulu_timestamps(groq):
    # due_at comes back from Postgres with a trailing Z, not +00:00.
    groq(available=False)
    due = (_now() + timedelta(days=2, hours=1)).replace(microsecond=0)
    zulu = due.isoformat().replace("+00:00", "Z")
    db = _quiet_db(deadline=[{"label": "Board meeting", "due_at": zulu, "target_pct": 80}])
    assert len(await nudge_engine.run_nudge_rules("uid", 10, db)) == 1


# ── evidence key (dismiss cooldown) ──────────────────────────────────────────

@pytest.mark.parametrize(
    "evidence, expected",
    [
        ({"artifact_id": 1}, "artifact_id:1"),
        ({"gap_id": 5}, "gap_id:5"),
        ({"cross_space_link_id": 9}, "cross_space_link_id:9"),
        ({"deadline_label": "Board meeting"}, "deadline_label:Board meeting"),
        ({"unrecognised": 1}, None),
        ({}, None),
    ],
)
def test_evidence_key_identifies_what_a_nudge_is_about(evidence, expected):
    assert nudge_engine._evidence_key(evidence) == expected


def test_evidence_key_prefers_the_first_known_field():
    # Order is fixed so the same nudge always yields the same cooldown key.
    assert nudge_engine._evidence_key({"gap_id": 5, "artifact_id": 1}) == "artifact_id:1"

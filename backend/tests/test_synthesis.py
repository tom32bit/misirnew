"""Synthesis pipeline: the guardrails around the LLM, not the LLM itself.

What's worth pinning here is everything that protects the product when the model
misbehaves — schema validation, the citation gate, the deterministic fallback —
plus the two prompt rules the whole design leans on.
"""
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from infrastructure.services import synthesis_service as ss
from tests.fakes import FakeDB, FakeResp


class _FakeGroq:
    """Returns each canned completion in turn, so a retry can differ from the
    first attempt. `raises` blows up on every call instead."""

    def __init__(self, *contents: str, available: bool = True, raises: bool = False):
        self._contents, self._available, self._raises = list(contents), available, raises
        self.calls = 0

    @property
    def is_available(self) -> bool:
        return self._available

    async def chat_completion(self, *args, **kwargs):
        self.calls += 1
        if self._raises:
            raise RuntimeError("groq exploded")
        content = self._contents[min(self.calls - 1, len(self._contents) - 1)]
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture
def groq(monkeypatch):
    def _install(*contents, **kwargs):
        client = _FakeGroq(*contents, **kwargs)
        monkeypatch.setattr(ss, "get_groq_client", lambda: client)
        return client
    return _install


ARTIFACT_JSON = '{"top_insight": "Fleet B2B is the wedge.", "themes": [{"text": "unit economics", "supporting_artifact_ids": []}], "unique_signal": "Margins invert at scale."}'


# ── the conventions the design rests on ──────────────────────────────────────

def test_artifact_prompt_forbids_the_llm_from_emitting_numbers():
    """All numeric UI values come from confidence_service. If this instruction is
    ever dropped, the model starts inventing authoritative-looking metrics."""
    assert "Do NOT output any numbers" in ss.ARTIFACT_SYNTHESIS_SYSTEM


def test_stage_a_prompt_requires_every_finding_to_cite_an_artifact():
    assert "MUST cite at least 1 supporting_artifact_id" in ss.STAGE_A_SYSTEM
    assert "omit the finding" in ss.STAGE_A_SYSTEM


def test_stage_a_prompt_forbids_unsupported_assessments():
    assert "Do NOT output any percentages" in ss.STAGE_A_SYSTEM


# ── output schemas ───────────────────────────────────────────────────────────

def test_artifact_schema_accepts_a_well_formed_payload():
    parsed = ss.ArtifactSynthesisOutput.model_validate_json(ARTIFACT_JSON)
    assert parsed.top_insight == "Fleet B2B is the wedge."


@pytest.mark.parametrize("payload", [
    '{"top_insight": "x", "themes": []}',                       # unique_signal missing
    '{"themes": [], "unique_signal": "x"}',                     # top_insight missing
    '{"top_insight": "x", "themes": "not-a-list", "unique_signal": "y"}',
])
def test_artifact_schema_rejects_malformed_payloads(payload):
    with pytest.raises(ValidationError):
        ss.ArtifactSynthesisOutput.model_validate_json(payload)


# ── per-artifact synthesis ───────────────────────────────────────────────────

async def test_artifact_synthesis_returns_none_when_groq_is_unavailable(groq):
    groq(available=False)
    assert await ss.synthesize_artifact_text(1, "some text") is None


async def test_artifact_synthesis_parses_a_valid_response(groq):
    groq(ARTIFACT_JSON)
    out = await ss.synthesize_artifact_text(1, "some text")
    assert out["top_insight"] == "Fleet B2B is the wedge."
    assert out["unique_signal"] == "Margins invert at scale."


async def test_artifact_synthesis_strips_markdown_fences(groq):
    groq(f"```json\n{ARTIFACT_JSON}\n```")
    out = await ss.synthesize_artifact_text(1, "some text")
    assert out["top_insight"] == "Fleet B2B is the wedge."


@pytest.mark.parametrize("bad", ["not json", "", '{"top_insight": "x"}'])
async def test_artifact_synthesis_swallows_bad_output_and_returns_none(groq, bad):
    # A failed extraction must not propagate — capture still has to succeed.
    groq(bad)
    assert await ss.synthesize_artifact_text(1, "some text") is None


async def test_artifact_synthesis_returns_none_when_groq_raises(groq):
    groq(raises=True)
    assert await ss.synthesize_artifact_text(1, "some text") is None


async def test_artifact_synthesis_injects_the_space_goal_as_context(groq):
    """"Most actionable finding" is meaningless without the goal it's relative to."""
    client = groq(ARTIFACT_JSON)
    captured = {}

    async def _capture(messages, **kwargs):
        captured["messages"] = messages
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=ARTIFACT_JSON))])

    client.chat_completion = _capture
    await ss.synthesize_artifact_text(1, "some text", space_context="Raise a Series A")
    assert "Raise a Series A" in captured["messages"][1]["content"]


async def test_artifact_synthesis_truncates_very_long_text(groq):
    client = groq(ARTIFACT_JSON)
    captured = {}

    async def _capture(messages, **kwargs):
        captured["messages"] = messages
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=ARTIFACT_JSON))])

    client.chat_completion = _capture
    await ss.synthesize_artifact_text(1, "x" * 10_000)
    assert len(captured["messages"][1]["content"]) < 7_000      # capped at 6000 chars + preamble


# ── deterministic fallbacks ──────────────────────────────────────────────────

def test_platform_counts_are_ordered_most_frequent_first():
    artifacts = [{"platform": "chatgpt"}, {"platform": "web"}, {"platform": "chatgpt"}, {"platform": "claude"}]
    assert ss._count_platforms(artifacts)[0] == {"platform": "chatgpt", "artifact_count": 2}


def test_platform_counts_default_missing_platform_to_web():
    assert ss._count_platforms([{}]) == [{"platform": "web", "artifact_count": 1}]


def test_platform_counts_of_nothing_is_empty():
    assert ss._count_platforms([]) == []


def test_stage_a_fallback_claims_no_findings_it_cannot_support():
    """The fallback runs when the LLM failed, so it must not invent findings —
    it only restates what the database already knows."""
    gaps = [{"label": "CAC payback"}, {"label": "Churn"}]
    out = ss._stage_a_fallback(7, [{"platform": "web"}], gaps)

    assert out["space_id"] == 7
    assert out["key_findings"] == []
    assert out["patterns"] == []
    assert out["open_questions"] == ["CAC payback", "Churn"]
    assert out["top_platforms"] == [{"platform": "web", "artifact_count": 1}]


def test_stage_a_fallback_caps_open_questions():
    gaps = [{"label": f"gap {i}"} for i in range(10)]
    assert len(ss._stage_a_fallback(7, [], gaps)["open_questions"]) == 4


# ── Stage A: citation gate + fallback ────────────────────────────────────────

def _stage_a_json(findings):
    import json
    return json.dumps({
        "space_id": 7, "headline": "Fleet is the wedge.", "key_findings": findings,
        "open_questions": [], "patterns": [], "top_platforms": [],
    })


UNCITED = _stage_a_json([
    {"text": "a", "supporting_artifact_ids": [], "raw_relevance": 0.9},
    {"text": "b", "supporting_artifact_ids": [], "raw_relevance": 0.8},
])
CITED = _stage_a_json([{"text": "a", "supporting_artifact_ids": [1], "raw_relevance": 0.9}])


@pytest.fixture
def stage_a_db(monkeypatch):
    """run_stage_a with the cache bypassed, so the LLM path always runs."""
    async def _miss(*a, **k):
        return None

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(ss, "get_stage_a_cache", _miss)
    monkeypatch.setattr(ss, "set_stage_a_cache", _noop)
    return FakeDB(responses={
        "artifact": FakeResp(data=[{"id": 1, "title": "T", "extracted_text": "x", "content_hash": "h",
                                    "platform": "web", "engagement_level": "active", "base_weight": 2.0,
                                    "captured_at": "2026-07-01T00:00:00+00:00", "matched_marker_ids": []}]),
        "gap": FakeResp(data=[]),
        # List shape — the space lookup uses .limit(1) + data[0], not .single().
        "space": FakeResp(data=[{"name": "Series A", "goal": "Raise", "description": ""}]),
        "source_synthesis": FakeResp(data=[]),
    })


async def test_stage_a_reprompts_once_when_findings_are_uncited(groq, stage_a_db):
    """>20% uncited → one corrective retry rather than shipping unsupported claims."""
    client = groq(UNCITED, CITED)
    out = await ss.run_stage_a(7, "week", stage_a_db)

    assert client.calls == 2                                     # retried
    assert out["key_findings"][0]["supporting_artifact_ids"] == [1]


async def test_stage_a_accepts_cited_findings_without_a_retry(groq, stage_a_db):
    client = groq(CITED)
    out = await ss.run_stage_a(7, "week", stage_a_db)

    assert client.calls == 1                                     # no retry needed
    assert out["headline"] == "Fleet is the wedge."


async def test_stage_a_falls_back_deterministically_when_the_llm_keeps_failing(groq, stage_a_db):
    """Two failures → a stitched summary. The dashboard degrades; it never 500s."""
    groq(raises=True)
    out = await ss.run_stage_a(7, "week", stage_a_db)

    assert out["key_findings"] == []                             # fallback shape
    assert out["top_platforms"] == [{"platform": "web", "artifact_count": 1}]


async def test_stage_a_returns_none_when_groq_is_unavailable(groq, stage_a_db):
    groq(available=False)
    assert await ss.run_stage_a(7, "week", stage_a_db) is None


async def test_stage_a_serves_the_cache_without_calling_the_llm(groq, monkeypatch, stage_a_db):
    """Cache hits are keyed on a source_hash of the artifacts+gaps, so unchanged
    research must cost zero tokens."""
    cached = {"space_id": 7, "headline": "from cache", "key_findings": [],
              "open_questions": [], "patterns": [], "top_platforms": []}

    async def _hit(*a, **k):
        return cached

    monkeypatch.setattr(ss, "get_stage_a_cache", _hit)
    client = groq(CITED)

    assert await ss.run_stage_a(7, "week", stage_a_db) == cached
    assert client.calls == 0

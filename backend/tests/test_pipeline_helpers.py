"""Unit tests for the money-path helpers: chat history preparation, gap
dedupe, capture-timestamp clamping, and LLM JSON parsing.

The chat history-ordering bug (oldest-50 instead of newest-50) shipped because
none of this logic had a test — these lock the fixed behaviour in."""
from datetime import datetime, timedelta, timezone

from application.handlers.chat_handler import _prepare_history
from application.handlers.report_handler import (
    _extract_ai_chat_insight,
    _gap_similar,
    _gap_tokens,
    _parse_json_object,
)
from interfaces.api.artifacts import _sanitize_captured_at


# ── Chat history preparation ──────────────────────────────────────────────────

def _rows_newest_first(*pairs):
    """(role, content) pairs given oldest→newest; returned newest-first like
    the DB query (order desc)."""
    return [{"role": r, "content": c} for r, c in reversed(pairs)]


def test_history_is_chronological_and_keeps_newest():
    rows = _rows_newest_first(("user", "q1"), ("misir", "a1"), ("user", "q2"))
    out = _prepare_history(rows, "q2")
    assert [m["content"] for m in out] == ["q1", "a1", "q2"]
    assert [m["role"] for m in out] == ["user", "assistant", "user"]


def test_history_does_not_duplicate_persisted_user_message():
    rows = _rows_newest_first(("user", "hello"))
    out = _prepare_history(rows, "hello")
    assert [m["content"] for m in out] == ["hello"]        # exactly once


def test_history_appends_user_message_when_missing():
    rows = _rows_newest_first(("user", "q1"), ("misir", "a1"))
    out = _prepare_history(rows, "q2")
    assert out[-1] == {"role": "user", "content": "q2"}
    assert len(out) == 3


def test_history_empty_rows_still_carries_user_message():
    assert _prepare_history([], "hi") == [{"role": "user", "content": "hi"}]


def test_history_same_text_earlier_in_thread_still_appends():
    # The user asked "why?" twice; only a TRAILING duplicate is suppressed.
    rows = _rows_newest_first(("user", "why?"), ("misir", "because"))
    out = _prepare_history(rows, "why?")
    assert [m["content"] for m in out] == ["why?", "because", "why?"]


# ── Gap dedupe (fuzzy) ────────────────────────────────────────────────────────

def test_gap_rephrasings_are_similar():
    a = _gap_tokens("How big is the addressable market?")
    b = _gap_tokens("What is the addressable market size, and how big?")
    assert _gap_similar(a, b)


def test_gap_distinct_questions_are_not_similar():
    a = _gap_tokens("How big is the addressable market?")
    b = _gap_tokens("Which distribution channels convert best?")
    assert not _gap_similar(a, b)


def test_gap_tokens_strip_stopwords_and_punctuation():
    assert _gap_tokens("What is the market?") == frozenset({"market"})


def test_gap_empty_labels_only_match_each_other():
    empty = _gap_tokens("the a an")
    assert _gap_similar(empty, _gap_tokens("of to in"))     # both empty → equal
    assert not _gap_similar(empty, _gap_tokens("market"))


# ── captured_at clamping ──────────────────────────────────────────────────────

NOW = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)


def test_captured_at_passthrough_recent():
    ts = (NOW - timedelta(hours=3)).isoformat()
    assert _sanitize_captured_at(ts, NOW) == ts


def test_captured_at_future_clamped_to_now():
    ts = (NOW + timedelta(days=2)).isoformat()
    assert _sanitize_captured_at(ts, NOW) == NOW.isoformat()


def test_captured_at_too_old_clamped_to_window():
    ts = (NOW - timedelta(days=365)).isoformat()
    assert _sanitize_captured_at(ts, NOW) == (NOW - timedelta(days=30)).isoformat()


def test_captured_at_garbage_falls_back_to_now():
    assert _sanitize_captured_at("not-a-date", NOW) == NOW.isoformat()
    assert _sanitize_captured_at(None, NOW) == NOW.isoformat()


def test_captured_at_naive_datetime_treated_as_utc():
    ts = (NOW - timedelta(hours=1)).replace(tzinfo=None).isoformat()
    out = _sanitize_captured_at(ts, NOW)
    assert out == (NOW - timedelta(hours=1)).isoformat()


# ── LLM JSON parsing ──────────────────────────────────────────────────────────

def test_parse_json_clean():
    assert _parse_json_object('{"a": 1}') == {"a": 1}


def test_parse_json_fenced():
    assert _parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_json_with_prose_prefix():
    assert _parse_json_object('Here is the response:\n{"a": 1}') == {"a": 1}


def test_parse_json_no_object_raises():
    import pytest
    with pytest.raises(Exception):
        _parse_json_object("no json here")


# ── AI-chat insight extraction ────────────────────────────────────────────────

def test_ai_chat_insight_prefers_assistant_turn():
    text = "[CHATGPT — pricing]\n\nUser: how to price?\nAssistant: Anchor on value, not cost."
    assert _extract_ai_chat_insight(text) == "Anchor on value, not cost."


def test_ai_chat_insight_falls_back_to_first_content_line():
    text = "[CHATGPT — pricing]\nUser: how to price?\nsome stray line"
    assert _extract_ai_chat_insight(text) == "some stray line"

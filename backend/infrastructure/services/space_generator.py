"""
AI-powered space bootstrapping.

Takes a name + intention, asks Groq to generate a structured set of subspaces
and markers, validates the output, and returns it as a typed payload. The
API layer is responsible for actually inserting rows.

Why this matters: subspaces + markers drive the extension's lexical capture
matching ([extension/src/lib/matching.ts]). A space with zero markers will
never match any browsed page, so every fresh space needs at least a starter
set of markers — and humans hate writing those by hand.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from pydantic import BaseModel, Field, ValidationError

from core.logging_config import get_logger
from infrastructure.services.groq_client import get_groq_client
from infrastructure.services.groq_rate_limiter import TaskPriority

logger = get_logger(__name__)


# ── Output schema ────────────────────────────────────────────────────────────

class GeneratedMarker(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    weight: float = Field(default=1.0, ge=0.1, le=2.0)


class GeneratedSubspace(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    markers: List[GeneratedMarker] = Field(min_length=1, max_length=15)


class GenerationResult(BaseModel):
    subspaces: List[GeneratedSubspace] = Field(min_length=1, max_length=8)


# ── Prompt ────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You design knowledge spaces for a research-tracking tool.

Given a user's space name and what they want to achieve, output a structured \
breakdown of distinct subspaces (semantic territories) with specific marker \
phrases that real web pages and chat conversations about that territory would contain.

Rules:
- 4 to 7 subspaces. Each must cover a distinct slice of the topic.
- Subspace names describe WHAT CONTENT lives there — concrete topics, not stages \
of learning. Bad: "Foundations", "Core Concepts". Good: "CAC payback benchmarks", \
"GoMechanic collapse and B2B fleet narratives".
- 5 to 10 markers per subspace. Each marker is a concrete phrase or term that \
would appear verbatim in pages/conversations on that subspace ONLY. Lowercase, \
3 words or fewer where possible. No vague words like "concept", "important".
- Markers must not appear in more than one subspace.
- Marker weight: 0.9-1.0 for the defining terms, 0.6-0.8 for important related \
terms, 0.4-0.5 for adjacent terms. Default to 1.0 if unsure.
- Description (1-2 sentences, max 60 words) describes the content territory in \
concrete terms, not abstract goals.

Output format: a single JSON object, no preamble, no markdown:
{
  "subspaces": [
    {
      "name": "string",
      "description": "string",
      "markers": [{"label": "string", "weight": 0.0-2.0}]
    }
  ]
}
"""

_USER_PROMPT = """Space name: {name}
Intention: {intention}

Generate the subspaces JSON now."""


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_space_structure(name: str, intention: str) -> Optional[GenerationResult]:
    """
    Call Groq to generate subspaces + markers. Returns None on any failure
    (caller should still create the bare space so the user isn't blocked).
    """
    client = get_groq_client()
    if not client.is_available:
        logger.warning("Groq unavailable; skipping space structure generation")
        return None

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _USER_PROMPT.format(name=name, intention=intention or "")},
    ]

    try:
        response = await client.chat_completion(
            messages,
            max_tokens=1500,
            temperature=0.3,
            priority=TaskPriority.SYNTHESIS,
            extra={"response_format": {"type": "json_object"}},
        )
    except Exception as exc:
        logger.error("Groq call failed during space generation", error=str(exc))
        return None

    raw = response.choices[0].message.content if response.choices else ""
    if not raw:
        logger.warning("Empty response from Groq during space generation")
        return None

    parsed_json = _extract_json(raw)
    if parsed_json is None:
        logger.warning("Could not parse JSON from Groq output", raw=raw[:200])
        return None

    try:
        result = GenerationResult.model_validate(parsed_json)
    except ValidationError as exc:
        logger.warning("Groq output failed schema validation", errors=str(exc.errors())[:400])
        return None

    _dedupe_markers(result)
    return result


def _extract_json(raw: str) -> Optional[dict]:
    """Try direct parse, then strip markdown fences, then find first {...}."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass
    bare = re.search(r"\{.*\}", raw, re.DOTALL)
    if bare:
        try:
            return json.loads(bare.group(0))
        except json.JSONDecodeError:
            pass
    return None


def _dedupe_markers(result: GenerationResult) -> None:
    """Drop markers that appear in more than one subspace (keep first occurrence)."""
    seen: set[str] = set()
    for sub in result.subspaces:
        kept: list[GeneratedMarker] = []
        for m in sub.markers:
            key = m.label.strip().lower()
            if key in seen or not key:
                continue
            seen.add(key)
            kept.append(m)
        sub.markers = kept

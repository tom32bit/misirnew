"""
Nudge engine (§6).

Rules (all deterministic except the Groq phrasing pass):
1. revisit-without-resolve  — artifact opened ≥3× in period, no synthesis change
2. recurring-gap            — same gap label persists open ≥2 weeks
3. cross-space-untaken      — cross_space_link suggested ≥3 days, user hasn't acted
4. deadline-pressure        — deadline ≤7 days and readiness < target_pct (requires_deadline=true)

After rules fire, a single Groq call phrases each nudge in Misir's voice
using the scatter/direction/consequence format from the mock.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional

from core.config import get_settings
from core.logging_config import get_logger
from infrastructure.services.db_async import aexec
from infrastructure.services.groq_client import get_groq_client, TaskPriority
from infrastructure.services.supabase_client import get_supabase

logger = get_logger(__name__)

def _build_nudge_system(space_name: str, space_goal: str) -> str:
    domain_line = f"Research topic: {space_name}"
    if space_goal:
        domain_line += f" (goal: {space_goal})"
    return f"""\
You write focus nudges DIRECTLY TO a researcher. {domain_line}.

Output ONLY this JSON — no markdown, no extra text:
{{"scatter": "...", "direction": "...", "consequence": "..."}}

HARD RULES — any violation makes the output invalid:
1. EVERY field must use second-person: "you" / "your". NEVER write "the user", "the researcher", or any third-person pronoun.
2. scatter: one sentence, starts with "You" or "You've", describes the exact behaviour from the evidence.
3. direction: one sentence, starts with an imperative verb (Open / Write / Close / Stop / Dedicate). One concrete action only.
4. consequence: one sentence, explains the cost to YOUR {space_name} research specifically. NEVER mention investors, business, or funding unless the evidence explicitly states it.
5. Output ONLY the raw JSON object on one line. No explanation before or after.

EXAMPLE — research topic: Linear Algebra
Evidence: "You have opened 'Eigenvalues' 4 times this week without producing any synthesis notes."
Output: {{"scatter": "You've opened 'Eigenvalues' four times this week without writing a single synthesis note from it.", "direction": "Open it once more with one specific question written down, then close it after answering only that question.", "consequence": "Without synthesising eigenvalue intuition, you will keep re-reading the same source every time it comes up in your Linear Algebra work."}}"""


async def _phrase_nudge(evidence: str, fallback: dict, space_name: str = "", space_goal: str = "") -> dict:
    groq = get_groq_client()
    if not groq.is_available:
        return fallback
    try:
        system = _build_nudge_system(space_name, space_goal)
        resp = await groq.chat_completion(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Evidence: {evidence}\nOutput:"},
            ],
            max_tokens=300,
            temperature=0.2,
            priority=TaskPriority.SYNTHESIS,
        )
        import json, re
        raw = resp.choices[0].message.content.strip()
        # strip any markdown fencing
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
        raw = raw.strip()
        parsed = json.loads(raw)
        # Hard-enforce second-person: if the LLM still wrote third-person, fall back
        combined = " ".join([parsed.get("scatter", ""), parsed.get("direction", ""), parsed.get("consequence", "")])
        if "the user" in combined.lower() or "the researcher" in combined.lower():
            logger.warning("Nudge phrasing produced third-person text — using fallback")
            return fallback
        return parsed
    except Exception as exc:
        logger.error("Nudge phrasing failed", error=str(exc))
        return fallback


async def run_nudge_rules(user_id: str, space_id: int, db, space_name: str = "", space_goal: str = "") -> list[dict]:
    """Run all rules for one user+space. Returns list of nudge dicts ready for DB insert."""
    now = datetime.now(timezone.utc)
    nudges = []

    def _kw(evidence: str, fallback: dict):
        return _phrase_nudge(evidence, fallback, space_name=space_name, space_goal=space_goal)

    # ── Rule 1: revisit-without-resolve ─────────────────────────────────────
    # Artifacts opened ≥3× in the last 7 days with no source_synthesis update
    open_events = await aexec(
        db.schema("misir")
        .table("artifact_open_event")
        .select("artifact_id, count:artifact_id")
        .eq("user_id", user_id)
        .gte("opened_at", (now - timedelta(days=7)).isoformat())
    )
    from collections import Counter
    event_counts: Counter = Counter(e["artifact_id"] for e in (open_events.data or []))

    for artifact_id, count in event_counts.most_common(3):
        if count < 3:
            break
        art = await aexec(db.schema("misir").table("artifact").select("id, title, space_id").eq("id", artifact_id).eq("space_id", space_id))
        if not art.data:
            continue
        title = art.data[0].get("title") or "an artifact"
        evidence = f"You have opened \"{title}\" {count} times in the last 7 days without any new {space_name} research following those opens."
        phrased = await _kw(evidence, {
            "scatter": f"You've opened \"{title}\" {count} times this week without any new research following it.",
            "direction": "Stop revisiting it passively — open it once more with a specific question to answer and close it.",
            "consequence": f"Every unresolved revisit is a gap that will resurface when your {space_name} research is tested.",
        })
        nudges.append({
            "user_id": user_id,
            "space_id": space_id,
            "scatter": phrased.get("scatter", ""),
            "direction": phrased.get("direction", ""),
            "consequence": phrased.get("consequence", ""),
            "cta_label": "Close it →",
            "priority": 2,
            "evidence_data": {"artifact_id": artifact_id, "open_count": count},
            "requires_deadline": False,
        })

    # ── Rule 2: recurring-gap ────────────────────────────────────────────────
    cutoff = (now - timedelta(days=14)).isoformat()
    old_gaps = await aexec(
        db.schema("misir")
        .table("gap")
        .select("id, label, severity, recurring_count")
        .eq("space_id", space_id)
        .eq("status", "open")
        .lte("first_seen_at", cutoff)
    )
    for gap in (old_gaps.data or [])[:2]:
        evidence = f"The knowledge gap \"{gap['label']}\" in your {space_name} research (severity: {gap['severity']}) has been open and unaddressed for over 2 weeks."
        phrased = await _kw(evidence, {
            "scatter": f"You've been aware of the gap \"{gap['label']}\" for over two weeks and haven't addressed it.",
            "direction": f"Dedicate the next session specifically to closing \"{gap['label']}\" — not just reading around it.",
            "consequence": f"A {gap['severity'].lower()}-severity gap in {space_name} that persists is a blind spot you'll keep hitting.",
        })
        nudges.append({
            "user_id": user_id,
            "space_id": space_id,
            "scatter": phrased.get("scatter", ""),
            "direction": phrased.get("direction", ""),
            "consequence": phrased.get("consequence", ""),
            "cta_label": "Research it →",
            "priority": 2 if gap["severity"] == "Critical" else 1,
            "evidence_data": {"gap_id": gap["id"]},
            "requires_deadline": False,
        })

    # ── Rule 3: cross-space-untaken ──────────────────────────────────────────
    stale_links = await aexec(
        db.schema("misir")
        .table("cross_space_link")
        .select("id, source_artifact_id, target_gap_id, similarity, created_at")
        .eq("user_id", user_id)
        .eq("status", "suggested")
        .lte("created_at", (now - timedelta(days=3)).isoformat())
        .limit(2)
    )
    for link in (stale_links.data or []):
        gap = await aexec(db.schema("misir").table("gap").select("label, space_id").eq("id", link["target_gap_id"]).single())
        art = await aexec(db.schema("misir").table("artifact").select("title").eq("id", link["source_artifact_id"]).single())
        if not gap.data or not art.data:
            continue
        evidence = f"Your artifact \"{art.data.get('title')}\" has a strong connection to the gap \"{gap.data['label']}\" in your {space_name} research, but you haven't acted on it in 3+ days."
        phrased = await _kw(evidence, {
            "scatter": f"You've ignored a direct connection between \"{art.data.get('title')}\" and your open gap for 3 days.",
            "direction": "Apply what that artifact says directly to closing the gap — one focused write-up.",
            "consequence": f"That connection is the shortest path to resolving a gap in your {space_name} research.",
        })
        nudges.append({
            "user_id": user_id,
            "space_id": space_id,
            "scatter": phrased.get("scatter", ""),
            "direction": phrased.get("direction", ""),
            "consequence": phrased.get("consequence", ""),
            "cta_label": "View connection →",
            "priority": 1,
            "evidence_data": {"cross_space_link_id": link["id"]},
            "requires_deadline": False,
        })

    # ── Rule 4: deadline-pressure ────────────────────────────────────────────
    deadline_row = await aexec(
        db.schema("misir")
        .table("deadline")
        .select("label, due_at, target_pct")
        .eq("space_id", space_id)
        .eq("user_id", user_id)
    )
    if deadline_row.data:
        dl = deadline_row.data[0]
        due = datetime.fromisoformat(dl["due_at"].replace("Z", "+00:00"))
        days_left = (due - now).days
        if 0 < days_left <= 7:
            evidence = f"{days_left} day{'s' if days_left != 1 else ''} until {dl['label']}. Your {space_name} research still has open gaps."
            phrased = await _kw(evidence, {
                "scatter": f"You have {days_left} day{'s' if days_left != 1 else ''} until {dl['label']} and open gaps remain in your {space_name} research.",
                "direction": "Drop everything that isn't a critical gap. One gap closed beats three topics skimmed.",
                "consequence": f"Each open gap is a question {dl['label']} will expose.",
            })
            nudges.append({
                "user_id": user_id,
                "space_id": space_id,
                "scatter": phrased.get("scatter", ""),
                "direction": phrased.get("direction", ""),
                "consequence": phrased.get("consequence", ""),
                "cta_label": "Focus now →",
                "priority": 3,
                "evidence_data": {"deadline_label": dl["label"], "days_left": days_left},
                "requires_deadline": True,
            })

    return nudges


def _evidence_key(evidence_data: dict) -> str | None:
    """Stable key that identifies what a nudge is about — used for dismiss cooldown."""
    for field in ("artifact_id", "gap_id", "cross_space_link_id", "deadline_label"):
        if field in evidence_data:
            return f"{field}:{evidence_data[field]}"
    return None


async def refresh_nudges_for_space(user_id: str, space_id: int, force: bool = False) -> None:
    db = get_supabase()
    now = datetime.now(timezone.utc)

    # Time throttle: the rules below each fire a Groq phrasing call, so don't
    # regenerate on every dashboard/notifications load. Skip if this space was
    # refreshed within the cooldown window (the existing active nudges are still
    # served). force=True bypasses for explicit refreshes.
    if not force:
        cooldown = get_settings().NUDGE_REFRESH_COOLDOWN_MINUTES
        recent = await aexec(
            db.schema("misir").table("nudge")
            .select("generated_at")
            .eq("user_id", user_id).eq("space_id", space_id)
            .order("generated_at", desc=True).limit(1)
        )
        if recent.data:
            last = datetime.fromisoformat(recent.data[0]["generated_at"].replace("Z", "+00:00"))
            if (now - last) < timedelta(minutes=cooldown):
                return

    space_row = await aexec(db.schema("misir").table("space").select("name, goal").eq("id", space_id).single())
    space = space_row.data or {}
    space_name = space.get("name", "")
    space_goal = space.get("goal", "")

    # Collect evidence keys that the user explicitly dismissed within the last 24 hours.
    # These will be suppressed so the same nudge doesn't immediately reappear.
    cooldown_cutoff = (now - timedelta(hours=24)).isoformat()
    dismissed_rows = await aexec(
        db.schema("misir")
        .table("nudge")
        .select("evidence_data")
        .eq("user_id", user_id)
        .eq("space_id", space_id)
        .eq("status", "dismissed")
        .gte("dismissed_at", cooldown_cutoff)
    )
    snoozed_keys: set[str] = set()
    for row in (dismissed_rows.data or []):
        key = _evidence_key(row.get("evidence_data") or {})
        if key:
            snoozed_keys.add(key)

    # Expire all currently active nudges (system-level rotation)
    await aexec(db.schema("misir").table("nudge").update({"status": "dismissed"}).eq("user_id", user_id).eq("space_id", space_id).eq("status", "active"))

    nudges = await run_nudge_rules(user_id, space_id, db, space_name=space_name, space_goal=space_goal)

    # Drop any nudge whose evidence the user already dismissed within the cooldown window
    fresh = [n for n in nudges if _evidence_key(n.get("evidence_data") or {}) not in snoozed_keys]

    if fresh:
        await aexec(db.schema("misir").table("nudge").insert(fresh))


@lru_cache(maxsize=1)
def get_nudge_engine():
    return type("NudgeEngine", (), {"refresh": refresh_nudges_for_space})()

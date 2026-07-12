"""Markers + subspace-marker junction routes (Phase 3)."""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id
from interfaces.api.subspaces import _assert_space_owned

router = APIRouter(tags=["markers"])

# Learned markers are lower-confidence than curated ones (default 1.0), so they
# nudge matching without overpowering the hand-authored/generated vocabulary.
LEARNED_WEIGHT = 0.6

# Server-side junk filter for learned markers. The extension already POS/NER-gates
# candidates, but this endpoint is public, so it independently rejects terms that
# would pollute matching: anything with a digit (dates/years/counts) and lone
# generic/temporal/stop words. Multi-word phrases are given the benefit of the
# doubt. Keeps a bad client (or a future caller) from re-introducing noise markers.
_LEARN_WORD_RE = re.compile(r"^[a-z]+(?:[ -][a-z]+)*$")
_LEARN_JUNK_WORDS = {
    # articles / pronouns / generic function-ish words
    "the", "and", "for", "with", "from", "this", "that", "your", "their", "using",
    "about", "have", "will", "which", "into", "more", "than", "then", "they", "them",
    "also", "such", "these", "those", "other", "some", "what", "when", "where", "while",
    "been", "being", "here", "there", "over", "under", "each", "very", "much", "many",
    # temporal / quantity
    "second", "minute", "hour", "day", "week", "month", "year", "decade", "century",
    "time", "today", "tomorrow", "yesterday", "morning", "afternoon", "evening", "night",
    "weekend", "season", "spring", "summer", "autumn", "fall", "winter",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "june", "july", "august", "september",
    "october", "november", "december",
    "number", "amount", "part", "thing", "stuff", "kind", "type", "example", "lot",
    # ordinals
    "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
    "ninth", "tenth",
    # vague / meta / colours
    "green", "blue", "red", "black", "white", "page", "site", "website", "article",
    "post", "user", "assistant", "reader", "http", "https", "www", "com",
}


def _is_learnable(label: str) -> bool:
    """True if `label` is a plausible topic marker (not a date/number/generic word)."""
    if not (3 <= len(label) <= 60):
        return False
    if not _LEARN_WORD_RE.match(label):  # letters/spaces/hyphens only — no digits
        return False
    # Screen lone generic words; allow multi-word phrases through.
    if " " not in label and (label in _LEARN_JUNK_WORDS or len(label) < 4):
        return False
    return True


class MarkerCreate(BaseModel):
    label: str
    weight: float = 1.0


class SubspaceMarkerCreate(BaseModel):
    marker_id: int
    weight: float = 1.0
    source: Optional[str] = None


class LearnMarkersRequest(BaseModel):
    # Candidate topical terms mined from a page the user corrected onto this
    # subspace. Capped to bound abuse; the endpoint normalises + dedups further.
    terms: List[str] = Field(default_factory=list, max_length=24)


@router.get("/spaces/{space_id}/markers")
def list_markers(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    rows = db.schema("misir").table("marker").select("*").eq("space_id", space_id).execute()
    return rows.data or []


@router.post("/spaces/{space_id}/markers", status_code=201)
def create_marker(space_id: int, body: MarkerCreate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    row = db.schema("misir").table("marker").insert({"space_id": space_id, "label": body.label, "weight": body.weight}).execute()
    return row.data[0]


@router.delete("/spaces/{space_id}/markers/{marker_id}", status_code=204)
def delete_marker(space_id: int, marker_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    db.schema("misir").table("marker").delete().eq("id", marker_id).eq("space_id", space_id).execute()


@router.get("/spaces/{space_id}/subspaces/{subspace_id}/markers")
def list_subspace_markers(space_id: int, subspace_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    rows = db.schema("misir").table("subspace_marker").select("*, marker(*)").eq("subspace_id", subspace_id).execute()
    return rows.data or []


@router.post("/spaces/{space_id}/subspaces/{subspace_id}/markers", status_code=201)
def add_subspace_marker(space_id: int, subspace_id: int, body: SubspaceMarkerCreate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    row = db.schema("misir").table("subspace_marker").upsert(
        {"subspace_id": subspace_id, "marker_id": body.marker_id, "weight": body.weight, "source": body.source},
        on_conflict="subspace_id,marker_id",
    ).execute()
    return row.data[0]


@router.post("/spaces/{space_id}/subspaces/{subspace_id}/markers/learn", status_code=201)
def learn_subspace_markers(
    space_id: int,
    subspace_id: int,
    body: LearnMarkersRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Feedback loop: when a user corrects a page onto this subspace, persist the
    page's salient terms as low-weight 'learned' markers so future pages with the
    same vocabulary match here automatically. Idempotent per (subspace, label)."""
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)

    # The subspace must belong to the owned space.
    sub = (
        db.schema("misir").table("subspace")
        .select("id").eq("id", subspace_id).eq("space_id", space_id).execute()
    )
    if not sub.data:
        raise HTTPException(status_code=404, detail="Subspace not found")

    # Normalise, filter junk (dates/numbers/generic words), and dedup.
    labels: list[str] = []
    seen: set[str] = set()
    for t in body.terms:
        label = (t or "").strip().lower()
        if label in seen or not _is_learnable(label):
            continue
        seen.add(label)
        labels.append(label)
    labels = labels[:8]  # a handful of the strongest terms is plenty per correction
    if not labels:
        return {"added": []}

    # Reuse existing markers in the space by label (case-insensitive) so we don't
    # create duplicates; only insert genuinely new terms.
    existing = db.schema("misir").table("marker").select("id, label").eq("space_id", space_id).execute()
    by_label = {(r.get("label") or "").strip().lower(): r["id"] for r in (existing.data or [])}

    added = []
    for label in labels:
        marker_id = by_label.get(label)
        if marker_id is None:
            row = db.schema("misir").table("marker").insert(
                {"space_id": space_id, "label": label, "weight": LEARNED_WEIGHT}
            ).execute()
            marker_id = row.data[0]["id"]
            by_label[label] = marker_id
        db.schema("misir").table("subspace_marker").upsert(
            {"subspace_id": subspace_id, "marker_id": marker_id, "weight": LEARNED_WEIGHT, "source": "learned"},
            on_conflict="subspace_id,marker_id",
        ).execute()
        added.append({"id": marker_id, "label": label})

    return {"added": added}

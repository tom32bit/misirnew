"""Spaces CRUD routes (Phase 3)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from core.config import get_settings
from core.limiter import limiter
from core.logging_config import get_logger
from infrastructure.services.space_generator import generate_space_structure
from infrastructure.services.supabase_client import get_supabase

router = APIRouter(tags=["spaces"])
logger = get_logger(__name__)
_settings = get_settings()


class SpaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    goal: Optional[str] = Field(default=None, max_length=4000)
    description: Optional[str] = Field(default=None, max_length=4000)


class SpaceGenerate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    intention: Optional[str] = Field(default=None, max_length=4000)


class SpaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    goal: Optional[str] = Field(default=None, max_length=4000)
    description: Optional[str] = Field(default=None, max_length=4000)


def _resolve_user_id(db, clerk_user_id: str, email: str = "") -> str:
    """
    Resolve internal user UUID from Clerk user ID.
    Auto-upserts the auth_user row on first call so any endpoint works
    without requiring the frontend to hit /me first.
    """
    rows = (
        db.schema("misir")
        .table("auth_user")
        .select("id")
        .eq("clerk_user_id", clerk_user_id)
        .execute()
    )
    if rows.data:
        return rows.data[0]["id"]

    # First-time user — create the row
    upserted = (
        db.schema("misir")
        .table("auth_user")
        .upsert(
            {"clerk_user_id": clerk_user_id, "email": email},
            on_conflict="clerk_user_id",
        )
        .execute()
    )
    if not upserted.data:
        raise HTTPException(status_code=500, detail="Failed to provision user")
    user_id = upserted.data[0]["id"]
    db.schema("misir").table("profile").upsert(
        {"id": user_id}, on_conflict="id"
    ).execute()
    return user_id


@router.get("/spaces")
def list_spaces(current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    rows = db.schema("misir").table("space").select("*").eq("user_id", user_id).order("created_at", desc=False).execute()
    return rows.data or []


@router.post("/spaces", status_code=201)
def create_space(body: SpaceCreate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    row = db.schema("misir").table("space").insert({
        "user_id": user_id,
        "name": body.name,
        "goal": body.goal,
        "description": body.description,
    }).execute()
    return row.data[0]


@router.post("/spaces/generate", status_code=201)
@limiter.limit(_settings.RATE_LIMIT_GENERATE)
async def generate_space(request: Request, body: SpaceGenerate, current_user: CurrentUser = Depends(get_current_user)):
    """
    Create a space and bootstrap it with AI-generated subspaces + markers.

    Why: subspaces and markers drive the extension's lexical capture matching.
    A fresh space without markers will never auto-capture anything, so we
    seed it from the user's stated intention via Groq.

    The space is always created. If the LLM call fails or its output is
    malformed, the space comes back without subspaces — the user can add
    them manually instead of being blocked.
    """
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Space name is required")

    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id, current_user.email)

    # Try AI generation first (network call, may fail)
    structure = await generate_space_structure(body.name, body.intention or "")

    # Create the space row
    space_row = db.schema("misir").table("space").insert({
        "user_id": user_id,
        "name": body.name,
        "goal": body.intention,
        "description": body.intention,
    }).execute()
    if not space_row.data:
        raise HTTPException(status_code=500, detail="Failed to create space")
    space = space_row.data[0]
    space_id = space["id"]

    if structure is None:
        return {**space, "subspaces": [], "ai_generated": False}

    # Insert subspaces in one round trip — Supabase preserves input order in the response
    sub_rows = (
        db.schema("misir").table("subspace").insert([
            {"space_id": space_id, "name": s.name, "description": s.description}
            for s in structure.subspaces
        ]).execute()
    )
    inserted_subs = sub_rows.data or []
    if len(inserted_subs) != len(structure.subspaces):
        logger.warning("Subspace insert returned unexpected row count", expected=len(structure.subspaces), got=len(inserted_subs))

    # Flatten markers and remember which subspace index (and the marker model) each one came from
    flat_markers: list[tuple[int, "GeneratedMarker"]] = []  # type: ignore[name-defined]
    for s_idx, sub in enumerate(structure.subspaces):
        for m in sub.markers:
            flat_markers.append((s_idx, m))

    if flat_markers:
        marker_rows = (
            db.schema("misir").table("marker").insert([
                {"space_id": space_id, "label": m.label, "weight": m.weight}
                for _, m in flat_markers
            ]).execute()
        )
        inserted_markers = marker_rows.data or []

        junction_rows = [
            {
                "subspace_id": inserted_subs[s_idx]["id"],
                "marker_id":   inserted_markers[i]["id"],
                "weight":      m.weight,
                "source":      "ai_generated",
            }
            for i, (s_idx, m) in enumerate(flat_markers)
            if s_idx < len(inserted_subs) and i < len(inserted_markers)
        ]
        if junction_rows:
            db.schema("misir").table("subspace_marker").insert(junction_rows).execute()

    return {
        **space,
        "subspaces": [
            {
                **inserted_subs[i],
                "markers": [
                    {"label": m.label, "weight": m.weight}
                    for m in structure.subspaces[i].markers
                ],
            }
            for i in range(len(inserted_subs))
        ],
        "ai_generated": True,
    }


@router.get("/spaces/{space_id}")
def get_space(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    row = db.schema("misir").table("space").select("*").eq("id", space_id).eq("user_id", user_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Space not found")
    return row.data


@router.patch("/spaces/{space_id}")
def update_space(space_id: int, body: SpaceUpdate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    row = db.schema("misir").table("space").update(updates).eq("id", space_id).eq("user_id", user_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Space not found")
    return row.data[0]


@router.delete("/spaces/{space_id}", status_code=204)
def delete_space(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)

    # Verify ownership before touching anything
    owned = db.schema("misir").table("space").select("id").eq("id", space_id).eq("user_id", user_id).execute()
    if not owned.data:
        raise HTTPException(status_code=404, detail="Space not found")

    # Collect IDs needed for child deletes
    art_ids = [r["id"] for r in (db.schema("misir").table("artifact").select("id").eq("space_id", space_id).execute().data or [])]
    sub_ids = [r["id"] for r in (db.schema("misir").table("subspace").select("id").eq("space_id", space_id).execute().data or [])]
    gap_ids = [r["id"] for r in (db.schema("misir").table("gap").select("id").eq("space_id", space_id).execute().data or [])]
    conv_ids = [r["id"] for r in (db.schema("misir").table("chat_conversation").select("id").eq("space_id", space_id).execute().data or [])]

    # Delete in FK dependency order (children before parents)
    if sub_ids:
        db.schema("misir").table("subspace_marker").delete().in_("subspace_id", sub_ids).execute()
    if art_ids:
        db.schema("misir").table("source_synthesis").delete().in_("artifact_id", art_ids).execute()
        db.schema("misir").table("artifact_open_event").delete().in_("artifact_id", art_ids).execute()
        db.schema("misir").table("artifact_tag").delete().in_("artifact_id", art_ids).execute()
        db.schema("misir").table("cross_space_link").delete().in_("source_artifact_id", art_ids).execute()
    if gap_ids:
        db.schema("misir").table("cross_space_link").delete().in_("target_gap_id", gap_ids).execute()
    if conv_ids:
        db.schema("misir").table("chat_message").delete().in_("conversation_id", conv_ids).execute()

    db.schema("misir").table("artifact").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("gap").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("subspace").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("marker").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("chat_conversation").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("deadline").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("nudge").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("report").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("space_summary").delete().eq("space_id", space_id).execute()
    db.schema("misir").table("space").delete().eq("id", space_id).eq("user_id", user_id).execute()

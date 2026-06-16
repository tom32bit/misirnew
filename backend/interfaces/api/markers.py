"""Markers + subspace-marker junction routes (Phase 3)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id
from interfaces.api.subspaces import _assert_space_owned

router = APIRouter(tags=["markers"])


class MarkerCreate(BaseModel):
    label: str
    weight: float = 1.0


class SubspaceMarkerCreate(BaseModel):
    marker_id: int
    weight: float = 1.0
    source: Optional[str] = None


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

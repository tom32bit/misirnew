"""Subspaces CRUD routes (Phase 3)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id

router = APIRouter(tags=["subspaces"])


class SubspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class SubspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


def _assert_space_owned(db, space_id: int, user_id: str):
    row = db.schema("misir").table("space").select("id").eq("id", space_id).eq("user_id", user_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Space not found")


@router.get("/spaces/{space_id}/subspaces")
def list_subspaces(space_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    rows = db.schema("misir").table("subspace").select("*").eq("space_id", space_id).execute()
    return rows.data or []


@router.post("/spaces/{space_id}/subspaces", status_code=201)
def create_subspace(space_id: int, body: SubspaceCreate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    row = db.schema("misir").table("subspace").insert({"space_id": space_id, "name": body.name, "description": body.description}).execute()
    return row.data[0]


@router.patch("/spaces/{space_id}/subspaces/{subspace_id}")
def update_subspace(space_id: int, subspace_id: int, body: SubspaceUpdate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    row = db.schema("misir").table("subspace").update(updates).eq("id", subspace_id).eq("space_id", space_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Subspace not found")
    return row.data[0]


@router.delete("/spaces/{space_id}/subspaces/{subspace_id}", status_code=204)
def delete_subspace(space_id: int, subspace_id: int, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)
    db.schema("misir").table("subspace_marker").delete().eq("subspace_id", subspace_id).execute()
    db.schema("misir").table("subspace").delete().eq("id", subspace_id).eq("space_id", space_id).execute()

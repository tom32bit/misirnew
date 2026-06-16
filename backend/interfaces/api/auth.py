"""Auth routes — /me endpoint (Phase 1)."""
from fastapi import APIRouter, Depends
from auth.clerk import CurrentUser, get_current_user
from infrastructure.services.supabase_client import get_supabase

router = APIRouter(tags=["auth"])


@router.get("/me")
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """
    Verify JWT and upsert auth_user + profile row.
    Called by frontend on first load and by extension on startup.
    """
    db = get_supabase()

    # Upsert auth_user
    user_row = (
        db.schema("misir")
        .table("auth_user")
        .upsert(
            {"clerk_user_id": current_user.clerk_user_id, "email": current_user.email},
            on_conflict="clerk_user_id",
        )
        .execute()
    )

    user_data = user_row.data[0] if user_row.data else None
    if not user_data:
        return {"error": "Failed to upsert user"}

    internal_id = user_data["id"]

    # Upsert profile (no-op if exists)
    db.schema("misir").table("profile").upsert(
        {"id": internal_id},
        on_conflict="id",
    ).execute()

    return {
        "id": internal_id,
        "clerk_user_id": current_user.clerk_user_id,
        "email": current_user.email,
    }

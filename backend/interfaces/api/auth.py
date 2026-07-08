"""Auth routes — /me endpoint (Phase 1)."""
from fastapi import APIRouter, Depends
from auth.clerk import CurrentUser, get_current_user, fetch_clerk_email
from infrastructure.services.supabase_client import get_supabase

router = APIRouter(tags=["auth"])


@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """
    Verify JWT and upsert auth_user + profile row.
    Called by frontend on first load and by extension on startup.
    """
    db = get_supabase()

    # Upsert auth_user. Only write email when the token actually carries one, so
    # a session token without an email claim doesn't wipe a previously-stored
    # address (e.g. captured earlier from a richer frontend token).
    payload = {"clerk_user_id": current_user.clerk_user_id}
    if current_user.email:
        payload["email"] = current_user.email

    user_row = (
        db.schema("misir")
        .table("auth_user")
        .upsert(payload, on_conflict="clerk_user_id")
        .execute()
    )

    user_data = user_row.data[0] if user_row.data else None
    if not user_data:
        return {"error": "Failed to upsert user"}

    internal_id = user_data["id"]
    email = user_data.get("email") or current_user.email

    # Session tokens often omit email; look it up from Clerk (source of truth)
    # and persist it, so the account UI can show a real address.
    if not email:
        email = await fetch_clerk_email(current_user.clerk_user_id)
        if email:
            db.schema("misir").table("auth_user").update({"email": email}).eq(
                "clerk_user_id", current_user.clerk_user_id
            ).execute()

    # Upsert profile (no-op if exists)
    db.schema("misir").table("profile").upsert(
        {"id": internal_id},
        on_conflict="id",
    ).execute()

    return {
        "id": internal_id,
        "clerk_user_id": current_user.clerk_user_id,
        "email": email,
    }

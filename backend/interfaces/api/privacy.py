"""
Privacy & data-subject-rights routes.

  GET    /me/consent          — list consents + current policy version
  PUT    /me/consent          — record affirmative, per-purpose consent
  GET    /me/export           — export all personal data (portability)
  DELETE /me                  — erase the account and all personal data
  POST   /internal/purge-expired  — retention purge (ops-token gated)

Consent gates collection elsewhere (see artifacts capture). All actions are
audited (audit_service) without storing raw personal data.
"""
# NOTE: no `from __future__ import annotations` — see artifacts.py. The
# @limiter.limit decorator + stringified annotations make FastAPI misclassify
# the request body / BackgroundTasks as query params (422 "Field required").

import hmac
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from auth.clerk import CurrentUser, delete_clerk_user, get_current_user
from core.config import get_settings
from core.limiter import limiter
from infrastructure.services import account_service, consent_service, retention_service
from infrastructure.services.audit_service import record_audit
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id

router = APIRouter(tags=["privacy"])
_settings = get_settings()


class ConsentItem(BaseModel):
    purpose: str = Field(..., max_length=40)
    granted: bool


class ConsentUpdate(BaseModel):
    consents: List[ConsentItem] = Field(..., max_length=20)
    jurisdiction: Optional[str] = Field(default=None, max_length=8)
    gpc: bool = False


# ── Consent ──────────────────────────────────────────────────────────────────

@router.get("/me/consent")
def get_consent(current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id, current_user.email)
    return {
        "policy_version": _settings.PRIVACY_POLICY_VERSION,
        "data_region": _settings.DATA_REGION,
        "consents": consent_service.list_consents(db, user_id),
    }


@router.put("/me/consent")
def update_consent(body: ConsentUpdate, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id, current_user.email)
    updated = []
    for item in body.consents:
        if item.purpose not in consent_service.VALID_PURPOSES:
            raise HTTPException(status_code=400, detail=f"Unknown consent purpose: {item.purpose}")
        consent_service.set_consent(
            db, user_id, item.purpose, item.granted,
            jurisdiction=body.jurisdiction, source="frontend", gpc=body.gpc,
        )
        updated.append({"purpose": item.purpose, "granted": item.granted})
    record_audit(user_id, "consent.update", {
        "purposes": updated, "jurisdiction": body.jurisdiction, "gpc": body.gpc,
        "policy_version": _settings.PRIVACY_POLICY_VERSION,
    })
    return {"policy_version": _settings.PRIVACY_POLICY_VERSION, "consents": consent_service.list_consents(db, user_id)}


# ── Export (portability) ──────────────────────────────────────────────────────

@router.get("/me/export")
@limiter.limit("10/minute")
def export_me(request: Request, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id, current_user.email)
    data = account_service.export_user_data(db, user_id)
    record_audit(user_id, "account.export", {"tables": list(data.keys())})
    payload = {
        "exported_at_utc": None,  # stamped by client; server clock omitted intentionally
        "user": {"id": user_id, "clerk_user_id": current_user.clerk_user_id, "email": current_user.email},
        "policy_version": _settings.PRIVACY_POLICY_VERSION,
        "data": data,
    }
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": 'attachment; filename="misir-data-export.json"'},
    )


# ── Erasure ───────────────────────────────────────────────────────────────────

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_me(request: Request, current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id, current_user.email)
    # Audit BEFORE deletion (the row's user_id is nulled afterwards).
    record_audit(user_id, "account.delete", {"clerk_user_id": current_user.clerk_user_id})
    account_service.delete_user_account(db, user_id)
    # Fan-out erasure to the Clerk identity (GDPR Art 17). Best-effort: if
    # CLERK_SECRET_KEY is unset or the call fails, flag for manual ops follow-up.
    clerk_deleted = await delete_clerk_user(current_user.clerk_user_id)
    if not clerk_deleted:
        record_audit(None, "account.delete.clerk_pending", {"clerk_user_id": current_user.clerk_user_id})


# ── Retention purge (ops) ─────────────────────────────────────────────────────

@router.post("/internal/purge-expired")
@limiter.exempt
def purge_expired(x_internal_token: str = Header(default="")):
    token = _settings.INTERNAL_OPS_TOKEN
    if not token:
        raise HTTPException(status_code=404, detail="Not found")
    if not hmac.compare_digest(x_internal_token, token):
        raise HTTPException(status_code=403, detail="Forbidden")
    result = retention_service.purge_expired(get_supabase())
    record_audit(None, "retention.purge", result)
    return result

"""
Dashboard report endpoint (Phase 5).
GET /dashboard/{space_id}?period=week  →  full dashboard payload
POST /reports/regenerate               →  force fresh Stage A + B pass
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from auth.clerk import CurrentUser, get_current_user
from core.config import get_settings
from core.limiter import limiter
from infrastructure.services.supabase_client import get_supabase
from interfaces.api.spaces import _resolve_user_id
from interfaces.api.subspaces import _assert_space_owned

router = APIRouter(tags=["reports"])
_settings = get_settings()


@router.get("/dashboard/{space_id}")
@limiter.limit(_settings.RATE_LIMIT_DASHBOARD)
async def get_dashboard(
    request: Request,
    space_id: int,
    period: str = Query("week", regex="^(today|week|month)$"),
    date: str = Query(None),
    tz_offset: int = Query(0),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Returns one payload with everything the four dashboard tabs need:
    { misirs_read, sources[], synthesis, research_depth[], cross_space[],
      activity[], gaps[], nudges[], deadline | null }

    Backed by Stage A + Stage B caches (§2.1). Triggers regeneration on miss.
    """
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)

    from application.handlers.report_handler import get_dashboard_payload
    return await get_dashboard_payload(user_id=user_id, space_id=space_id, period=period, date=date, tz_offset=tz_offset, db=db)


@router.post("/reports/regenerate", status_code=202)
@limiter.limit(_settings.RATE_LIMIT_REGENERATE)
async def regenerate_reports(
    request: Request,
    space_id: int,
    period: str = Query("week"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Force a fresh Stage A + B pass for this space/period."""
    db = get_supabase()
    user_id = _resolve_user_id(db, current_user.clerk_user_id)
    _assert_space_owned(db, space_id, user_id)

    from infrastructure.services.report_cache import invalidate_space
    await invalidate_space(space_id)

    from application.handlers.report_handler import get_dashboard_payload
    background_tasks.add_task(get_dashboard_payload, user_id=user_id, space_id=space_id, period=period, db=db)
    return {"queued": True}

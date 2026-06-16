"""
Misir v2.0 — FastAPI application entry point.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import get_settings
from core.error_handlers import (
    generic_exception_handler,
    pydantic_validation_error_handler,
    value_error_handler,
)
from core.limiter import limiter
from core.logging_config import configure_logging
from core.middleware.body_size import BodySizeLimitMiddleware
from core.middleware.metrics import MetricsMiddleware

# Route imports — added incrementally per phase
from interfaces.api import auth as auth_router
from interfaces.api import spaces as spaces_router
from interfaces.api import subspaces as subspaces_router
from interfaces.api import markers as markers_router
from interfaces.api import artifacts as artifacts_router
from interfaces.api import gaps as gaps_router
from interfaces.api import deadlines as deadlines_router
from interfaces.api import nudges as nudges_router
from interfaces.api import reports as reports_router
from interfaces.api import chat as chat_router
from interfaces.api import inbox as inbox_router
from interfaces.api import privacy as privacy_router


settings = get_settings()
configure_logging(settings.LOG_LEVEL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up embedding model on startup (non-blocking; loads in background thread)
    import asyncio
    from infrastructure.services.embedding_service import get_embedding_service
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: get_embedding_service())
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# ── Rate limiter ─────────────────────────────────────────────────────────────
# Set before SlowAPIMiddleware is added — the middleware reads app.state.limiter.

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware ──────────────────────────────────────────────────────────────
# Added inner→outer; execution is the reverse (outermost runs first):
#   Metrics → CORS → BodySizeLimit → SlowAPI(global rate limit) → app
# Metrics is outermost so 429/413 rejections are still logged; CORS sits above
# the limiter so preflight OPTIONS short-circuit without consuming rate quota
# and 429/413 responses still carry CORS headers.

app.add_middleware(SlowAPIMiddleware)          # enforces RATE_LIMIT_DEFAULT on every route
app.add_middleware(BodySizeLimitMiddleware)    # rejects oversized payloads (413)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(MetricsMiddleware)          # outermost — logs every response incl. 429/413

# ── Error handlers ───────────────────────────────────────────────────────────

app.add_exception_handler(ValidationError, pydantic_validation_error_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# ── Routes ───────────────────────────────────────────────────────────────────

V1 = settings.API_V1_STR

app.include_router(auth_router.router,       prefix=V1)
app.include_router(spaces_router.router,     prefix=V1)
app.include_router(subspaces_router.router,  prefix=V1)
app.include_router(markers_router.router,    prefix=V1)
app.include_router(artifacts_router.router,  prefix=V1)
app.include_router(gaps_router.router,       prefix=V1)
app.include_router(deadlines_router.router,  prefix=V1)
app.include_router(nudges_router.router,     prefix=V1)
app.include_router(reports_router.router,    prefix=V1)
app.include_router(chat_router.router,       prefix=V1)
app.include_router(inbox_router.router,      prefix=V1)
app.include_router(privacy_router.router,    prefix=V1)


@app.get("/health", tags=["system"])
@limiter.exempt
async def health():
    return {"status": "ok", "version": settings.VERSION}

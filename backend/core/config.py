"""Core configuration from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    PROJECT_NAME: str = "Misir"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"

    # Supabase (service-role only — backend never exposes anon key)
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    # Clerk JWT verification
    CLERK_JWKS_URL: str                          # https://<clerk-frontend-api>/.well-known/jwks.json
    CLERK_JWT_TEMPLATE: str = "misir-backend"   # must match Clerk JWT template name

    # JWT hardening (RFC 8725). Issuer is verified by default — auto-derived from
    # CLERK_JWKS_URL when CLERK_ISSUER is blank (e.g. https://<sub>.clerk.accounts.dev).
    # Audience verification is OPT-IN: default Clerk session tokens (getToken() with
    # no template, as the frontend/extension use today) carry no app-specific `aud`,
    # so only set CLERK_JWT_AUDIENCE once a JWT template that stamps `aud` is in use.
    CLERK_ISSUER: str = ""
    CLERK_JWT_AUDIENCE: str = ""
    # Clerk Backend API secret — enables deleting the Clerk identity itself on
    # account erasure (GDPR Art 17 fan-out). When empty, Clerk deletion is
    # skipped and flagged in the audit log for manual ops follow-up.
    CLERK_SECRET_KEY: str = ""

    # CORS — frontend origin(s) + extension
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    LOG_LEVEL: str = "INFO"

    # Embedding
    EMBEDDING_MODEL: str = "nomic-ai/nomic-embed-text-v1.5"
    EMBEDDING_DIM: int = 768
    # Provider: 'local' loads the torch model in-process (~1-1.5GB RAM);
    # 'nomic' calls Nomic's hosted API (same model + 768 dims, no migration) so
    # the backend fits small-RAM hosts and avoids cold-start model reloads.
    EMBEDDING_PROVIDER: str = "local"          # 'local' | 'nomic'
    NOMIC_API_KEY: str = ""
    NOMIC_EMBED_URL: str = "https://api-atlas.nomic.ai/v1/embedding/text"

    # Cross-space link similarity threshold
    CROSS_SPACE_SIMILARITY_THRESHOLD: float = 0.72

    # Groq
    GROQ_API_KEY: str = ""
    LLM_MODEL: str = "qwen/qwen3-32b"
    # Reasoning models (Qwen3) emit <think> chain-of-thought. "hidden" drops it
    # so responses stay clean; only sent to Qwen models (see GroqClient). Empty
    # to disable (e.g. when reverting to a non-reasoning model like Llama).
    GROQ_REASONING_FORMAT: str = "hidden"
    LLM_MAX_TOKENS: int = 1024
    GROQ_TPM_LIMIT: int = 30000
    GROQ_RPM_LIMIT: int = 30
    GROQ_MAX_WAIT_SECONDS: float = 30.0
    GROQ_DEFAULT_TOKEN_ESTIMATE: int = 500

    # Chat
    CHAT_LLM_MODEL: str = ""
    CHAT_MAX_CONTEXT_TOKENS: int = 10000
    CHAT_MAX_HISTORY_MESSAGES: int = 50
    CHAT_MAX_RESPONSE_TOKENS: int = 2048

    # Stage A artifact cap per period
    STAGE_A_K_TODAY: int = 15
    STAGE_A_K_WEEK: int = 25
    STAGE_A_K_MONTH: int = 40

    # Synthesis engagement gate — minimum level to run LLM per-artifact
    # 'passive' | 'active' | 'deep'. AI-chat always bypasses.
    SYNTHESIS_MIN_ENGAGEMENT: str = "passive"
    SYNTHESIS_WEB_MIN_WORDS: int = 200

    # Confidence formula decay constant (§2.4)
    RECENCY_LAMBDA: float = 0.05

    # Research depth — target artifacts per topic
    RESEARCH_DEPTH_TARGET: int = 10

    # Nudge refresh throttle — the nudge phrasing pass fires several Groq calls,
    # so don't regenerate on every dashboard/notifications load. Skip if the
    # space's nudges were refreshed within this window (minutes).
    NUDGE_REFRESH_COOLDOWN_MINUTES: int = 30

    # Rate limiting
    RATE_LIMIT_STORAGE: str = "memory"
    REDIS_URL: str = "redis://localhost:6379"

    # Rate-limit buckets (slowapi) — DoS / abuse protection. Keyed per
    # authenticated user, falling back to client IP for unauthenticated traffic.
    RATE_LIMIT_DEFAULT: str = "240/minute"     # global safety net applied to every route
    RATE_LIMIT_LLM: str = "20/minute"          # chat streaming (expensive LLM)
    RATE_LIMIT_GENERATE: str = "10/minute"     # AI space generation (LLM)
    RATE_LIMIT_REGENERATE: str = "10/minute"   # forced report regeneration (LLM)
    RATE_LIMIT_DASHBOARD: str = "60/minute"    # dashboard (LLM on cache miss)
    RATE_LIMIT_CAPTURE: str = "120/minute"     # artifact capture (triggers embed + synthesis)

    # Max request body size in bytes — memory-exhaustion / payload-flood guard.
    MAX_REQUEST_BODY_BYTES: int = 2_000_000    # ~2 MB

    # Job queue — when enabled (and REDIS_URL set), the post-capture pipeline
    # (embed + synthesize + cross-link) and gap embedding are pushed to a Redis
    # queue processed by a separate worker, so they SURVIVE on ephemeral/
    # serverless hosts (FastAPI BackgroundTasks do not). Default off → in-process
    # BackgroundTasks (unchanged). Enabling this REQUIRES running the worker:
    #   python -m infrastructure.jobs.worker
    JOB_QUEUE_ENABLED: bool = False

    # ── Privacy / data-rights ────────────────────────────────────────────────
    # Current privacy-policy version users consent to (bump on policy changes).
    PRIVACY_POLICY_VERSION: str = "2026-06-07"
    # Require an affirmative consent row before accepting captured artifacts.
    REQUIRE_CAPTURE_CONSENT: bool = True
    # Storage-limitation window (days) for the retention purge. Must match the
    # period published in the privacy policy and the pg_cron schedule.
    RETENTION_DAYS: int = 400
    # Data-residency region for documentation/headers ('US' | 'EU' | ...).
    # Actual hosting region is a deployment choice; this records the intent.
    DATA_REGION: str = "US"
    # Shared secret protecting internal ops endpoints (retention purge). When
    # empty the internal purge endpoint is disabled (use pg_cron instead).
    INTERNAL_OPS_TOKEN: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

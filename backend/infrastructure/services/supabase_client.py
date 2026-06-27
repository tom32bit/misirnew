"""
Supabase service-role client singleton.

The backend uses service_role only — never anon key. RLS is OFF on the misir
schema; auth correctness comes from the Clerk JWT layer above.
"""
from functools import lru_cache
import httpx
from supabase import create_client, Client
from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    settings = get_settings()
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    # The postgrest layer creates its session with http2=True by default.
    # Supabase's ALB drops idle HTTP/2 connections after ~60s; the SDK reuses
    # them, causing RemoteProtocolError: Server disconnected. Replace the
    # session with HTTP/1.1 and keepalive_expiry below the ALB idle timeout.
    pg = client.postgrest
    old = pg.session
    pg.session = httpx.Client(
        base_url=str(old.base_url),
        headers=dict(old.headers),
        timeout=30.0,
        http2=False,
        follow_redirects=True,
        limits=httpx.Limits(
            max_connections=10,
            max_keepalive_connections=5,
            keepalive_expiry=25,
        ),
    )
    old.close()
    logger.info("Supabase client initialised", url=settings.SUPABASE_URL)
    return client

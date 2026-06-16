"""
Supabase service-role client singleton.

The backend uses service_role only — never anon key. RLS is OFF on the misir
schema; auth correctness comes from the Clerk JWT layer above.
"""
from functools import lru_cache
from supabase import create_client, Client
from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    settings = get_settings()
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    logger.info("Supabase client initialised", url=settings.SUPABASE_URL)
    return client

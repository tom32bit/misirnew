"""
Base repository — thin wrapper around the Supabase client.

All repository calls use the service-role client. The user_id scope is
passed explicitly from the handler layer (never inferred from RLS).
"""
from supabase import Client
from infrastructure.services.supabase_client import get_supabase


class BaseRepository:
    def __init__(self, client: Client | None = None) -> None:
        self._db: Client = client or get_supabase()

    @property
    def db(self) -> Client:
        return self._db

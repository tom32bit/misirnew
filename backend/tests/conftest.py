"""Test configuration. Sets the env Settings requires BEFORE the app is imported,
and provides app/client fixtures + per-test settings-cache isolation."""
import os

# Required (no defaults) — must exist before core.config is imported.
os.environ.setdefault("SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy-service-key")
os.environ.setdefault("CLERK_JWKS_URL", "https://dummy.clerk.accounts.dev/.well-known/jwks.json")
# Keep the suite deterministic: in-process limiter, generous default so single
# requests never trip the limiter (429 behaviour is asserted structurally).
os.environ.setdefault("RATE_LIMIT_STORAGE", "memory")
os.environ.setdefault("RATE_LIMIT_DEFAULT", "100000/minute")
os.environ.setdefault("MAX_REQUEST_BODY_BYTES", "2000000")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _settings_cache_isolation():
    """Clear the lru_cached Settings before and after each test so env tweaks
    (e.g. monkeypatch.setenv) don't leak across tests."""
    from core.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def app():
    import main
    return main.app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)

"""DoS guards (rate limiter, body-size) + auth gating + middleware wiring."""
import pytest
from starlette.requests import Request

import main
from core.limiter import _identity_key


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_body_too_large_returns_413(client):
    big = "x" * (2_000_001)  # > MAX_REQUEST_BODY_BYTES (2 MB)
    r = client.post("/api/v1/artifacts/capture", content=big, headers={"Content-Type": "application/json"})
    assert r.status_code == 413


@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/spaces"),
    ("get", "/api/v1/me/consent"),
    ("get", "/api/v1/me/export"),
    ("delete", "/api/v1/me"),
    ("post", "/api/v1/artifacts/capture"),
])
def test_protected_endpoints_require_auth(client, method, path):
    r = client.post(path, json={}) if method == "post" else getattr(client, method)(path)
    assert r.status_code in (401, 403)


def test_internal_purge_disabled_by_default(client):
    # INTERNAL_OPS_TOKEN unset → endpoint behaves as not-found
    assert client.post("/api/v1/internal/purge-expired").status_code == 404


def test_identity_key_prefers_user_then_ip():
    scope = {"type": "http", "headers": [], "client": ("9.9.9.9", 0)}
    assert _identity_key(Request(scope)) == "9.9.9.9"
    req = Request(scope)
    req.state.clerk_user_id = "user_abc"
    assert _identity_key(req) == "user:user_abc"


def test_dos_middleware_and_limiter_configured():
    assert main.limiter._default_limits  # global default present
    names = {m.cls.__name__ for m in main.app.user_middleware}
    assert {"SlowAPIMiddleware", "BodySizeLimitMiddleware", "MetricsMiddleware"} <= names


def test_api_docs_are_not_public_by_default():
    """/docs, /redoc and openapi.json enumerate every route, parameter and model.
    They default to off so a deployment doesn't hand that out to anyone asking;
    DOCS_ENABLED=true turns them back on locally."""
    from fastapi.testclient import TestClient

    client = TestClient(main.app, raise_server_exceptions=False)
    for path in ("/docs", "/redoc", "/api/v1/openapi.json"):
        assert client.get(path).status_code == 404, f"{path} should not be served"

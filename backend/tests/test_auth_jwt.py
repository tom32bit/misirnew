"""Clerk JWT verification (R4): issuer pinning + opt-in audience."""
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwk, jwt

from auth import clerk
from core.config import get_settings


def _keypair_and_jwk(kid="test"):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    pub_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    d = jwk.construct(pub_pem, "RS256").to_dict()
    d = {k: (v.decode() if isinstance(v, bytes) else v) for k, v in d.items()}
    d.update({"kid": kid, "use": "sig", "alg": "RS256"})
    return priv_pem, d


def _settings(issuer="", jwks_url="", audience=""):
    return type("S", (), {
        "CLERK_ISSUER": issuer, "CLERK_JWKS_URL": jwks_url, "CLERK_JWT_AUDIENCE": audience,
    })()


def test_expected_issuer_derivation():
    assert clerk._expected_issuer(_settings(jwks_url="https://x.clerk.accounts.dev/.well-known/jwks.json")) == "https://x.clerk.accounts.dev"
    assert clerk._expected_issuer(_settings(issuer="https://override.example/")) == "https://override.example"
    # non-standard URL with no marker → blank (issuer check fails open, documented)
    assert clerk._expected_issuer(_settings(jwks_url="https://weird/jwks")) == ""


async def _verify(token, jwk_dict, monkeypatch):
    async def fake_jwks():
        return {"keys": [jwk_dict]}
    monkeypatch.setattr(clerk, "_get_jwks", fake_jwks)
    return await clerk._verify_clerk_jwt(token)


async def test_valid_token_accepted(monkeypatch):
    priv, jwk_dict = _keypair_and_jwk()
    iss = clerk._expected_issuer(get_settings())
    token = jwt.encode(
        {"sub": "user_123", "email": "a@b.com", "iss": iss, "exp": int(time.time()) + 3600},
        priv, algorithm="RS256", headers={"kid": "test"},
    )
    user = await _verify(token, jwk_dict, monkeypatch)
    assert user.clerk_user_id == "user_123"
    assert user.email == "a@b.com"


async def test_wrong_issuer_rejected(monkeypatch):
    priv, jwk_dict = _keypair_and_jwk()
    token = jwt.encode(
        {"sub": "u", "iss": "https://evil.example", "exp": int(time.time()) + 3600},
        priv, algorithm="RS256", headers={"kid": "test"},
    )
    with pytest.raises(HTTPException) as ei:
        await _verify(token, jwk_dict, monkeypatch)
    assert ei.value.status_code == 401


async def test_audience_optin_rejects_when_configured(monkeypatch):
    """With CLERK_JWT_AUDIENCE set, a token WITHOUT an aud claim is rejected.
    (Default = unset → such tokens pass, proving opt-in.)"""
    priv, jwk_dict = _keypair_and_jwk()
    iss = clerk._expected_issuer(get_settings())
    token = jwt.encode(
        {"sub": "u", "iss": iss, "exp": int(time.time()) + 3600},
        priv, algorithm="RS256", headers={"kid": "test"},
    )
    # Sanity: with no audience configured the same token is accepted.
    assert (await _verify(token, jwk_dict, monkeypatch)).clerk_user_id == "u"

    monkeypatch.setenv("CLERK_JWT_AUDIENCE", "misir-backend")
    get_settings.cache_clear()
    try:
        with pytest.raises(HTTPException):
            await _verify(token, jwk_dict, monkeypatch)
    finally:
        monkeypatch.delenv("CLERK_JWT_AUDIENCE", raising=False)
        get_settings.cache_clear()

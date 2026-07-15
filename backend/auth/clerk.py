"""
Clerk JWT validation for FastAPI.

Every protected endpoint depends on `get_current_user`. This dependency:
1. Extracts the Bearer token from the Authorization header.
2. Fetches Clerk's JWKS (cached for 1 hour to avoid hammering the JWKS endpoint).
3. Verifies the JWT signature, expiry, and audience.
4. Returns a CurrentUser with clerk_user_id and email.

The validated clerk_user_id is used throughout the backend as the external
identity key. It maps to auth_user.clerk_user_id in the DB.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from jose.backends import RSAKey
from starlette.requests import Request

from core.config import get_settings
from core.logging_config import get_logger

logger = get_logger(__name__)

_bearer = HTTPBearer(auto_error=True)


def _expected_issuer(settings) -> str:
    """Resolve the expected Clerk token issuer.

    Uses CLERK_ISSUER when set, otherwise derives it from the JWKS URL
    (``https://<domain>/.well-known/jwks.json`` -> ``https://<domain>``).
    """
    if settings.CLERK_ISSUER:
        return settings.CLERK_ISSUER.rstrip("/")
    url = settings.CLERK_JWKS_URL or ""
    marker = "/.well-known/"
    if marker in url:
        return url.split(marker)[0].rstrip("/")
    return ""


@dataclass(frozen=True)
class CurrentUser:
    clerk_user_id: str
    email: str
    raw_claims: dict


# ---------------------------------------------------------------------------
# JWKS cache — refreshed at most once per hour
# ---------------------------------------------------------------------------

_jwks_cache: Optional[dict] = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600
# Unknown-kid tokens force a refresh (key rotation) — but at most once per
# cooldown window, or a flood of garbage tokens turns the API into a
# JWKS-hammering client (cache-bust DoS amplification).
_jwks_last_forced: float = -10_000.0
_JWKS_FORCE_COOLDOWN_SECONDS = 60.0


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    if _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_cache

    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(settings.CLERK_JWKS_URL)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = now
            logger.info("JWKS refreshed", url=settings.CLERK_JWKS_URL)
            return _jwks_cache
    except Exception as exc:
        logger.error("Failed to fetch Clerk JWKS", error=str(exc))
        if _jwks_cache is not None:
            logger.warning("Using stale JWKS cache after fetch failure")
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable",
        ) from exc


# ---------------------------------------------------------------------------
# JWT verification
# ---------------------------------------------------------------------------

async def _verify_clerk_jwt(token: str) -> CurrentUser:
    jwks = await _get_jwks()
    try:
        # Decode header to find key id
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token header") from exc

    # Find the matching key in JWKS
    matching_key = None
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            matching_key = key_data
            break

    if matching_key is None:
        # Force JWKS refresh on unknown kid (key rotation) — rate-limited so
        # unauthenticated garbage tokens can't bust the cache on every request.
        global _jwks_fetched_at, _jwks_last_forced
        now = time.monotonic()
        if (now - _jwks_last_forced) >= _JWKS_FORCE_COOLDOWN_SECONDS:
            _jwks_last_forced = now
            _jwks_fetched_at = 0.0
            jwks = await _get_jwks()
            for key_data in jwks.get("keys", []):
                if key_data.get("kid") == kid:
                    matching_key = key_data
                    break

    if matching_key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key")

    settings = get_settings()
    expected_iss = _expected_issuer(settings)

    # Verify signature + exp always; issuer when derivable; audience only when
    # an `aud`-stamping JWT template is configured (RFC 8725). Failing closed on
    # iss/aud rejects tokens minted for a different Clerk app/template.
    options = {"leeway": 60, "verify_iss": bool(expected_iss)}
    decode_kwargs: dict = {"algorithms": ["RS256"]}
    if expected_iss:
        decode_kwargs["issuer"] = expected_iss
    if settings.CLERK_JWT_AUDIENCE:
        decode_kwargs["audience"] = settings.CLERK_JWT_AUDIENCE
        options["verify_aud"] = True
        # Reject tokens that LACK the audience too (jose only checks aud when
        # present unless require_aud is set) — so opt-in actually enforces.
        options["require_aud"] = True
    else:
        options["verify_aud"] = False
    decode_kwargs["options"] = options

    try:
        claims = jwt.decode(token, matching_key, **decode_kwargs)
    except JWTError as exc:
        # Log the detail server-side; don't leak jose internals to the client.
        logger.warning("JWT verification failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
        ) from exc

    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub claim")

    # Clerk puts email in different claim depending on template config
    email = (
        claims.get("email")
        or claims.get("primary_email_address")
        or ""
    )

    return CurrentUser(
        clerk_user_id=clerk_user_id,
        email=email,
        raw_claims=claims,
    )


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def fetch_clerk_email(clerk_user_id: str) -> str:
    """Look up a user's primary email via the Clerk Backend API.

    Session tokens often omit the email claim; this fetches it from Clerk (the
    source of truth) so the account UI can show it. Requires CLERK_SECRET_KEY;
    returns "" when unset or on any error. Never raises.
    """
    settings = get_settings()
    if not settings.CLERK_SECRET_KEY:
        return ""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
            )
            if resp.status_code != 200:
                return ""
            data = resp.json()
            primary_id = data.get("primary_email_address_id")
            for addr in data.get("email_addresses", []):
                if addr.get("id") == primary_id:
                    return addr.get("email_address", "") or ""
            # Fall back to the first address if no primary is flagged.
            addrs = data.get("email_addresses", [])
            return addrs[0].get("email_address", "") if addrs else ""
    except Exception as exc:
        logger.error("Clerk email lookup failed", error=str(exc))
        return ""


async def delete_clerk_user(clerk_user_id: str) -> bool:
    """Best-effort deletion of the Clerk identity via the Backend API.

    Returns True on success. Requires CLERK_SECRET_KEY; when unset, returns
    False so the caller can flag manual follow-up. Never raises.
    """
    settings = get_settings()
    if not settings.CLERK_SECRET_KEY:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
            )
            return resp.status_code in (200, 204)
    except Exception as exc:
        logger.error("Clerk user deletion failed", error=str(exc))
        return False


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    """FastAPI dependency — validates Clerk JWT and returns CurrentUser."""
    user = await _verify_clerk_jwt(credentials.credentials)
    # Expose the verified identity for per-user rate limiting (core.limiter).
    request.state.clerk_user_id = user.clerk_user_id
    return user

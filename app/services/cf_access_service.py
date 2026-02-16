import time
from typing import Optional

import httpx
from jose import jwt, JWTError

from app.core.config import settings

_jwks_cache: Optional[dict] = None
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 3600  # 1 hour


async def _fetch_jwks() -> dict:
    """Fetch JWKS public keys from Cloudflare Access via the application domain."""
    url = f"https://{settings.CF_ACCESS_DOMAIN}/cdn-cgi/access/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()


async def _get_signing_keys(force_refresh: bool = False) -> dict:
    """Get cached JWKS keys, refreshing if stale or forced."""
    global _jwks_cache, _jwks_cache_time

    if not force_refresh and _jwks_cache and (time.time() - _jwks_cache_time) < _JWKS_CACHE_TTL:
        return _jwks_cache

    _jwks_cache = await _fetch_jwks()
    _jwks_cache_time = time.time()
    return _jwks_cache


async def validate_cf_access_token(token: str) -> dict:
    """Validate a Cloudflare Access JWT and return its payload.

    Fetches JWKS from the application domain, validates signature (RS256) and audience.
    Retries with fresh keys on first validation failure (handles key rotation).

    Returns:
        dict with at least 'email' and 'sub' claims.

    Raises:
        JWTError: if the token is invalid or cannot be verified.
    """
    for attempt in range(2):
        jwks = await _get_signing_keys(force_refresh=(attempt > 0))

        try:
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                audience=settings.CF_ACCESS_AUD,
                options={"verify_iss": False},
            )
            return payload
        except JWTError:
            if attempt == 0:
                continue
            raise

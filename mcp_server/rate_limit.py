"""
In-memory rate limiting middleware for the MCP HTTP transport.

Limits:
- 60 requests/minute per authenticated user (by JWT sub claim)
- 10 requests/minute for unauthenticated requests (by client IP)

Uses a sliding-window counter stored in memory. Resets automatically
when the window expires. Suitable for single-process deployments.
"""

import logging
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Rate limit settings
AUTHENTICATED_RATE_LIMIT = 60  # requests per window
UNAUTHENTICATED_RATE_LIMIT = 10  # requests per window
WINDOW_SECONDS = 60  # 1-minute window


@dataclass
class RateBucket:
    """Tracks request count within a sliding time window."""

    count: int = 0
    window_start: float = 0.0


class RateLimitStore:
    """Thread-safe in-memory rate limit storage."""

    def __init__(self):
        self._buckets: dict[str, RateBucket] = defaultdict(RateBucket)
        self._lock = threading.Lock()

    def check_and_increment(self, key: str, limit: int) -> tuple[bool, int]:
        """Check if the key is within rate limits and increment the counter.

        Returns:
            (allowed, remaining): whether the request is allowed and
            how many requests remain in the window.
        """
        with self._lock:
            now = time.monotonic()
            bucket = self._buckets[key]

            # Reset window if expired
            if now - bucket.window_start >= WINDOW_SECONDS:
                bucket.count = 0
                bucket.window_start = now

            bucket.count += 1

            if bucket.count > limit:
                remaining = 0
                return False, remaining

            remaining = limit - bucket.count
            return True, remaining

    def cleanup_expired(self):
        """Remove expired buckets to prevent memory leaks."""
        with self._lock:
            now = time.monotonic()
            expired = [
                key
                for key, bucket in self._buckets.items()
                if now - bucket.window_start >= WINDOW_SECONDS * 2
            ]
            for key in expired:
                del self._buckets[key]


# Singleton store
_store = RateLimitStore()


def _extract_user_id_from_auth(request: Request) -> Optional[str]:
    """Try to extract user ID from the Authorization header.

    Does a lightweight JWT payload extraction (base64 decode of claims)
    without full verification -- the actual auth middleware handles that.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header[7:]
    try:
        import base64
        import json

        # JWT is header.payload.signature -- we just need the payload
        parts = token.split(".")
        if len(parts) != 3:
            return None

        # Add padding for base64
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding

        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub")
    except Exception:
        return None


def _get_client_ip(request: Request) -> str:
    """Get the client IP, respecting X-Forwarded-For for reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that enforces per-user and per-IP rate limits."""

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)

        user_id = _extract_user_id_from_auth(request)

        if user_id:
            key = f"user:{user_id}"
            limit = AUTHENTICATED_RATE_LIMIT
        else:
            key = f"ip:{_get_client_ip(request)}"
            limit = UNAUTHENTICATED_RATE_LIMIT

        allowed, remaining = _store.check_and_increment(key, limit)

        if not allowed:
            logger.warning(f"Rate limit exceeded for {key}")
            return JSONResponse(
                status_code=429,
                content={"error": "Too many requests. Please try again later."},
                headers={
                    "Retry-After": str(WINDOW_SECONDS),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

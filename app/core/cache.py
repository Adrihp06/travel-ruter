"""
Cache configuration for external API calls.

Provides a simple in-memory cache for expensive external API calls to:
- Reduce API quota/costs
- Improve response times
- Reduce load on external services

For production with multiple workers, consider using Redis backend.
"""

import hashlib
import json
from typing import Any, Optional
from functools import wraps

from aiocache import Cache
from aiocache.serializers import JsonSerializer


# Default TTL values in seconds
TTL_PLACE_DETAILS = 86400  # 24 hours - place details rarely change
TTL_AUTOCOMPLETE = 3600  # 1 hour - autocomplete results can change
TTL_NEARBY_SEARCH = 3600  # 1 hour - nearby places can change
TTL_ROUTE = 1800  # 30 minutes - routes/traffic can change

# In-memory cache for simple deployments
# For production with multiple workers, use Redis:
# cache = Cache(Cache.REDIS, endpoint="localhost", port=6379, ...)
cache = Cache(
    Cache.MEMORY,
    serializer=JsonSerializer(),
    namespace="travel_ruter",
    ttl=3600,  # 1 hour default
)


def make_cache_key(*args: Any, **kwargs: Any) -> str:
    """
    Create a deterministic cache key from arguments.

    Handles various types including tuples, lists, dicts, and primitives.
    """
    key_parts = []

    for arg in args:
        if isinstance(arg, (list, tuple)):
            key_parts.append(str(arg))
        elif isinstance(arg, dict):
            key_parts.append(json.dumps(arg, sort_keys=True))
        else:
            key_parts.append(str(arg))

    for k, v in sorted(kwargs.items()):
        if isinstance(v, (list, tuple)):
            key_parts.append(f"{k}={v}")
        elif isinstance(v, dict):
            key_parts.append(f"{k}={json.dumps(v, sort_keys=True)}")
        else:
            key_parts.append(f"{k}={v}")

    key_string = ":".join(key_parts)

    # Use hash for long keys to avoid memory issues
    if len(key_string) > 200:
        return hashlib.md5(key_string.encode()).hexdigest()

    return key_string


async def get_cached(key: str) -> Optional[Any]:
    """Get a value from cache."""
    try:
        return await cache.get(key)
    except Exception:
        return None


async def set_cached(key: str, value: Any, ttl: Optional[int] = None) -> None:
    """Set a value in cache."""
    try:
        await cache.set(key, value, ttl=ttl)
    except Exception:
        pass  # Silently fail - caching is optional


async def delete_cached(key: str) -> None:
    """Delete a value from cache."""
    try:
        await cache.delete(key)
    except Exception:
        pass


async def clear_namespace(pattern: str) -> None:
    """
    Clear all cache entries matching a pattern.

    Note: This is a simple implementation for in-memory cache.
    For Redis, you would use SCAN with pattern matching.
    """
    try:
        await cache.clear(namespace=pattern)
    except Exception:
        pass

"""
Shared HTTP client with connection pooling for improved performance.

This module provides a singleton AsyncClient instance that can be reused
across all services, avoiding the overhead of creating new connections
for each request.
"""

from httpx import AsyncClient, Limits

_client: AsyncClient | None = None


async def get_http_client() -> AsyncClient:
    """
    Get the shared HTTP client instance.

    Creates a new client on first call with connection pooling enabled.
    Subsequent calls return the same instance.

    Returns:
        AsyncClient: Shared HTTP client with connection pooling
    """
    global _client
    if _client is None:
        _client = AsyncClient(
            limits=Limits(max_connections=100, max_keepalive_connections=20),
            timeout=30.0,
            http2=True,
        )
    return _client


async def close_http_client() -> None:
    """
    Close the shared HTTP client.

    Should be called during application shutdown to properly close
    all connections in the pool.
    """
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None

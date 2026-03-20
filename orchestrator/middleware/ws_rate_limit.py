"""Token-bucket rate limiter for WebSocket messages."""

from __future__ import annotations

import time


class WebSocketRateLimiter:
    """Per-key token-bucket rate limiter.

    Each key (e.g. user_id or IP) gets an independent bucket that refills
    at *rate* tokens per second up to a maximum of *burst* tokens.
    """

    def __init__(self, rate: float = 10.0, burst: int = 20):
        self.rate = rate
        self.burst = burst
        self._buckets: dict[str, tuple[float, float]] = {}

    def allow(self, key: str) -> bool:
        """Return True if the request is allowed, False if rate-limited."""
        now = time.monotonic()
        tokens, last_refill = self._buckets.get(key, (float(self.burst), now))

        # Refill tokens based on elapsed time
        elapsed = now - last_refill
        tokens = min(self.burst, tokens + elapsed * self.rate)

        if tokens >= 1:
            self._buckets[key] = (tokens - 1, now)
            return True

        self._buckets[key] = (tokens, now)
        return False

    def cleanup(self, max_age: float = 3600) -> None:
        """Remove stale entries older than *max_age* seconds."""
        now = time.monotonic()
        stale = [k for k, (_, t) in self._buckets.items() if now - t > max_age]
        for k in stale:
            del self._buckets[k]

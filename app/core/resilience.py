"""
Resilience utilities for external API calls.

Provides retry logic with exponential backoff and circuit breaker pattern
to handle transient failures gracefully.
"""
import asyncio
import logging
import time
from enum import Enum
from functools import wraps
from typing import Callable, TypeVar, ParamSpec

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
    RetryError,
)

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


# Retryable exceptions - transient network issues
RETRYABLE_EXCEPTIONS = (
    httpx.TimeoutException,
    httpx.NetworkError,
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.ConnectTimeout,
)


def with_retry(max_attempts: int = 3, min_wait: float = 1, max_wait: float = 10):
    """
    Decorator factory for retry logic with exponential backoff.

    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        min_wait: Minimum wait time between retries in seconds (default: 1)
        max_wait: Maximum wait time between retries in seconds (default: 10)

    Returns:
        Decorator that wraps async functions with retry logic

    Example:
        @with_retry(max_attempts=3)
        async def get_route(self, origin: tuple, destination: tuple) -> dict:
            # existing implementation
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation, requests allowed
    OPEN = "open"  # Failures exceeded threshold, requests blocked
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open and blocking requests."""

    def __init__(self, service_name: str, reset_time: float):
        self.service_name = service_name
        self.reset_time = reset_time
        super().__init__(
            f"Circuit breaker open for {service_name}. "
            f"Retry after {reset_time:.1f} seconds."
        )


class CircuitBreaker:
    """
    Circuit breaker for protecting against cascading failures.

    When a service fails repeatedly, the circuit breaker opens and blocks
    further requests for a cooling-off period, preventing resource exhaustion.

    States:
    - CLOSED: Normal operation, all requests pass through
    - OPEN: Service failing, all requests immediately rejected
    - HALF_OPEN: Testing recovery, limited requests allowed

    Example:
        breaker = CircuitBreaker("mapbox", failure_threshold=5, reset_timeout=60)

        async def get_route(...):
            if not breaker.allow_request():
                raise CircuitBreakerOpen(breaker.service_name, breaker.time_until_reset())

            try:
                result = await actual_api_call(...)
                breaker.record_success()
                return result
            except Exception as e:
                breaker.record_failure()
                raise
    """

    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        reset_timeout: float = 60.0,
        half_open_max_calls: int = 1,
    ):
        """
        Initialize circuit breaker.

        Args:
            service_name: Name of the service (for logging/error messages)
            failure_threshold: Number of failures before opening circuit
            reset_timeout: Seconds to wait before attempting recovery
            half_open_max_calls: Max calls allowed in half-open state
        """
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: float = 0
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """Get current circuit state, checking for automatic transitions."""
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure_time >= self.reset_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                logger.info(
                    f"Circuit breaker for {self.service_name} "
                    f"transitioning to HALF_OPEN"
                )
        return self._state

    def allow_request(self) -> bool:
        """Check if a request should be allowed through."""
        current_state = self.state

        if current_state == CircuitState.CLOSED:
            return True

        if current_state == CircuitState.OPEN:
            return False

        if current_state == CircuitState.HALF_OPEN:
            return self._half_open_calls < self.half_open_max_calls

        return False

    def time_until_reset(self) -> float:
        """Get seconds until circuit breaker may reset (for OPEN state)."""
        if self._state != CircuitState.OPEN:
            return 0
        elapsed = time.time() - self._last_failure_time
        return max(0, self.reset_timeout - elapsed)

    async def record_success(self) -> None:
        """Record a successful request."""
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.half_open_max_calls:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    logger.info(
                        f"Circuit breaker for {self.service_name} "
                        f"CLOSED after successful recovery"
                    )
            elif self._state == CircuitState.CLOSED:
                # Reset failure count on success in normal operation
                self._failure_count = 0

    async def record_failure(self) -> None:
        """Record a failed request."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                # Any failure in half-open state reopens the circuit
                self._state = CircuitState.OPEN
                self._half_open_calls = 0
                logger.warning(
                    f"Circuit breaker for {self.service_name} "
                    f"REOPENED after failure in half-open state"
                )
            elif (
                self._state == CircuitState.CLOSED
                and self._failure_count >= self.failure_threshold
            ):
                self._state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker for {self.service_name} "
                    f"OPENED after {self._failure_count} failures"
                )

    def increment_half_open_calls(self) -> None:
        """Increment the half-open call counter."""
        if self._state == CircuitState.HALF_OPEN:
            self._half_open_calls += 1

    def reset(self) -> None:
        """Reset circuit breaker to closed state (for testing/admin)."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._half_open_calls = 0
        self._last_failure_time = 0
        logger.info(f"Circuit breaker for {self.service_name} manually reset")


def with_circuit_breaker(breaker: CircuitBreaker):
    """
    Decorator that wraps an async function with circuit breaker protection.

    Args:
        breaker: CircuitBreaker instance to use

    Example:
        mapbox_breaker = CircuitBreaker("mapbox")

        @with_circuit_breaker(mapbox_breaker)
        async def call_mapbox_api(...):
            ...
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            if not breaker.allow_request():
                raise CircuitBreakerOpen(
                    breaker.service_name,
                    breaker.time_until_reset()
                )

            breaker.increment_half_open_calls()

            try:
                result = await func(*args, **kwargs)
                await breaker.record_success()
                return result
            except Exception:
                await breaker.record_failure()
                raise

        return wrapper
    return decorator


# Pre-configured circuit breakers for each external service
mapbox_circuit_breaker = CircuitBreaker(
    "mapbox",
    failure_threshold=5,
    reset_timeout=60.0,
)

google_places_circuit_breaker = CircuitBreaker(
    "google_places",
    failure_threshold=5,
    reset_timeout=60.0,
)

google_maps_routes_circuit_breaker = CircuitBreaker(
    "google_maps_routes",
    failure_threshold=5,
    reset_timeout=60.0,
)

openrouteservice_circuit_breaker = CircuitBreaker(
    "openrouteservice",
    failure_threshold=5,
    reset_timeout=60.0,
)

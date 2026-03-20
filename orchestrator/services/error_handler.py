"""Typed exceptions and error classification for the orchestrator."""

from __future__ import annotations

import logging

logger = logging.getLogger("orchestrator.errors")


class OrchestratorError(Exception):
    """Base exception for orchestrator errors."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class RateLimitError(OrchestratorError):
    def __init__(
        self,
        message: str = (
            "Rate limit reached for the selected AI model. "
            "Please wait a moment and try again, or switch to a different model."
        ),
    ):
        super().__init__(message, status_code=429)


class ChatTimeoutError(OrchestratorError):
    def __init__(self, timeout_seconds: int = 180):
        super().__init__(
            f"Request timed out after {timeout_seconds} seconds",
            status_code=504,
        )


class ChatCancelledError(OrchestratorError):
    def __init__(self):
        super().__init__("Request cancelled by user", status_code=499)


class SessionNotFoundError(OrchestratorError):
    def __init__(self, session_id: str):
        super().__init__(f"Session not found: {session_id}", status_code=404)


class MCPConnectionError(OrchestratorError):
    def __init__(self, detail: str = "MCP server connection failed"):
        super().__init__(detail, status_code=503)


def classify_error(exc: Exception) -> OrchestratorError:
    """Classify a raw exception into a typed orchestrator error."""
    if isinstance(exc, OrchestratorError):
        return exc

    exc_str = str(exc)
    rate_limit_indicators = ("429", "RESOURCE_EXHAUSTED", "rate_limit", "rate limit")
    if any(indicator in exc_str.lower() if indicator.islower() else indicator in exc_str for indicator in rate_limit_indicators):
        logger.warning("Rate limit detected: %s", exc_str)
        return RateLimitError()

    return OrchestratorError(exc_str)

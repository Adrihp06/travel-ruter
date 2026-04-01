"""PydanticAI Agent + MCPServerStdio setup."""

from __future__ import annotations

import logging
import os

from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from orchestrator.config import _MODEL_MAP, settings

logger = logging.getLogger("orchestrator.agent")


def create_mcp_server() -> MCPServerStdio:
    """Create the MCP server that spawns ``python3 -m mcp_server``.

    Same behaviour as ``mcp/client.ts`` lines 24-31.
    """
    # Allowlist: only pass env vars the MCP subprocess actually needs,
    # avoiding leaking secrets (JWT keys, internal service keys, etc.).
    _SYSTEM_ENV_KEYS = ("PATH", "HOME", "LANG", "LC_ALL", "VIRTUAL_ENV", "PYTHONUNBUFFERED")
    env: dict[str, str] = {
        k: v for k, v in ((k, os.environ.get(k)) for k in _SYSTEM_ENV_KEYS) if v is not None
    }
    env["PYTHONPATH"] = os.environ.get("PYTHONPATH", "..")

    if settings.database_url:
        env["DATABASE_URL"] = settings.database_url
    if settings.google_maps_api_key:
        env["GOOGLE_MAPS_API_KEY"] = settings.google_maps_api_key
    if settings.openrouteservice_api_key:
        env["OPENROUTESERVICE_API_KEY"] = settings.openrouteservice_api_key
    if settings.openai_api_key:
        env["OPENAI_API_KEY"] = settings.openai_api_key

    # Auth settings needed by app.core.config (imported by MCP server).
    # The orchestrator receives JWT_SECRET_KEY (mapped from SECRET_KEY in docker-compose),
    # but the backend config expects SECRET_KEY. Pass it under both names.
    secret_key = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET_KEY", "")
    if secret_key:
        env["SECRET_KEY"] = secret_key
    # Disable auth validation in MCP subprocess — it doesn't serve HTTP endpoints
    env["AUTH_ENABLED"] = os.environ.get("AUTH_ENABLED", "false")

    return MCPServerStdio(
        settings.mcp_python_path,
        args=["-m", "mcp_server"],
        env=env,
        timeout=60,
    )


def create_agent(mcp: MCPServerStdio) -> Agent:
    """Create a single PydanticAI Agent wired to the MCP toolset.

    The ``model`` is overridden at call-time via ``run(model=…)``,
    so the default here is just a sensible fallback.
    """
    from orchestrator.config import SYSTEM_PROMPT

    return Agent(
        "anthropic:claude-sonnet-4-6",
        instructions=SYSTEM_PROMPT,
        toolsets=[mcp],
        retries=2,
        end_strategy='exhaustive',
    )


def resolve_model_name(frontend_model_id: str) -> str:
    """Map a frontend model ID to a PydanticAI model string.

    Examples:
        ``claude-sonnet-4-6``           →  ``anthropic:claude-sonnet-4-6``
        ``gpt-5.4-mini``                →  ``openai:gpt-5.4-mini``
        ``llama3.2:latest``             →  ``ollama:llama3.2:latest``
    """
    info = _MODEL_MAP.get(frontend_model_id)
    if info:
        return info.pydantic_ai_name
    # Check if it looks like an Ollama model (format: "model:tag")
    if ":" in frontend_model_id:
        parts = frontend_model_id.split(":")
        _known_prefixes = {"anthropic", "openai", "google", "gpt", "claude", "gemini"}
        if len(parts) == 2 and not any(p in parts[0].lower() for p in _known_prefixes):
            return f"ollama:{frontend_model_id}"
    valid_ids = sorted(_MODEL_MAP.keys())
    raise ValueError(
        f"Unknown model ID '{frontend_model_id}'. "
        f"Valid model IDs: {valid_ids}. "
        f"For Ollama models, use the format 'model:tag' (e.g., 'llama3.2:latest')."
    )


def provider_from_model_id(model_id: str) -> str | None:
    """Derive the AI provider service name from a frontend model ID."""
    info = _MODEL_MAP.get(model_id)
    if info:
        prov = info.provider
        if prov == "claude":
            return "anthropic"
        if prov == "openai":
            return "openai"
        if prov == "gemini":
            return "google_ai"
        return None
    # Ollama models don't need external API keys
    return None


def resolve_model_with_key(pydantic_ai_model: str, api_key: str | None):
    """Return a model instance with an explicit API key, or the string name for env var fallback.

    When ``api_key`` is ``None``, returns the plain model string so pydantic-ai
    reads from environment variables as before.
    """
    if not api_key:
        return pydantic_ai_model

    # Parse provider prefix from pydantic_ai_model (e.g. "anthropic:claude-...")
    if pydantic_ai_model.startswith("anthropic:"):
        model_name = pydantic_ai_model.split(":", 1)[1]
        logger.info("Creating AnthropicModel with explicit key for %s", model_name)
        return AnthropicModel(model_name, api_key=api_key)
    if pydantic_ai_model.startswith("openai:"):
        model_name = pydantic_ai_model.split(":", 1)[1]
        logger.info("Creating OpenAIModel with explicit key for %s", model_name)
        return OpenAIModel(model_name, api_key=api_key)
    if pydantic_ai_model.startswith("google-vertex:"):
        # Vertex AI uses project credentials (ADC), not API keys.
        # Return string so PydanticAI resolves via GOOGLE_CLOUD_PROJECT + ADC.
        logger.info("Vertex AI model %s — ignoring trip-level key, using ADC", pydantic_ai_model)
        return pydantic_ai_model
    if pydantic_ai_model.startswith("google-gla:"):
        model_name = pydantic_ai_model.split(":", 1)[1]
        logger.info("Creating GoogleModel with explicit key for %s", model_name)
        return GoogleModel(model_name, provider=GoogleProvider(api_key=api_key))

    # Unknown provider — fall back to string (env var)
    return pydantic_ai_model



# Re-export for backward compatibility
def build_instructions(
    trip_context: dict | None,
    chat_mode: str | None = None,
    custom_system_prompt: str | None = None,
) -> str:
    """Deprecated: use orchestrator.services.chat_service.build_instructions instead."""
    from orchestrator.services.chat_service import build_instructions as _build
    return _build(trip_context, chat_mode, custom_system_prompt)

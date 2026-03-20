"""Provider API key management endpoints."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request

from orchestrator.api.deps import verify_token

logger = logging.getLogger("orchestrator.api.providers")

router = APIRouter(prefix="/api/providers")

# Map frontend provider IDs to the env vars they control
_PROVIDER_ENV_MAP = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
}


@router.get("/status")
async def provider_status(request: Request) -> dict:
    """Return which providers have API keys configured (no values exposed)."""
    await verify_token(request)
    providers = {}
    for provider_id, env_var in _PROVIDER_ENV_MAP.items():
        val = os.environ.get(env_var, "")
        providers[provider_id] = bool(val)
    return {"providers": providers}


@router.post("/keys")
async def save_provider_keys(request: Request) -> dict:
    """Set provider API keys at runtime (NOT persisted to disk)."""
    await verify_token(request)
    body = await request.json()
    keys = body.get("keys", {})
    updated = []

    for provider_id, value in keys.items():
        env_var = _PROVIDER_ENV_MAP.get(provider_id)
        if not env_var:
            continue
        value = (value or "").strip()
        if value:
            os.environ[env_var] = value
            updated.append(provider_id)
        elif env_var in os.environ:
            del os.environ[env_var]
            updated.append(provider_id)

    logger.info("Updated provider keys: %s", updated)
    return {"updated": updated}

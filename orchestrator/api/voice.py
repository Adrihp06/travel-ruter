"""REST endpoints for the Gemini Live voice agent.

The frontend connects directly to Gemini Live API via WebSocket.
These endpoints provide:
- /api/voice/config — Returns Gemini WS URL + model for direct connection
- /api/voice/tool — Executes backend MCP tools on behalf of the voice agent
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from orchestrator.api.deps import verify_token
from orchestrator.config import settings
from orchestrator.config_voice import GEMINI_LIVE_WS_URL
from orchestrator.services.voice_tools import execute_backend_tool

logger = logging.getLogger("orchestrator.api.voice")

router = APIRouter()


@router.get("/api/voice/config")
async def voice_config(request: Request):
    """Return Gemini Live API connection info for the frontend."""
    await verify_token(request)

    google_api_key = settings.google_api_key
    if not google_api_key:
        return JSONResponse(
            {"error": "Google API key not configured"},
            status_code=503,
        )

    model = getattr(settings, "gemini_live_model", "models/gemini-3.1-flash-live-preview")

    return {
        "wsUrl": f"{GEMINI_LIVE_WS_URL}?key={google_api_key}",
        "model": model,
    }


@router.post("/api/voice/tool")
async def execute_voice_tool(request: Request):
    """Execute a backend MCP tool for the voice agent.

    The frontend calls this when Gemini requests a backend tool.
    Frontend tools are handled directly in the browser.
    """
    await verify_token(request)

    body = await request.json()
    name = body.get("name")
    args = body.get("args", {})

    if not name:
        return JSONResponse({"error": "Tool name required"}, status_code=400)

    mcp = getattr(request.app.state, "mcp", None)
    result = await execute_backend_tool(mcp, name, args)

    logger.info("Voice tool %s executed: error=%s", name, result.get("isError", False))
    return result

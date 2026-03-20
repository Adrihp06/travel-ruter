"""Health and model listing endpoints."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from orchestrator.api.deps import get_session_manager
from orchestrator.config import get_available_models, settings

logger = logging.getLogger("orchestrator.api.health")

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict:
    mcp_connected = getattr(request.app.state, 'mcp_connected', False)
    sm = get_session_manager(request)
    return {
        "status": "healthy",
        "version": settings.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mcpConnected": mcp_connected,
        "activeSessions": len(sm.list_sessions()),
    }


@router.get("/api/models")
async def list_models() -> dict:
    try:
        models = await get_available_models()
        items = [
            {
                "id": m.id,
                "name": m.display_name,
                "provider": m.provider,
                "supportsStreaming": m.supports_streaming,
                "supportsTools": m.supports_tools,
                "isDefault": m.is_default or None,
                "description": m.description or None,
            }
            for m in models
        ]
        default_id = next((m["id"] for m in items if m.get("isDefault")), items[0]["id"] if items else None)
        return {"models": items, "default": default_id}
    except Exception:
        logger.exception("Error listing models")
        return JSONResponse({"error": "Failed to list models"}, status_code=500)

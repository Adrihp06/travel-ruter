"""Session CRUD endpoints."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import TypeAdapter
from pydantic_ai.messages import ModelMessage

from orchestrator.api.deps import get_session_manager, verify_token
from orchestrator.schemas import CreateSessionRequest, UpdateSessionRequest

logger = logging.getLogger("orchestrator.api.sessions")

router = APIRouter(prefix="/api/sessions")

_msg_adapter = TypeAdapter(list[ModelMessage])


@router.post("")
async def create_session(body: CreateSessionRequest, request: Request) -> dict:
    await verify_token(request)
    try:
        sm = get_session_manager(request)
        trip_ctx = body.trip_context.model_dump(by_alias=True) if body.trip_context else None
        agent_config = body.agent_config or {}
        custom_system_prompt = agent_config.get("systemPrompt")

        restored_history = None
        if body.message_history:
            try:
                restored_history = _msg_adapter.validate_python(body.message_history)
            except Exception:
                logger.warning("Failed to deserialize messageHistory, starting fresh")

        session = await sm.create_session(
            model_id=body.model_id,
            trip_id=body.trip_id,
            trip_context=trip_ctx,
            message_history=restored_history,
            chat_mode=body.chat_mode,
            custom_system_prompt=custom_system_prompt,
        )
        return {
            "sessionId": session.id,
            "modelId": session.model_id,
            "createdAt": session.created_at.isoformat(),
        }
    except Exception:
        logger.exception("Error creating session")
        return JSONResponse({"error": "Failed to create session"}, status_code=500)


@router.get("/{session_id}")
async def get_session(session_id: str, request: Request) -> dict:
    await verify_token(request)
    sm = get_session_manager(request)
    session = sm.get_session(session_id)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return {
        "sessionId": session.id,
        "modelId": session.model_id,
        "messageCount": len(session.message_history),
        "createdAt": session.created_at.isoformat(),
        "lastActivity": session.last_activity.isoformat(),
    }


@router.get("")
async def list_sessions(request: Request) -> dict:
    await verify_token(request)
    sm = get_session_manager(request)
    return {"sessions": sm.list_sessions()}


@router.delete("/{session_id}")
async def delete_session(session_id: str, request: Request) -> dict:
    await verify_token(request)
    sm = get_session_manager(request)
    if sm.delete_session(session_id):
        return {"success": True}
    return JSONResponse({"error": "Session not found"}, status_code=404)


@router.get("/{session_id}/history")
async def get_session_history(session_id: str, request: Request) -> dict:
    await verify_token(request)
    sm = get_session_manager(request)
    session = sm.get_session(session_id)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    serialized = json.loads(_msg_adapter.dump_json(session.message_history))
    return {"sessionId": session_id, "messageHistory": serialized}


@router.patch("/{session_id}")
async def update_session(session_id: str, body: UpdateSessionRequest, request: Request) -> dict:
    await verify_token(request)
    sm = get_session_manager(request)
    trip_ctx = body.trip_context.model_dump(by_alias=True)
    session = sm.update_context(session_id, trip_ctx)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return {"success": True}

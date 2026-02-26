"""All HTTP routes + WebSocket handler + streaming bridge."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt as jose_jwt

from pydantic import TypeAdapter
from pydantic_ai import Agent, UsageLimits
from pydantic_ai.models.anthropic import AnthropicModelSettings
from pydantic_ai import (
    AgentStreamEvent,
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)
from pydantic_ai.messages import ModelMessage

_msg_adapter = TypeAdapter(list[ModelMessage])

from orchestrator.agent import build_instructions, provider_from_model_id, resolve_model_name, resolve_model_with_key
from orchestrator.config import get_available_models, settings
from orchestrator.schemas import (
    ChatRequest,
    ChatResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    HealthResponse,
    ModelInfoResponse,
    ModelsResponse,
    SessionInfoResponse,
    SessionListItem,
    SessionListResponse,
    ToolCallInfo,
    UpdateSessionRequest,
)
from orchestrator.session import Session, SessionManager

logger = logging.getLogger("orchestrator.routes")


def _get_model_settings(pydantic_ai_model: str):
    """Return model settings with prompt caching enabled for Anthropic models.

    For Anthropic, caches both the system prompt (instructions) and MCP tool
    definitions — both are static per-request and benefit most from caching.
    Other providers receive a plain dict (OpenAI caches automatically; Gemini
    and Ollama don't support this API).
    """
    if isinstance(pydantic_ai_model, str) and pydantic_ai_model.startswith("anthropic:"):
        return AnthropicModelSettings(
            max_tokens=settings.max_output_tokens,
            anthropic_cache_instructions=True,
            anthropic_cache_tool_definitions=True,
        )
    return {"max_tokens": settings.max_output_tokens}


router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers to get shared state from app
# ---------------------------------------------------------------------------

def _agent(request: Request) -> Agent:
    return request.app.state.agent


def _sessions(request: Request) -> SessionManager:
    return request.app.state.session_manager


# ---------------------------------------------------------------------------
# Trip-level API key resolution
# ---------------------------------------------------------------------------

# Backend URL for internal calls (same Docker network)
_BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")


async def _resolve_trip_api_key(
    session: "Session",
) -> str | None:
    """Fetch the AI provider API key for a session's model from the backend.

    Returns the key string or None (meaning fall back to env var).
    Uses a cached value on the session to avoid repeated lookups.
    Uses internal service auth (X-Internal-Key) instead of user JWT.
    """
    if session._resolved_api_key is not None:
        return session._resolved_api_key

    if not session.trip_id:
        return None

    provider = provider_from_model_id(session.model_id)
    if not provider:
        return None

    if not session.user_id:
        return None

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{_BACKEND_URL}/api/v1/trips/{session.trip_id}/api-keys/{provider}/value",
                headers={
                    "X-Internal-Key": settings.INTERNAL_SERVICE_KEY,
                    "X-User-Id": str(session.user_id),
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                key = data.get("key")
                if key:
                    session._resolved_api_key = key
                    logger.info("Resolved trip-level %s key for trip_id=%s", provider, session.trip_id)
                    return key
    except Exception as exc:
        logger.debug("Could not fetch trip-level key for %s: %s", provider, exc)

    return None


# ---------------------------------------------------------------------------
# REST endpoints (matching server.ts exactly)
# ---------------------------------------------------------------------------

@router.get("/health")
async def health(request: Request) -> dict:
    mcp_connected = getattr(request.app.state, 'mcp_connected', False)
    sm = _sessions(request)
    return {
        "status": "healthy",
        "version": settings.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mcpConnected": mcp_connected,
        "activeSessions": len(sm.list_sessions()),
    }


@router.get("/api/models")
async def list_models(request: Request) -> dict:
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
    except Exception as exc:
        logger.exception("Error listing models")
        return JSONResponse({"error": "Failed to list models"}, status_code=500)


# ---------------------------------------------------------------------------
# Provider key management (runtime — set env vars without restart)
# ---------------------------------------------------------------------------

# Map frontend provider IDs to the env vars they control
_PROVIDER_ENV_MAP = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
    "perplexity": "PERPLEXITY_API_KEY",
}


@router.get("/api/providers/status")
async def provider_status() -> dict:
    """Return which providers have API keys configured (no values exposed)."""
    import os
    providers = {}
    for provider_id, env_var in _PROVIDER_ENV_MAP.items():
        val = os.environ.get(env_var, "")
        providers[provider_id] = bool(val)
    return {"providers": providers}


@router.post("/api/providers/keys")
async def save_provider_keys(request: Request) -> dict:
    """Set provider API keys at runtime (takes effect immediately for new sessions).

    Keys are NOT persisted to disk — use the .env file for persistence across restarts.
    """
    import os
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


@router.post("/api/sessions")
async def create_session(body: CreateSessionRequest, request: Request) -> dict:
    try:
        sm = _sessions(request)
        trip_ctx = body.trip_context.model_dump(by_alias=True) if body.trip_context else None

        # Deserialize restored message history if provided
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
        )
        return {
            "sessionId": session.id,
            "modelId": session.model_id,
            "createdAt": session.created_at.isoformat(),
        }
    except Exception as exc:
        logger.exception("Error creating session")
        return JSONResponse({"error": "Failed to create session"}, status_code=500)


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request) -> dict:
    sm = _sessions(request)
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


@router.get("/api/sessions")
async def list_sessions(request: Request) -> dict:
    sm = _sessions(request)
    return {"sessions": sm.list_sessions()}


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, request: Request) -> dict:
    sm = _sessions(request)
    if sm.delete_session(session_id):
        return {"success": True}
    return JSONResponse({"error": "Session not found"}, status_code=404)


@router.get("/api/sessions/{session_id}/history")
async def get_session_history(session_id: str, request: Request) -> dict:
    sm = _sessions(request)
    session = sm.get_session(session_id)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    serialized = json.loads(_msg_adapter.dump_json(session.message_history))
    return {"sessionId": session_id, "messageHistory": serialized}


@router.patch("/api/sessions/{session_id}")
async def update_session(session_id: str, body: UpdateSessionRequest, request: Request) -> dict:
    sm = _sessions(request)
    trip_ctx = body.trip_context.model_dump(by_alias=True)
    session = sm.update_context(session_id, trip_ctx)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return {"success": True}


@router.post("/api/chat")
async def chat(body: ChatRequest, request: Request) -> dict:
    sm = _sessions(request)
    agent = _agent(request)

    if not body.session_id or not body.message:
        return JSONResponse({"error": "sessionId and message are required"}, status_code=400)

    session = sm.get_session(body.session_id)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    request_id = str(uuid4())
    try:
        instructions = build_instructions(session.trip_context, session.chat_mode)
        sm.truncate_history(session)

        # Resolve trip-level API key for the AI provider
        trip_api_key = await _resolve_trip_api_key(session)
        model = resolve_model_with_key(session.pydantic_ai_model, trip_api_key)

        usage_limits = UsageLimits(request_limit=25)

        async with session.lock:
            result = await asyncio.wait_for(
                agent.run(
                    body.message,
                    model=model,
                    message_history=session.message_history,
                    instructions=instructions,
                    model_settings=_get_model_settings(session.pydantic_ai_model),
                    usage_limits=usage_limits,
                ),
                timeout=120,
            )
            session.message_history = result.all_messages()

        # Extract tool calls from the result messages
        tool_calls: list[dict] = []
        for msg in result.new_messages():
            if hasattr(msg, "parts"):
                for part in msg.parts:
                    if hasattr(part, "tool_name"):
                        tool_calls.append({
                            "id": getattr(part, "tool_call_id", str(uuid4())),
                            "name": part.tool_name,
                            "arguments": getattr(part, "args", {}),
                        })

        return {
            "requestId": request_id,
            "sessionId": body.session_id,
            "response": result.output,
            "toolCalls": tool_calls if tool_calls else None,
        }
    except asyncio.TimeoutError:
        return JSONResponse({"error": "Request timed out after 120 seconds"}, status_code=504)
    except Exception as exc:
        exc_str = str(exc)
        logger.exception("Error in chat (request_id=%s)", request_id)
        if "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str or "rate_limit" in exc_str.lower() or "rate limit" in exc_str.lower():
            logger.warning("Rate limit hit (request_id=%s): %s", request_id, exc_str)
            return JSONResponse({"error": "Rate limit reached for the selected AI model. Please wait a moment and try again, or switch to a different model."}, status_code=429)
        return JSONResponse({"error": "Chat failed"}, status_code=500)


# ---------------------------------------------------------------------------
# WebSocket streaming endpoint
# ---------------------------------------------------------------------------

@router.websocket("/api/chat/stream")
async def websocket_chat_stream(ws: WebSocket) -> None:
    await ws.accept()
    logger.info("WebSocket client connected")

    # --- JWT authentication handshake ---
    try:
        auth_raw = await asyncio.wait_for(ws.receive_text(), timeout=10)
        auth_data = json.loads(auth_raw)
        if auth_data.get("type") != "auth" or not auth_data.get("token"):
            await ws.close(code=4001, reason="Invalid auth message")
            return
        payload = jose_jwt.decode(
            auth_data["token"],
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
        user_id = int(payload["sub"])
        logger.info("WebSocket authenticated for user_id=%s", user_id)
    except (asyncio.TimeoutError, json.JSONDecodeError, JWTError, KeyError, ValueError) as exc:
        logger.warning("WebSocket auth failed: %s", exc)
        await ws.close(code=4001, reason="Authentication failed")
        return

    # Confirm auth succeeded so the client knows it can send messages
    await ws.send_json({"type": "auth_ok"})

    mcp_connected = getattr(ws.app.state, 'mcp_connected', True)
    if not mcp_connected:
        await ws.send_json({"type": "warning", "message": "AI tools are currently unavailable. Responses may be limited."})

    # Get shared state from the app
    agent: Agent = ws.app.state.agent
    sm: SessionManager = ws.app.state.session_manager

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "error": "Invalid message format"})
                continue

            msg_type = data.get("type")

            if msg_type == "cancel":
                session_id = data.get("sessionId")
                if session_id:
                    sm.cancel_chat(session_id)
                continue

            if msg_type == "chat":
                # Always update session user_id from WS auth
                session_id = data.get("sessionId")
                if session_id:
                    session = sm.get_session(session_id)
                    if session:
                        session.user_id = user_id
                await _handle_chat(ws, data, agent, sm)
                continue

            await ws.send_json({"type": "error", "error": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await ws.send_json({"type": "error", "error": str(exc)})
            await ws.close()
        except Exception:
            pass


async def _handle_chat(
    ws: WebSocket,
    data: dict,
    agent: Agent,
    sm: SessionManager,
) -> None:
    """Stream a chat response over WebSocket.

    Protocol matches server.ts lines 228-260:
      { type: 'start',  messageId }
      { type: 'chunk',  messageId, content?, toolCall? }
      { type: 'end',    messageId }
      { type: 'error',  error }
    """
    session_id = data.get("sessionId")
    user_message = data.get("message")

    if not session_id or not user_message:
        await ws.send_json({"type": "error", "error": "sessionId and message are required"})
        return

    session = sm.get_session(session_id)
    if not session:
        await ws.send_json({"type": "error", "error": "Session not found"})
        return

    # Reset cancel event for this request
    session.cancel_event.clear()

    message_id = str(uuid4())

    try:
        await ws.send_json({"type": "start", "messageId": message_id})

        instructions = build_instructions(session.trip_context, session.chat_mode)
        sm.truncate_history(session)

        # Resolve trip-level API key for the AI provider
        trip_api_key = await _resolve_trip_api_key(session)
        model = resolve_model_with_key(session.pydantic_ai_model, trip_api_key)

        async def event_handler(ctx, event_stream):
            """Forward ALL events to WebSocket — text, tool calls, and tool results.

            Using run() + event_stream_handler (instead of run_stream + stream_text)
            ensures the full multi-turn ReAct loop completes: model → tool → model → ...
            stream_text() would exit on the first text output, preventing tool execution.
            """
            tool_timings: dict[str, float] = {}

            async for event in event_stream:
                if session.cancel_event.is_set():
                    return

                session.last_activity = datetime.now(timezone.utc)

                # Text streaming: initial text from PartStartEvent
                if isinstance(event, PartStartEvent):
                    if hasattr(event.part, 'content') and not hasattr(event.part, 'tool_name'):
                        if event.part.content:
                            await ws.send_json({
                                "type": "chunk",
                                "messageId": message_id,
                                "content": event.part.content,
                            })

                # Text streaming: subsequent deltas
                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    await ws.send_json({
                        "type": "chunk",
                        "messageId": message_id,
                        "content": event.delta.content_delta,
                    })

                # Tool calls
                elif isinstance(event, FunctionToolCallEvent):
                    tool_call_info = {
                        "id": event.part.tool_call_id or str(uuid4()),
                        "name": event.part.tool_name,
                        "arguments": event.part.args if isinstance(event.part.args, dict) else {},
                    }
                    tool_timings[tool_call_info["id"]] = time.monotonic()
                    logger.info("Tool call START: %s (id=%s)", event.part.tool_name, tool_call_info["id"])
                    await ws.send_json({
                        "type": "chunk",
                        "messageId": message_id,
                        "toolCall": tool_call_info,
                    })

                # Tool results
                elif isinstance(event, FunctionToolResultEvent):
                    # tool_call_id is on the event itself, not on event.result
                    tool_call_id = event.tool_call_id or str(uuid4())
                    raw_content = event.result.content if hasattr(event.result, "content") else str(event.result)
                    # MCP tools may return CallToolResult; ensure we send a string
                    if isinstance(raw_content, str):
                        result_content = raw_content
                    elif isinstance(raw_content, list):
                        # CallToolResult.content is a list of TextContent objects
                        parts = []
                        for item in raw_content:
                            if hasattr(item, "text"):
                                parts.append(item.text)
                            else:
                                parts.append(str(item))
                        result_content = "\n".join(parts)
                    else:
                        result_content = str(raw_content)
                    is_error = getattr(event.result, "is_error", False) if hasattr(event.result, "is_error") else False
                    start_t = tool_timings.pop(tool_call_id, None)
                    elapsed = f"{time.monotonic() - start_t:.1f}s" if start_t else "unknown"
                    logger.info("Tool call END: %s (id=%s, elapsed=%s, error=%s, length=%d)", tool_call_id, tool_call_id, elapsed, is_error, len(result_content))
                    await ws.send_json({
                        "type": "chunk",
                        "messageId": message_id,
                        "toolResult": {
                            "toolCallId": tool_call_id,
                            "content": result_content,
                            "isError": is_error,
                        },
                    })

                else:
                    logger.debug("Unhandled event type: %s", type(event).__name__)

        # run() completes the full multi-turn loop (model → tool → model → final answer).
        # The event_stream_handler streams all events (text deltas, tool calls, results)
        # to the WebSocket in real-time.
        usage_limits = UsageLimits(request_limit=25)

        async with session.lock:
            result = await asyncio.wait_for(
                agent.run(
                    user_message,
                    model=model,
                    message_history=session.message_history,
                    instructions=instructions,
                    event_stream_handler=event_handler,
                    model_settings=_get_model_settings(session.pydantic_ai_model),
                    usage_limits=usage_limits,
                ),
                timeout=120,
            )
            session.message_history = result.all_messages()

        await ws.send_json({"type": "end", "messageId": message_id})

    except asyncio.TimeoutError:
        logger.warning("Chat timed out (message_id=%s)", message_id)
        await ws.send_json({
            "type": "error",
            "error": "Request timed out after 120 seconds",
        })
    except Exception as exc:
        exc_str = str(exc)
        logger.exception("Streaming error (message_id=%s)", message_id)
        # Detect rate-limit / quota errors from any provider and surface a friendly message
        if "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str or "rate_limit" in exc_str.lower() or "rate limit" in exc_str.lower():
            logger.warning("Rate limit hit (message_id=%s): %s", message_id, exc_str)
            await ws.send_json({
                "type": "error",
                "error": "Rate limit reached for the selected AI model. Please wait a moment and try again, or switch to a different model.",
            })
        else:
            await ws.send_json({
                "type": "error",
                "error": exc_str,
            })

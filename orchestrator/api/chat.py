"""REST chat endpoint and WebSocket streaming handler."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from jose import JWTError, jwt as jose_jwt
from pydantic_ai import (
    Agent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    UsageLimits,
)

from orchestrator.agent import resolve_model_with_key
from orchestrator.api.deps import get_agent, get_session_manager, verify_token
from orchestrator.config import settings
from orchestrator.middleware.ws_rate_limit import WebSocketRateLimiter
from orchestrator.services.chat_service import (
    build_instructions,
    ensure_mcp_alive,
    get_model_settings,
    resolve_trip_api_key,
)
from orchestrator.services.error_handler import (
    ChatCancelledError,
    ChatTimeoutError,
    classify_error,
)
from orchestrator.session import Session, SessionManager

logger = logging.getLogger("orchestrator.api.chat")

router = APIRouter()

_ws_rate_limiter = WebSocketRateLimiter(rate=10.0, burst=20)


# ---------------------------------------------------------------------------
# REST chat
# ---------------------------------------------------------------------------

@router.post("/api/chat")
async def chat(request: Request) -> dict:
    await verify_token(request)
    sm = get_session_manager(request)
    agent = get_agent(request)

    body = await request.json()
    session_id = body.get("sessionId")
    message = body.get("message")

    if not session_id or not message:
        return JSONResponse({"error": "sessionId and message are required"}, status_code=400)

    session = sm.get_session(session_id)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    request_id = str(uuid4())
    try:
        instructions = build_instructions(
            session.trip_context,
            session.chat_mode,
            session.custom_system_prompt,
        )
        sm.truncate_history(session)

        usage_limits = UsageLimits(request_limit=25)

        async with session.lock:
            trip_api_key = await resolve_trip_api_key(session)
            model = resolve_model_with_key(session.pydantic_ai_model, trip_api_key)

            run_task = asyncio.create_task(
                agent.run(
                    message,
                    model=model,
                    message_history=session.message_history,
                    instructions=instructions,
                    model_settings=get_model_settings(session.pydantic_ai_model),
                    usage_limits=usage_limits,
                )
            )

            async def _cancel_watcher():
                await session.cancel_event.wait()
                if not run_task.done():
                    run_task.cancel()

            watcher = asyncio.create_task(_cancel_watcher())
            try:
                result = await asyncio.wait_for(run_task, timeout=180)
                session.message_history = result.all_messages()
            except asyncio.CancelledError:
                logger.info("Chat cancelled by user (session_id=%s)", session_id)
                return JSONResponse({"error": "Request cancelled by user"}, status_code=499)
            finally:
                watcher.cancel()

        # Extract tool calls
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
            "sessionId": session_id,
            "response": result.output,
            "toolCalls": tool_calls if tool_calls else None,
        }
    except asyncio.TimeoutError:
        raise ChatTimeoutError()
    except Exception as exc:
        logger.exception("Error in chat (request_id=%s)", request_id)
        err = classify_error(exc)
        return JSONResponse({"error": err.message}, status_code=err.status_code)


# ---------------------------------------------------------------------------
# WebSocket streaming
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
        )
        user_id = int(payload["sub"])
        logger.info("WebSocket authenticated for user_id=%s", user_id)
    except (asyncio.TimeoutError, json.JSONDecodeError, JWTError, KeyError, ValueError) as exc:
        logger.warning("WebSocket auth failed: %s", exc)
        await ws.close(code=4001, reason="Authentication failed")
        return

    await ws.send_json({"type": "auth_ok"})

    mcp_connected = getattr(ws.app.state, 'mcp_connected', True)
    if not mcp_connected:
        await ws.send_json({"type": "warning", "message": "AI tools are currently unavailable. Responses may be limited."})

    agent: Agent = ws.app.state.agent
    sm: SessionManager = ws.app.state.session_manager

    active_session_id: str | None = None

    try:
        while True:
            raw = await ws.receive_text()

            # Rate limiting per user
            if not _ws_rate_limiter.allow(str(user_id)):
                await ws.send_json({"type": "error", "error": "Rate limited. Please slow down."})
                continue

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
                session_id = data.get("sessionId")
                active_session_id = session_id
                if session_id:
                    session = sm.get_session(session_id)
                    if session:
                        session.user_id = user_id
                        # Cross-check destinationId hint from frontend
                        hint_dest_id = data.get("destinationId")
                        if hint_dest_id is not None:
                            current_dest = (session.trip_context or {}).get("destination", {})
                            current_dest_id = current_dest.get("id")
                            if current_dest_id is not None and current_dest_id != hint_dest_id:
                                logger.warning(
                                    "Destination mismatch in session %s: session has %s, message says %s — updating",
                                    session_id, current_dest_id, hint_dest_id,
                                )
                                if session.trip_context and "destination" in session.trip_context:
                                    session.trip_context["destination"]["id"] = hint_dest_id
                await _handle_chat(ws, data, agent, sm)
                continue

            await ws.send_json({"type": "error", "error": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
        if active_session_id:
            sm.cancel_chat(active_session_id)
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

    Protocol: { type: 'start' } → { type: 'chunk', content/toolCall/toolResult } → { type: 'end' }
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

    session.cancel_event.clear()
    message_id = str(uuid4())

    try:
        await ws.send_json({"type": "start", "messageId": message_id})

        # Detect destination switch — inject anti-poison system note
        _inject_destination_switch_note(session)

        instructions = build_instructions(
            session.trip_context,
            session.chat_mode,
            session.custom_system_prompt,
        )
        sm.truncate_history(session)

        await ensure_mcp_alive(ws.app)

        async def event_handler(ctx, event_stream):
            """Forward events to WebSocket: text, tool calls, and tool results."""
            tool_timings: dict[str, float] = {}

            async for event in event_stream:
                if session.cancel_event.is_set():
                    return

                session.last_activity = datetime.now(timezone.utc)

                if isinstance(event, PartStartEvent):
                    if hasattr(event.part, 'content') and not hasattr(event.part, 'tool_name'):
                        if event.part.content:
                            await ws.send_json({
                                "type": "chunk",
                                "messageId": message_id,
                                "content": event.part.content,
                            })

                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    await ws.send_json({
                        "type": "chunk",
                        "messageId": message_id,
                        "content": event.delta.content_delta,
                    })

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

                elif isinstance(event, FunctionToolResultEvent):
                    tool_call_id = event.tool_call_id or str(uuid4())
                    raw_content = event.result.content if hasattr(event.result, "content") else str(event.result)
                    if isinstance(raw_content, str):
                        result_content = raw_content
                    elif isinstance(raw_content, list):
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

        usage_limits = UsageLimits(request_limit=25)

        async with session.lock:
            trip_api_key = await resolve_trip_api_key(session)
            model = resolve_model_with_key(session.pydantic_ai_model, trip_api_key)

            run_task = asyncio.create_task(
                agent.run(
                    user_message,
                    model=model,
                    message_history=session.message_history,
                    instructions=instructions,
                    event_stream_handler=event_handler,
                    model_settings=get_model_settings(session.pydantic_ai_model),
                    usage_limits=usage_limits,
                )
            )

            async def _cancel_watcher():
                await session.cancel_event.wait()
                if not run_task.done():
                    run_task.cancel()

            watcher = asyncio.create_task(_cancel_watcher())
            try:
                result = await asyncio.wait_for(run_task, timeout=180)
                session.message_history = result.all_messages()
            except asyncio.CancelledError:
                logger.info("Chat cancelled by user (message_id=%s)", message_id)
                await ws.send_json({"type": "end", "messageId": message_id, "cancelled": True})
                return
            finally:
                watcher.cancel()

        await ws.send_json({"type": "end", "messageId": message_id})

    except asyncio.TimeoutError:
        logger.warning("Chat timed out (message_id=%s)", message_id)
        await ws.send_json({"type": "error", "error": "Request timed out after 180 seconds"})
    except Exception as exc:
        logger.exception("Streaming error (message_id=%s)", message_id)
        err = classify_error(exc)
        await ws.send_json({"type": "error", "error": err.message})


def _inject_destination_switch_note(session: Session) -> None:
    """Inject a system note when the active destination changes mid-session."""
    current_dest = (session.trip_context or {}).get("destination", {})
    current_dest_id = current_dest.get("id")
    current_dest_name = current_dest.get("name", "Unknown")
    prev_dest_id = getattr(session, "_prev_destination_id", None)

    if current_dest_id is not None and prev_dest_id is not None and current_dest_id != prev_dest_id:
        logger.info(
            "Destination switched %s → %s (%s) in session %s",
            prev_dest_id, current_dest_id, current_dest_name, session.id,
        )
        from pydantic_ai.messages import ModelRequest, UserPromptPart
        switch_note = ModelRequest(parts=[UserPromptPart(
            content=(
                f"[SYSTEM] Context switched to {current_dest_name} "
                f"(destination_id={current_dest_id}). "
                f"All subsequent POI and accommodation operations must target "
                f"destination_id={current_dest_id}. Disregard previous destination IDs."
            ),
        )])
        session.message_history.append(switch_note)

    session._prev_destination_id = current_dest_id  # type: ignore[attr-defined]

"""Pydantic models for REST/WS API contracts.

All field names use camelCase aliases to match the frontend expectations.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(CamelModel):
    status: str
    version: str
    timestamp: str


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ModelInfoResponse(CamelModel):
    id: str
    name: str
    provider: str
    supports_streaming: bool = Field(alias="supportsStreaming")
    supports_tools: bool = Field(alias="supportsTools")
    is_default: bool | None = Field(default=None, alias="isDefault")
    description: str | None = None


class ModelsResponse(CamelModel):
    models: list[ModelInfoResponse]
    default: str | None = None


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class TripContext(CamelModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=_to_camel,
        extra="allow",
    )
    trip_id: int | None = Field(default=None, alias="tripId")
    destination_id: int | None = Field(default=None, alias="destinationId")
    current_location: dict[str, float] | None = Field(default=None, alias="currentLocation")
    # Rich context fields
    destination: dict[str, Any] | None = None
    name: str | None = None
    start_date: str | None = Field(default=None, alias="startDate")
    end_date: str | None = Field(default=None, alias="endDate")
    budget: float | None = None
    currency: str | None = None
    destinations: list[dict[str, Any]] | None = None


class CreateSessionRequest(CamelModel):
    model_id: str | None = Field(default=None, alias="modelId")
    trip_context: TripContext | None = Field(default=None, alias="tripContext")
    agent_config: dict[str, Any] | None = Field(default=None, alias="agentConfig")
    chat_mode: str | None = Field(default=None, alias="chatMode")


class CreateSessionResponse(CamelModel):
    session_id: str = Field(alias="sessionId")
    model_id: str = Field(alias="modelId")
    created_at: datetime = Field(alias="createdAt")


class SessionInfoResponse(CamelModel):
    session_id: str = Field(alias="sessionId")
    model_id: str = Field(alias="modelId")
    message_count: int = Field(alias="messageCount")
    created_at: datetime = Field(alias="createdAt")
    last_activity: datetime = Field(alias="lastActivity")


class SessionListItem(CamelModel):
    id: str
    model_id: str = Field(alias="modelId")
    message_count: int = Field(alias="messageCount")
    created_at: datetime = Field(alias="createdAt")


class SessionListResponse(CamelModel):
    sessions: list[SessionListItem]


# ---------------------------------------------------------------------------
# Chat (REST)
# ---------------------------------------------------------------------------

class ChatRequest(CamelModel):
    session_id: str = Field(alias="sessionId")
    message: str


class ToolCallInfo(CamelModel):
    id: str
    name: str
    arguments: dict[str, Any]


class ChatResponse(CamelModel):
    session_id: str = Field(alias="sessionId")
    response: str
    tool_calls: list[ToolCallInfo] | None = Field(default=None, alias="toolCalls")


# ---------------------------------------------------------------------------
# WebSocket messages
# ---------------------------------------------------------------------------

class WSChatMessage(CamelModel):
    """Incoming WS message from the frontend."""

    type: str  # 'chat' | 'cancel'
    session_id: str | None = Field(default=None, alias="sessionId")
    message: str | None = None
    model_id: str | None = Field(default=None, alias="modelId")

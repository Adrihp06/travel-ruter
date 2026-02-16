from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    trip_id: Optional[int] = Field(None, description="Trip this conversation belongs to")
    title: str = Field(default="New Conversation", max_length=100)
    model_id: Optional[str] = Field(None, max_length=100)
    messages: List[Any] = Field(default_factory=list, description="Frontend UI messages")
    backend_history: Optional[List[Any]] = Field(None, description="PydanticAI serialized messages")
    trip_context: Optional[Any] = None
    destination_context: Optional[Any] = None


class ConversationUpdate(BaseModel):
    trip_id: Optional[int] = None
    title: Optional[str] = Field(None, max_length=100)
    model_id: Optional[str] = Field(None, max_length=100)
    messages: Optional[List[Any]] = None
    backend_history: Optional[List[Any]] = None
    trip_context: Optional[Any] = None
    destination_context: Optional[Any] = None


class ConversationResponse(BaseModel):
    id: int
    user_id: int
    trip_id: Optional[int] = None
    title: str
    model_id: Optional[str] = None
    message_count: int = 0
    messages: List[Any] = Field(default_factory=list)
    backend_history: Optional[List[Any]] = None
    trip_context: Optional[Any] = None
    destination_context: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationSummary(BaseModel):
    id: int
    trip_id: Optional[int] = None
    title: str
    model_id: Optional[str] = None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    conversations: List[ConversationSummary]
    count: int

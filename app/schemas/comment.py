from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class CommentCreate(BaseModel):
    entity_type: str = Field(..., description="Type: poi, accommodation, destination")
    entity_id: int = Field(..., description="ID of the entity")
    content: str = Field(..., min_length=1, description="Comment text")
    parent_id: Optional[int] = Field(None, description="Parent comment ID for replies")


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, description="Updated comment text")


class CommentResponse(BaseModel):
    id: int
    trip_id: int
    entity_type: str
    entity_id: int
    user_id: int
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    content: str
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    replies: list["CommentResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

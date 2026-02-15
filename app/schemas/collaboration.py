from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class TripMemberCreate(BaseModel):
    email: str = Field(..., description="Email of user to invite")
    role: str = Field(default="viewer", description="Role: owner, editor, viewer")


class TripMemberUpdate(BaseModel):
    role: str = Field(..., description="New role: owner, editor, viewer")


class TripMemberResponse(BaseModel):
    id: int
    trip_id: int
    user_id: int
    role: str
    status: str
    invited_by: Optional[int] = None
    accepted_at: Optional[datetime] = None
    created_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_avatar: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InvitationResponse(BaseModel):
    id: int
    trip_id: int
    trip_name: str
    role: str
    status: str
    invited_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

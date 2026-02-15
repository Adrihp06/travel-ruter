from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UserBase(BaseModel):
    email: str = Field(..., description="User email address")
    name: Optional[str] = Field(None, description="Display name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")


class UserCreate(UserBase):
    oauth_provider: str = Field(..., description="OAuth provider (google, github)")
    oauth_id: str = Field(..., description="OAuth provider user ID")


class UserResponse(UserBase):
    id: int
    oauth_provider: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPublic(BaseModel):
    """Public user info for display (no email)."""
    id: int
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

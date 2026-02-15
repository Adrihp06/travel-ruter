from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    trip_id: Optional[int] = None
    type: str
    title: str
    message: Optional[str] = None
    data: Optional[Any] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationList(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class UnreadCount(BaseModel):
    count: int

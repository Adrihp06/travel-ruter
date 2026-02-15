from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class ActivityLogResponse(BaseModel):
    id: int
    trip_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    details: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityList(BaseModel):
    activities: list[ActivityLogResponse]
    total: int

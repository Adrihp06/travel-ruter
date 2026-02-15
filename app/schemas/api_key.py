from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ApiKeySet(BaseModel):
    key: str = Field(..., min_length=1, description="The API key value")


class ApiKeyResponse(BaseModel):
    id: int
    trip_id: int
    service_name: str
    masked_key: str = Field(..., description="Masked API key (e.g., sk-...xyz)")
    added_by: Optional[int] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyTestResult(BaseModel):
    service_name: str
    is_valid: bool
    message: str

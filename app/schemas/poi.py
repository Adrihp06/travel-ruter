from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any, List
from pydantic import BaseModel, ConfigDict, Field


class POIBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="POI name")
    category: str = Field(..., min_length=1, max_length=100, description="POI category")
    description: Optional[str] = Field(None, description="POI description")
    address: Optional[str] = Field(None, max_length=500, description="Address")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    estimated_cost: Optional[Decimal] = Field(None, description="Estimated cost")
    actual_cost: Optional[Decimal] = Field(None, description="Actual cost spent")
    currency: str = Field(default="USD", max_length=3, description="Currency code")
    dwell_time: Optional[int] = Field(None, description="Estimated dwell time in minutes")
    likes: int = Field(default=0, description="Number of likes")
    vetoes: int = Field(default=0, description="Number of vetoes")
    priority: int = Field(default=0, description="Priority level")
    files: Optional[List[Any]] = Field(None, description="Array of file URLs/metadata")
    metadata_json: Optional[dict] = Field(None, description="Additional metadata")
    external_id: Optional[str] = Field(None, max_length=255, description="External source ID")
    external_source: Optional[str] = Field(None, max_length=50, description="External source name")
    scheduled_date: Optional[date] = Field(None, description="Date this POI is scheduled for")
    day_order: Optional[int] = Field(None, description="Order within the scheduled day")


class POICreate(POIBase):
    destination_id: int = Field(..., description="Destination ID")


class POIUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="POI name")
    category: Optional[str] = Field(None, min_length=1, max_length=100, description="POI category")
    description: Optional[str] = Field(None, description="POI description")
    address: Optional[str] = Field(None, max_length=500, description="Address")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    estimated_cost: Optional[Decimal] = Field(None, description="Estimated cost")
    actual_cost: Optional[Decimal] = Field(None, description="Actual cost spent")
    currency: Optional[str] = Field(None, max_length=3, description="Currency code")
    dwell_time: Optional[int] = Field(None, description="Estimated dwell time in minutes")
    likes: Optional[int] = Field(None, description="Number of likes")
    vetoes: Optional[int] = Field(None, description="Number of vetoes")
    priority: Optional[int] = Field(None, description="Priority level")
    files: Optional[List[Any]] = Field(None, description="Array of file URLs/metadata")
    metadata_json: Optional[dict] = Field(None, description="Additional metadata")
    external_id: Optional[str] = Field(None, max_length=255, description="External source ID")
    external_source: Optional[str] = Field(None, max_length=50, description="External source name")
    scheduled_date: Optional[date] = Field(None, description="Date this POI is scheduled for")
    day_order: Optional[int] = Field(None, description="Order within the scheduled day")


class POIVote(BaseModel):
    type: str = Field(..., pattern="^(like|veto)$", description="Vote type: 'like' or 'veto'")


class POIResponse(POIBase):
    id: int
    destination_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class POIsByCategory(BaseModel):
    category: str
    pois: List[POIResponse]


class POIScheduleItem(BaseModel):
    """Single POI schedule update item"""
    id: int = Field(..., description="POI ID")
    scheduled_date: Optional[date] = Field(None, description="Date to schedule the POI (null to unschedule)")
    day_order: int = Field(..., description="Order within the day (0-indexed)")


class POIBulkScheduleUpdate(BaseModel):
    """Bulk update for POI schedules"""
    updates: List[POIScheduleItem] = Field(..., description="List of POI schedule updates")

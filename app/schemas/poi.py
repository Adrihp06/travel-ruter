from datetime import datetime, date, time
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
    is_anchored: bool = Field(default=False, description="Whether this POI is anchored to a specific time")
    anchored_time: Optional[time] = Field(None, description="Time of day when this POI is anchored (HH:MM format)")


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
    is_anchored: Optional[bool] = Field(None, description="Whether this POI is anchored to a specific time")
    anchored_time: Optional[time] = Field(None, description="Time of day when this POI is anchored (HH:MM format)")


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


class PaginatedPOIsByCategoryResponse(BaseModel):
    """Paginated response for POIs grouped by category"""
    items: List[POIsByCategory]
    total: int
    skip: int
    limit: int


class POIScheduleItem(BaseModel):
    """Single POI schedule update item"""
    id: int = Field(..., description="POI ID")
    scheduled_date: Optional[date] = Field(None, description="Date to schedule the POI (null to unschedule)")
    day_order: int = Field(..., description="Order within the day (0-indexed)")


class POIBulkScheduleUpdate(BaseModel):
    """Bulk update for POI schedules"""
    updates: List[POIScheduleItem] = Field(..., description="List of POI schedule updates")


class StartLocation(BaseModel):
    """Start location for route optimization"""
    lat: float = Field(..., description="Latitude of start location")
    lon: float = Field(..., description="Longitude of start location")


class POIOptimizationRequest(BaseModel):
    """Request for POI route optimization"""
    day_number: int = Field(..., ge=1, description="Day number to optimize (1-indexed)")
    start_location: StartLocation = Field(..., description="Starting location (accommodation)")
    start_time: str = Field(default="08:00", pattern=r"^\d{2}:\d{2}$", description="Start time in HH:MM format (default 08:00)")


class OptimizedPOI(BaseModel):
    """POI with computed visit time"""
    id: int
    name: str
    category: str
    latitude: Optional[float]
    longitude: Optional[float]
    dwell_time: Optional[int]
    estimated_arrival: str = Field(..., description="Estimated arrival time in HH:MM format")
    estimated_departure: str = Field(..., description="Estimated departure time in HH:MM format")


class POIOptimizationResponse(BaseModel):
    """Response from POI route optimization"""
    optimized_order: List[int] = Field(..., description="POI IDs in optimal visiting order")
    total_distance_km: float = Field(..., description="Total route distance in kilometers")
    total_duration_minutes: int = Field(..., description="Total travel time in minutes (excluding dwell time)")
    route_geometry: Optional[dict] = Field(None, description="GeoJSON geometry of the optimized route")
    original_order: List[int] = Field(..., description="Original POI order for comparison")
    pois: List[POIResponse] = Field(..., description="POIs in optimized order with full details")
    schedule: List[OptimizedPOI] = Field(..., description="POIs with estimated visit times")
    start_time: str = Field(..., description="Day start time in HH:MM format")

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field
from enum import Enum


class TravelMode(str, Enum):
    PLANE = "plane"
    CAR = "car"
    TRAIN = "train"
    BUS = "bus"
    WALK = "walk"
    BIKE = "bike"
    FERRY = "ferry"


class TravelSegmentBase(BaseModel):
    travel_mode: TravelMode = Field(..., description="Mode of transportation")


class TravelSegmentCreate(TravelSegmentBase):
    from_destination_id: int = Field(..., description="Origin destination ID")
    to_destination_id: int = Field(..., description="Target destination ID")


class TravelSegmentUpdate(BaseModel):
    travel_mode: Optional[TravelMode] = Field(None, description="Mode of transportation")


class TravelSegmentResponse(TravelSegmentBase):
    id: int
    from_destination_id: int
    to_destination_id: int
    distance_km: Optional[float] = Field(None, description="Distance in kilometers")
    duration_minutes: Optional[int] = Field(None, description="Duration in minutes")
    route_geometry: Optional[dict[str, Any]] = Field(None, description="GeoJSON LineString geometry for the route")
    is_fallback: bool = Field(False, description="True if route is from fallback service (car route when transit unavailable)")
    route_legs: Optional[list[dict[str, Any]]] = Field(None, description="Per-leg route data when stops have different travel modes")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TravelSegmentCalculateRequest(BaseModel):
    """Request body for calculating/updating a travel segment"""
    travel_mode: TravelMode = Field(..., description="Mode of transportation")


class TravelSegmentWithDestinations(TravelSegmentResponse):
    """Travel segment with destination details for display"""
    from_city_name: Optional[str] = None
    to_city_name: Optional[str] = None


class TripTravelSegmentsResponse(BaseModel):
    """Response containing all travel segments for a trip"""
    segments: list[TravelSegmentResponse]


class OriginReturnSegment(BaseModel):
    """Calculated segment for origin or return routes (not stored in DB)"""
    segment_type: str = Field(..., description="Type of segment: 'origin' or 'return'")
    from_name: str = Field(..., description="Origin location name")
    from_latitude: float = Field(..., description="Origin latitude")
    from_longitude: float = Field(..., description="Origin longitude")
    to_name: str = Field(..., description="Destination location name")
    to_latitude: float = Field(..., description="Destination latitude")
    to_longitude: float = Field(..., description="Destination longitude")
    travel_mode: TravelMode = Field(default=TravelMode.PLANE, description="Mode of transportation")
    distance_km: Optional[float] = Field(None, description="Distance in kilometers")
    duration_minutes: Optional[int] = Field(None, description="Duration in minutes")
    route_geometry: Optional[dict[str, Any]] = Field(None, description="GeoJSON LineString geometry")
    is_fallback: bool = Field(False, description="True if route is from fallback service")


class TripTravelSegmentsWithOriginReturnResponse(BaseModel):
    """Response containing all travel segments for a trip including origin/return segments"""
    segments: list[TravelSegmentResponse] = Field(default_factory=list, description="Segments between destinations")
    origin_segment: Optional[OriginReturnSegment] = Field(None, description="Segment from origin to first destination")
    return_segment: Optional[OriginReturnSegment] = Field(None, description="Segment from last destination to return point")

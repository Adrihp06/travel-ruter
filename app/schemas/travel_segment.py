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
    segment_type: str = Field(default="inter_destination", description="Segment type: inter_destination, origin, or return")
    from_destination_id: Optional[int] = Field(None, description="Origin destination ID (null for origin/return segments)")
    to_destination_id: Optional[int] = Field(None, description="Target destination ID (null for origin/return segments)")
    from_name: Optional[str] = Field(None, max_length=255, description="Origin location name (for origin/return segments)")
    from_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Origin latitude (for origin/return segments)")
    from_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Origin longitude (for origin/return segments)")
    to_name: Optional[str] = Field(None, max_length=255, description="Destination location name (for origin/return segments)")
    to_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Destination latitude (for origin/return segments)")
    to_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Destination longitude (for origin/return segments)")
    distance_km: Optional[float] = Field(None, description="Distance in kilometers")
    duration_minutes: Optional[int] = Field(None, description="Duration in minutes")
    route_geometry: Optional[dict[str, Any]] = Field(None, description="GeoJSON LineString geometry for the route")
    is_fallback: bool = Field(False, description="True if route is from fallback service (car route when transit unavailable)")
    route_legs: Optional[list[dict[str, Any]]] = Field(None, description="Per-leg route data when stops have different travel modes")
    estimated_cost: Optional[float] = Field(None, description="Estimated cost for this travel segment")
    cost_currency: Optional[str] = Field(None, max_length=3, description="Currency for estimated_cost")
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
    """Origin or return segment (can be populated from DB or calculated on-the-fly)"""
    segment_type: str = Field(..., description="Type of segment: 'origin' or 'return'")
    from_name: str = Field(..., max_length=255, description="Origin location name")
    from_latitude: float = Field(..., ge=-90, le=90, description="Origin latitude")
    from_longitude: float = Field(..., ge=-180, le=180, description="Origin longitude")
    to_name: str = Field(..., max_length=255, description="Destination location name")
    to_latitude: float = Field(..., ge=-90, le=90, description="Destination latitude")
    to_longitude: float = Field(..., ge=-180, le=180, description="Destination longitude")
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

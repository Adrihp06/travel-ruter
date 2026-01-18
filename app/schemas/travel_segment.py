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

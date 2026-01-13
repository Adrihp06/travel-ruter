from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude")


class RoutePoint(GeoPoint):
    dwell_time: int = Field(0, ge=0, description="Dwell time in minutes")
    name: Optional[str] = Field(None, description="Name of the location")


class RouteRequest(BaseModel):
    mode: Literal["walking", "cycling"] = Field(..., description="Transportation mode")
    points: List[RoutePoint] = Field(..., min_length=2, description="List of waypoints in order")


class RouteLeg(BaseModel):
    start_point: RoutePoint
    end_point: RoutePoint
    distance_km: float
    travel_time_minutes: float
    description: str


class RouteResponse(BaseModel):
    mode: str
    total_distance_km: float
    total_travel_time_minutes: float
    total_dwell_time_minutes: float
    total_duration_minutes: float
    legs: List[RouteLeg]

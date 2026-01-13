from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class MapboxProfile(str, Enum):
    """Mapbox routing profiles."""
    DRIVING = "driving"
    DRIVING_TRAFFIC = "driving-traffic"
    WALKING = "walking"
    CYCLING = "cycling"


class Coordinate(BaseModel):
    """Geographic coordinate."""
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")


class MapboxRouteRequest(BaseModel):
    """Request for Mapbox route calculation."""
    origin: Coordinate = Field(..., description="Starting point")
    destination: Coordinate = Field(..., description="Ending point")
    profile: MapboxProfile = Field(
        default=MapboxProfile.DRIVING,
        description="Routing profile (driving, driving-traffic, walking, cycling)"
    )
    waypoints: Optional[list[Coordinate]] = Field(
        default=None,
        description="Optional intermediate waypoints"
    )


class MapboxWaypoint(BaseModel):
    """Waypoint returned by Mapbox API."""
    name: str = Field(..., description="Name of the waypoint location")
    location: list[float] = Field(..., description="[longitude, latitude]")


class MapboxRouteResponse(BaseModel):
    """Response from Mapbox route calculation."""
    distance_km: float = Field(..., description="Total distance in kilometers")
    duration_min: float = Field(..., description="Total duration in minutes")
    profile: MapboxProfile = Field(..., description="Routing profile used")
    geometry: dict = Field(..., description="GeoJSON geometry of the route")
    waypoints: list[MapboxWaypoint] = Field(
        default_factory=list,
        description="Snapped waypoint locations"
    )


class MapboxMultiWaypointRequest(BaseModel):
    """Request for multi-waypoint route calculation."""
    waypoints: list[Coordinate] = Field(
        ...,
        min_length=2,
        description="List of waypoints in order (minimum 2)"
    )
    profile: MapboxProfile = Field(
        default=MapboxProfile.WALKING,
        description="Routing profile"
    )


class MapboxErrorResponse(BaseModel):
    """Error response from Mapbox API."""
    error: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")

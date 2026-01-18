"""Schemas for OpenRouteService API."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ORSProfile(str, Enum):
    """OpenRouteService routing profiles."""
    DRIVING_CAR = "driving-car"
    DRIVING_HGV = "driving-hgv"  # Heavy goods vehicle
    CYCLING_REGULAR = "cycling-regular"
    CYCLING_ROAD = "cycling-road"
    CYCLING_MOUNTAIN = "cycling-mountain"
    CYCLING_ELECTRIC = "cycling-electric"
    FOOT_WALKING = "foot-walking"
    FOOT_HIKING = "foot-hiking"
    WHEELCHAIR = "wheelchair"


class ORSCoordinate(BaseModel):
    """Geographic coordinate."""
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")


class ORSRouteRequest(BaseModel):
    """Request for OpenRouteService route calculation."""
    origin: ORSCoordinate = Field(..., description="Starting point")
    destination: ORSCoordinate = Field(..., description="Ending point")
    profile: ORSProfile = Field(
        default=ORSProfile.FOOT_WALKING,
        description="Routing profile"
    )
    waypoints: Optional[list[ORSCoordinate]] = Field(
        default=None,
        description="Optional intermediate waypoints"
    )


class ORSSegment(BaseModel):
    """Route segment from OpenRouteService."""
    distance: float = Field(..., description="Segment distance in meters")
    duration: float = Field(..., description="Segment duration in seconds")


class ORSRouteResponse(BaseModel):
    """Response from OpenRouteService route calculation."""
    distance_km: float = Field(..., description="Total distance in kilometers")
    duration_min: float = Field(..., description="Total duration in minutes")
    profile: ORSProfile = Field(..., description="Routing profile used")
    geometry: dict = Field(..., description="GeoJSON geometry of the route")
    segments: list[ORSSegment] = Field(
        default_factory=list,
        description="Route segments with individual metrics"
    )
    bbox: list[float] = Field(
        default_factory=list,
        description="Bounding box [minLon, minLat, maxLon, maxLat]"
    )


class ORSMultiWaypointRequest(BaseModel):
    """Request for multi-waypoint route calculation."""
    waypoints: list[ORSCoordinate] = Field(
        ...,
        min_length=2,
        description="List of waypoints in order (minimum 2)"
    )
    profile: ORSProfile = Field(
        default=ORSProfile.FOOT_WALKING,
        description="Routing profile"
    )


class ORSServiceStatus(BaseModel):
    """Status of OpenRouteService configuration."""
    available: bool = Field(..., description="Whether the service is configured and available")
    message: str = Field(..., description="Status message")

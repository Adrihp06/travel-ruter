"""
Schemas for Google Maps Routes API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class GoogleMapsRoutesTravelMode(str, Enum):
    """Travel modes for Google Maps Routes API."""
    DRIVE = "DRIVE"
    WALK = "WALK"
    BICYCLE = "BICYCLE"
    TRANSIT = "TRANSIT"


class Coordinate(BaseModel):
    """Coordinate with latitude and longitude."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")


class GoogleMapsRoutesRequest(BaseModel):
    """Request for Google Maps Routes API routing."""
    origin: Coordinate
    destination: Coordinate
    waypoints: Optional[List[Coordinate]] = Field(
        default=None, description="Optional intermediate waypoints"
    )
    travel_mode: GoogleMapsRoutesTravelMode = Field(
        default=GoogleMapsRoutesTravelMode.DRIVE,
        description="Travel mode for directions"
    )
    departure_time: Optional[str] = Field(
        default=None,
        description="Departure time in RFC3339 format (for transit)"
    )


class TransitStep(BaseModel):
    """Details about a transit step (e.g., bus line, train line)."""
    line_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    departure_stop: Optional[str] = None
    arrival_stop: Optional[str] = None
    num_stops: Optional[int] = None


class GoogleMapsRoutesResponse(BaseModel):
    """Response from Google Maps Routes API routing."""
    distance_km: float = Field(..., description="Total distance in kilometers")
    duration_min: int = Field(..., description="Total duration in minutes")
    geometry: dict = Field(..., description="GeoJSON LineString geometry")
    travel_mode: str = Field(..., description="Travel mode used")
    polyline: Optional[str] = Field(
        default=None, description="Encoded polyline"
    )
    transit_details: Optional[List[TransitStep]] = Field(
        default=None, description="Transit-specific details (for TRANSIT mode)"
    )


class GoogleMapsMultiWaypointRequest(BaseModel):
    """Request for multi-waypoint routing via Google Maps Routes API."""
    waypoints: List[Coordinate] = Field(
        ..., min_length=2, description="List of waypoints (at least 2)"
    )
    travel_mode: GoogleMapsRoutesTravelMode = Field(
        default=GoogleMapsRoutesTravelMode.DRIVE,
        description="Travel mode for directions"
    )

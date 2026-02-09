"""
Schemas for route calculation tools.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class TransportProfile(str, Enum):
    """Available transport profiles for routing."""

    WALKING = "foot-walking"
    HIKING = "foot-hiking"
    CYCLING = "cycling-regular"
    CYCLING_ROAD = "cycling-road"
    CYCLING_MOUNTAIN = "cycling-mountain"
    CYCLING_ELECTRIC = "cycling-electric"
    DRIVING = "driving-car"
    WHEELCHAIR = "wheelchair"


class Coordinate(BaseModel):
    """Geographic coordinate."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CalculateRouteInput(BaseModel):
    """Input schema for calculate_route tool."""

    origin: Coordinate = Field(
        ...,
        description="Starting point coordinates",
    )
    destination: Coordinate = Field(
        ...,
        description="Ending point coordinates",
    )
    waypoints: Optional[List[Coordinate]] = Field(
        default=None,
        description="Optional intermediate waypoints",
    )
    profile: TransportProfile = Field(
        default=TransportProfile.WALKING,
        description="Transport mode for routing",
    )


class RouteSegment(BaseModel):
    """A segment of the route with turn-by-turn instructions."""

    distance_meters: float = Field(..., description="Segment distance in meters")
    duration_seconds: float = Field(..., description="Segment duration in seconds")
    instruction: Optional[str] = Field(default=None, description="Navigation instruction")


class RouteResult(BaseModel):
    """Schema for route calculation result."""

    distance_meters: float = Field(..., description="Total distance in meters")
    distance_km: float = Field(..., description="Total distance in kilometers")
    duration_seconds: float = Field(..., description="Total duration in seconds")
    duration_minutes: float = Field(..., description="Total duration in minutes")
    duration_display: str = Field(
        ...,
        description="Human-readable duration (e.g., '45 min' or '1h 30min')",
    )
    profile: str = Field(..., description="Transport profile used")
    segments: List[RouteSegment] = Field(
        default_factory=list,
        description="Route segments with instructions",
    )
    geometry: Optional[Dict[str, Any]] = Field(
        default=None,
        description="GeoJSON geometry for map display",
    )
    bbox: Optional[List[float]] = Field(
        default=None,
        description="Bounding box [min_lon, min_lat, max_lon, max_lat]",
    )


class GetTravelMatrixInput(BaseModel):
    """Input schema for get_travel_matrix tool."""

    locations: List[Coordinate] = Field(
        ...,
        description="List of locations for matrix calculation",
        min_length=2,
        max_length=50,  # ORS limit consideration
    )
    profile: TransportProfile = Field(
        default=TransportProfile.WALKING,
        description="Transport mode for matrix calculation",
    )


class MatrixEntry(BaseModel):
    """Entry in the travel matrix."""

    from_index: int = Field(..., description="Source location index")
    to_index: int = Field(..., description="Destination location index")
    duration_seconds: float = Field(..., description="Travel time in seconds")
    duration_minutes: float = Field(..., description="Travel time in minutes")
    distance_meters: float = Field(..., description="Distance in meters")


class TravelMatrixResult(BaseModel):
    """Schema for travel matrix result."""

    durations: List[List[float]] = Field(
        ...,
        description="Duration matrix [source][dest] in seconds",
    )
    distances: List[List[float]] = Field(
        ...,
        description="Distance matrix [source][dest] in meters",
    )
    locations_count: int = Field(..., description="Number of locations")
    profile: str = Field(..., description="Transport profile used")

    # Convenience format for AI consumption
    summary: List[MatrixEntry] = Field(
        default_factory=list,
        description="Flat list of all matrix entries for easy reading",
    )

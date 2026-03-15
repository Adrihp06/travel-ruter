"""
Travel Matrix schemas for Smart POI Scheduler ORS integration.
"""
from enum import Enum
from typing import Dict, List
from pydantic import BaseModel, Field


class ORSProfile(str, Enum):
    """ORS routing profiles for matrix calculation."""
    FOOT_WALKING = "foot-walking"
    DRIVING_CAR = "driving-car"
    CYCLING_REGULAR = "cycling-regular"
    # Note: PUBLIC_TRANSIT not available in ORS - frontend estimates as 1.5x driving


class MatrixLocation(BaseModel):
    """A location for matrix calculation."""
    id: str = Field(..., max_length=255, description="Location ID (e.g., 'poi_123' or 'accom_day1')")
    lat: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    lon: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    type: str = Field(..., max_length=100, description="Location type: 'poi' or 'accommodation'")


class TravelMatrixRequest(BaseModel):
    """Request for travel time matrix calculation."""
    locations: List[MatrixLocation] = Field(..., description="List of locations to include in matrix")
    profile: ORSProfile = Field(default=ORSProfile.FOOT_WALKING, description="ORS routing profile")


class TravelMatrixResponse(BaseModel):
    """Response containing travel time/distance matrix."""
    profile: ORSProfile = Field(..., description="ORS profile used for calculation")
    locations: List[MatrixLocation] = Field(..., description="Locations included in matrix")
    durations: Dict[str, Dict[str, float]] = Field(
        ...,
        description="Travel durations in seconds: source_id -> destination_id -> seconds"
    )
    distances: Dict[str, Dict[str, float]] = Field(
        ...,
        description="Travel distances in meters: source_id -> destination_id -> meters"
    )
    fallback_used: bool = Field(
        default=False,
        description="True if ORS API failed and Haversine fallback was used"
    )

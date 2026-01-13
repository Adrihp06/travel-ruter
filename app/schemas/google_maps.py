from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class GoogleMapsTravelMode(str, Enum):
    DRIVING = "driving"
    WALKING = "walking"
    BICYCLING = "bicycling"
    TRANSIT = "transit"


class GoogleMapsCoordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


class GoogleMapsExportRequest(BaseModel):
    origin: GoogleMapsCoordinate
    destination: GoogleMapsCoordinate
    waypoints: Optional[List[GoogleMapsCoordinate]] = Field(
        default=None, description="Optional intermediate waypoints"
    )
    travel_mode: GoogleMapsTravelMode = Field(
        default=GoogleMapsTravelMode.DRIVING,
        description="Travel mode for directions"
    )


class GoogleMapsExportResponse(BaseModel):
    url: str = Field(..., description="Google Maps directions URL")
    origin: GoogleMapsCoordinate
    destination: GoogleMapsCoordinate
    waypoints_count: int = Field(
        default=0, description="Number of waypoints included"
    )
    travel_mode: GoogleMapsTravelMode

from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal
from enum import Enum

class TravelMode(str, Enum):
    DRIVING = "driving"
    FLIGHT = "flight"
    TRAIN = "train"

class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")

class RoutingRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    mode: TravelMode = Field(default=TravelMode.DRIVING, description="Mode of travel")

class RoutingResponse(BaseModel):
    distance_km: float
    duration_min: float
    mode: TravelMode
    origin: Coordinate
    destination: Coordinate
    geometry: dict = Field(..., description="GeoJSON LineString")

"""
Pydantic schemas for hotel search and trip export tools.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class HotelSearchResult(BaseModel):
    """A single hotel search result."""
    place_id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    types: List[str] = Field(default_factory=list)


class HotelSearchOutput(BaseModel):
    """Output from hotel search."""
    results: List[HotelSearchResult] = Field(default_factory=list)
    total: int = 0
    message: str = ""


class TripExportOutput(BaseModel):
    """Output from trip export."""
    trip_name: str
    format: str
    content: str
    message: str = ""

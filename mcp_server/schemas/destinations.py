"""
Schemas for destination search and management tools.
"""

from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field
from enum import Enum


class SearchDestinationsInput(BaseModel):
    """Input schema for search_destinations tool."""

    query: str = Field(
        ...,
        description="Location search query (e.g., 'Paris, France' or 'Times Square, NYC')",
        min_length=2,
        max_length=200,
    )
    limit: int = Field(
        default=5,
        description="Maximum number of results to return",
        ge=1,
        le=20,
    )
    language: str = Field(
        default="en",
        description="Language for results (ISO 639-1 code)",
        min_length=2,
        max_length=5,
    )


class DestinationResult(BaseModel):
    """Schema for a destination search result."""

    place_id: int = Field(..., description="Unique identifier from geocoding service")
    display_name: str = Field(..., description="Full formatted address/name")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    type: str = Field(..., description="Location type (city, town, village, etc.)")
    importance: float = Field(
        ...,
        description="Relevance score (0-1, higher is more important)",
        ge=0,
        le=1,
    )


class SearchDestinationsOutput(BaseModel):
    """Output schema for search_destinations tool."""

    results: List[DestinationResult] = Field(
        ..., description="List of matching destinations"
    )
    query: str = Field(..., description="Original search query")
    count: int = Field(..., description="Number of results returned")


# --- manage_destination schemas ---


class DestinationOperation(str, Enum):
    """Available operations for manage_destination tool."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"


class ManagedDestinationResult(BaseModel):
    """Schema for a managed destination result."""

    id: int = Field(..., description="Destination ID")
    trip_id: int = Field(..., description="Parent trip ID")
    city_name: str = Field(..., description="City name")
    country: Optional[str] = None
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    order_index: int = 0
    name: Optional[str] = None
    description: Optional[str] = None
    poi_count: int = Field(default=0, description="Number of POIs in this destination")


class ManageDestinationOutput(BaseModel):
    """Output schema for manage_destination tool."""

    operation: str = Field(..., description="Operation performed")
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    destination: Optional[ManagedDestinationResult] = Field(
        default=None,
        description="Destination data (for create, read, update)",
    )
    destinations: Optional[List[ManagedDestinationResult]] = Field(
        default=None,
        description="List of destinations (for list operation)",
    )
    total_count: Optional[int] = Field(
        default=None,
        description="Total count for list operation",
    )

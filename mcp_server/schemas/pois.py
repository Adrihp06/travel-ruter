"""
Schemas for POI suggestion and management tools.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class GetPOISuggestionsInput(BaseModel):
    """Input schema for get_poi_suggestions tool."""

    latitude: float = Field(
        ...,
        description="Center point latitude for search",
        ge=-90,
        le=90,
    )
    longitude: float = Field(
        ...,
        description="Center point longitude for search",
        ge=-180,
        le=180,
    )
    radius: int = Field(
        default=5000,
        description="Search radius in meters (max 50000)",
        ge=100,
        le=50000,
    )
    category: Optional[str] = Field(
        default=None,
        description="Filter by category: Sights, Museums, Food, Nature, Entertainment, Shopping, Viewpoints, Activity",
    )
    trip_type: Optional[str] = Field(
        default=None,
        description="Filter by trip type: romantic, adventure, family, cultural, food, nature, shopping",
    )
    max_results: int = Field(
        default=20,
        description="Maximum number of suggestions to return",
        ge=1,
        le=50,
    )
    min_rating: Optional[float] = Field(
        default=None,
        description="Minimum rating filter (0-5)",
        ge=0,
        le=5,
    )


class POIMetadata(BaseModel):
    """Metadata for a POI from external source."""

    rating: Optional[float] = Field(default=None, description="User rating (0-5)")
    user_ratings_total: Optional[int] = Field(default=None, description="Number of ratings")
    price_level: Optional[int] = Field(default=None, description="Price level (0-4)")
    types: List[str] = Field(default_factory=list, description="Google place types")
    photos: List[Dict[str, Any]] = Field(default_factory=list, description="Photo references")
    business_status: Optional[str] = Field(default=None, description="Current business status")
    opening_hours: Optional[Dict[str, Any]] = Field(default=None, description="Opening hours info")


class POISuggestion(BaseModel):
    """Schema for a POI suggestion."""

    name: str = Field(..., description="POI name")
    category: str = Field(..., description="Application category (Sights, Museums, Food, etc.)")
    address: Optional[str] = Field(default=None, description="Street address")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    external_id: Optional[str] = Field(default=None, description="Google Place ID")
    external_source: str = Field(default="google_places", description="Data source")
    metadata: Optional[POIMetadata] = Field(default=None, description="Additional metadata")

    # Convenience fields for AI consumption
    rating_display: Optional[str] = Field(
        default=None,
        description="Human-readable rating (e.g., '4.5/5 (1,234 reviews)')",
    )
    price_display: Optional[str] = Field(
        default=None,
        description="Human-readable price level (e.g., '$$')",
    )


class GetPOISuggestionsOutput(BaseModel):
    """Output schema for get_poi_suggestions tool."""

    suggestions: List[POISuggestion] = Field(
        ..., description="List of POI suggestions"
    )
    center: Dict[str, float] = Field(
        ..., description="Search center coordinates"
    )
    radius: int = Field(..., description="Search radius used")
    count: int = Field(..., description="Number of suggestions returned")
    filters_applied: Dict[str, Any] = Field(
        default_factory=dict,
        description="Filters that were applied",
    )


# --- manage_poi schemas ---


class POIOperation(str, Enum):
    """Available operations for manage_poi tool."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"


class POIResult(BaseModel):
    """Schema for a managed POI result."""

    id: int = Field(..., description="POI ID")
    destination_id: int = Field(..., description="Parent destination ID")
    name: str = Field(..., description="POI name")
    category: str = Field(..., description="POI category")
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    estimated_cost: Optional[float] = None
    currency: str = "USD"
    dwell_time: Optional[int] = None
    scheduled_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    day_order: Optional[int] = None
    is_anchored: bool = False
    anchored_time: Optional[str] = None
    external_id: Optional[str] = None
    external_source: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    likes: int = 0
    vetoes: int = 0
    priority: int = 0


class ManagePOIOutput(BaseModel):
    """Output schema for manage_poi tool."""

    operation: str = Field(..., description="Operation performed")
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    poi: Optional[POIResult] = Field(
        default=None,
        description="POI data (for create, read, update)",
    )
    pois: Optional[List[POIResult]] = Field(
        default=None,
        description="List of POIs (for list operation)",
    )
    total_count: Optional[int] = Field(
        default=None,
        description="Total count for list operation",
    )


# --- schedule_pois schemas ---


class ScheduleAssignment(BaseModel):
    """A single POI schedule assignment."""

    poi_id: int = Field(..., description="POI ID to schedule")
    scheduled_date: str = Field(..., description="Date to schedule (YYYY-MM-DD)")
    day_order: int = Field(..., description="Order within the day")


class SchedulePOIsOutput(BaseModel):
    """Output schema for schedule_pois tool."""

    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    updated_count: int = Field(default=0, description="Number of POIs updated")
    assignments: Optional[List[POIResult]] = Field(
        default=None,
        description="Updated POI data",
    )

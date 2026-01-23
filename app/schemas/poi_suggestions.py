"""
Schemas for POI suggestions feature.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class POISuggestionRequest(BaseModel):
    """Request parameters for POI suggestions"""
    radius: int = Field(
        default=5000,
        ge=100,
        le=50000,
        description="Search radius in meters (100m - 50km)"
    )
    category_filter: Optional[str] = Field(
        None,
        description="Filter by category: Sights, Food, Museums, Nature, etc."
    )
    trip_type: Optional[str] = Field(
        None,
        description="Filter by trip type: romantic, adventure, family, cultural, food, nature, shopping"
    )
    max_results: int = Field(
        default=20,
        ge=1,
        le=50,
        description="Maximum number of suggestions to return"
    )


class POISuggestionPhoto(BaseModel):
    """Photo information from Google Places"""
    photo_reference: str
    width: int
    height: int
    url: Optional[str] = Field(None, description="Generated photo URL")


class POISuggestionMetadata(BaseModel):
    """Metadata from Google Places API"""
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    price_level: Optional[int] = Field(None, ge=0, le=4, description="Price level 0-4")
    types: List[str] = Field(default_factory=list)
    photos: List[POISuggestionPhoto] = Field(default_factory=list)
    business_status: Optional[str] = None
    opening_hours: Optional[Dict[str, Any]] = None


class POISuggestion(BaseModel):
    """Single POI suggestion"""
    name: str
    category: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    external_id: str = Field(..., description="Google Place ID")
    external_source: str = Field(default="google_places")
    metadata: POISuggestionMetadata
    distance_km: Optional[float] = Field(None, description="Distance from destination in km")

    # Quick-add helpers
    estimated_cost: Optional[float] = Field(None, description="Estimated cost based on price_level")
    suggested_dwell_time: Optional[int] = Field(None, description="Suggested visit duration in minutes")


class POISuggestionsResponse(BaseModel):
    """Response containing POI suggestions"""
    destination_id: int
    suggestions: List[POISuggestion]
    total_count: int = Field(..., description="Total number of suggestions returned")
    filters_applied: Dict[str, Any] = Field(
        default_factory=dict,
        description="Filters that were applied (category, trip_type, radius)"
    )


class BulkAddPOIsRequest(BaseModel):
    """Request to add multiple suggested POIs at once"""
    destination_id: int
    place_ids: List[str] = Field(..., min_length=1, description="List of Google Place IDs to add")
    category_override: Optional[str] = Field(
        None,
        description="Override category for all POIs"
    )

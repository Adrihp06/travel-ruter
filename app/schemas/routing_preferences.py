"""
Routing preferences schema for configuring which routing service to use.
"""
from enum import Enum
from pydantic import BaseModel, Field


class RoutingPreference(str, Enum):
    """
    Routing service preference options.

    - DEFAULT: Use OpenRouteService for everything (current behavior)
    - GOOGLE_PUBLIC_TRANSPORT: Use Google Maps for train/bus only, ORS for others
    - GOOGLE_EVERYTHING: Use Google Maps for all transport modes
    """
    DEFAULT = "default"
    GOOGLE_PUBLIC_TRANSPORT = "google_public_transport"
    GOOGLE_EVERYTHING = "google_everything"


class RoutingPreferencesRequest(BaseModel):
    """Request to update routing preferences."""
    preference: RoutingPreference = Field(
        default=RoutingPreference.DEFAULT,
        description="Which routing service to use"
    )


class RoutingPreferencesResponse(BaseModel):
    """Response with current routing preferences."""
    preference: RoutingPreference
    google_maps_available: bool = Field(
        description="Whether Google Maps API key is configured"
    )
    ors_available: bool = Field(
        description="Whether OpenRouteService API key is configured"
    )


class GoogleMapsStatusResponse(BaseModel):
    """Response for Google Maps API status check."""
    available: bool = Field(description="Whether Google Maps API is available")
    message: str = Field(description="Status message")

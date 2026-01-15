"""
Geocoding API endpoints for location search.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from pydantic import BaseModel

from app.services.geocoding_service import GeocodingService, GeocodingResult

router = APIRouter()


class GeocodingSearchResponse(BaseModel):
    """Response schema for geocoding search"""
    results: list[GeocodingResult]


@router.get("/search", response_model=GeocodingSearchResponse)
async def search_locations(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=10, description="Maximum number of results"),
    lang: str = Query("en", description="Language for results"),
):
    """
    Search for locations by name/address.

    Uses OpenStreetMap Nominatim API to find matching locations.
    Returns location names with coordinates.
    """
    try:
        results = await GeocodingService.search(
            query=q,
            limit=limit,
            lang=lang,
        )
        return GeocodingSearchResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding search failed: {str(e)}")


@router.get("/reverse", response_model=Optional[GeocodingResult])
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lang: str = Query("en", description="Language for results"),
):
    """
    Get location name from coordinates.

    Uses OpenStreetMap Nominatim API for reverse geocoding.
    """
    try:
        result = await GeocodingService.reverse_geocode(
            latitude=lat,
            longitude=lon,
            lang=lang,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reverse geocoding failed: {str(e)}")

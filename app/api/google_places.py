from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.schemas.google_maps_places import (
    GooglePlacesSearchResponse,
    GooglePlacesDetailResult
)
from app.services.google_places_service import google_places_service

router = APIRouter()

@router.get("/autocomplete", response_model=GooglePlacesSearchResponse)
async def autocomplete_places(
    q: str = Query(..., min_length=2, description="Search query"),
    location: Optional[str] = Query(None, description="Location to bias results (lat,lng)"),
    radius: Optional[int] = Query(None, description="Radius in meters"),
    types: Optional[str] = Query(None, description="Types of places to return")
):
    """
    Autocomplete places using Google Places API.
    """
    try:
        results = await google_places_service.autocomplete(
            query=q,
            location=location,
            radius=radius,
            types=types
        )
        return GooglePlacesSearchResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Autocomplete failed: {str(e)}")

@router.get("/details/{place_id}", response_model=GooglePlacesDetailResult)
async def get_place_details(place_id: str):
    """
    Get place details using Google Places API.
    """
    try:
        result = await google_places_service.get_details(place_id)
        if not result:
            raise HTTPException(status_code=404, detail="Place not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get place details: {str(e)}")

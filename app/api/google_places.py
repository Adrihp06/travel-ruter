from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.schemas.google_maps_places import (
    GooglePlacesSearchResponse,
    GooglePlacesDetailResult,
    GooglePlacesPhotoUrlResponse,
    GooglePlacesPhotosResponse,
)
from app.services.google_places_service import GooglePlacesService, google_places_service

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


@router.get("/photo-url", response_model=GooglePlacesPhotoUrlResponse)
async def get_photo_url(
    photo_reference: str = Query(..., description="Google Places photo reference"),
    max_width: int = Query(400, ge=1, le=1600, description="Maximum photo width"),
):
    """
    Generate a Google Places photo URL from a photo reference.
    """
    try:
        url = GooglePlacesService.get_photo_url(photo_reference, max_width=max_width)
        return GooglePlacesPhotoUrlResponse(url=url, photo_reference=photo_reference)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate photo URL: {str(e)}")


@router.get("/{place_id}/photos", response_model=GooglePlacesPhotosResponse)
async def get_place_photos(place_id: str):
    """
    Fetch photo URLs for a Google place. Uses cached place details when available.
    """
    try:
        details = await GooglePlacesService.get_place_details_for_poi(place_id)
        photos_raw = details.get("photos", [])[:3]
        photos = []
        for photo in photos_raw:
            ref = photo.get("photo_reference")
            if ref:
                url = GooglePlacesService.get_photo_url(ref, max_width=400)
                photos.append(GooglePlacesPhotoUrlResponse(url=url, photo_reference=ref))
        return GooglePlacesPhotosResponse(photos=photos, place_id=place_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch place photos: {str(e)}")

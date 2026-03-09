import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import Response
from typing import Optional
from app.schemas.google_maps_places import (
    GooglePlacesSearchResponse,
    GooglePlacesDetailResult,
    GooglePlacesPhotoUrlResponse,
    GooglePlacesPhotosResponse,
)
from app.core.http_client import get_http_client
from app.services.google_places_service import GooglePlacesService, google_places_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_photo_proxy_url(request: Request, photo_reference: str, max_width: int = 400) -> str:
    return f"{request.url_for('get_place_photo')}?{urlencode({'photo_reference': photo_reference, 'max_width': max_width})}"

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
    request: Request,
    photo_reference: str = Query(..., description="Google Places photo reference"),
    max_width: int = Query(400, ge=1, le=1600, description="Maximum photo width"),
):
    """
    Generate an internal photo proxy URL from a photo reference.
    """
    try:
        GooglePlacesService.get_photo_url(photo_reference, max_width=max_width)
        url = _build_photo_proxy_url(request, photo_reference, max_width=max_width)
        return GooglePlacesPhotoUrlResponse(url=url, photo_reference=photo_reference)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate photo URL: {str(e)}")


@router.get("/photo", name="get_place_photo")
async def get_place_photo(
    photo_reference: str = Query(..., description="Google Places photo reference"),
    max_width: int = Query(400, ge=1, le=1600, description="Maximum photo width"),
):
    """
    Proxy a Google Places photo so clients do not need direct Google API credentials.
    """
    try:
        url = GooglePlacesService.get_photo_url(photo_reference, max_width=max_width)
        client = await get_http_client()
        upstream = await client.get(url, follow_redirects=True)
        upstream.raise_for_status()
        return Response(
            content=upstream.content,
            media_type=upstream.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPError as e:
        logger.warning("Failed to proxy Google place photo %s: %s", photo_reference, e)
        raise HTTPException(status_code=502, detail="Failed to fetch Google place photo")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to proxy Google place photo: {str(e)}")


@router.get("/{place_id}/photos", response_model=GooglePlacesPhotosResponse)
async def get_place_photos(place_id: str, request: Request):
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
                url = _build_photo_proxy_url(request, ref, max_width=400)
                photos.append(GooglePlacesPhotoUrlResponse(url=url, photo_reference=ref))
        return GooglePlacesPhotosResponse(photos=photos, place_id=place_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch place photos: {str(e)}")

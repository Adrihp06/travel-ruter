"""
Geocoding API endpoints for location search.
Supports multiple providers (Nominatim, Mapbox) with caching.
"""

from fastapi import APIRouter, Query, HTTPException, Header
from typing import Optional
from pydantic import BaseModel

from app.services.geocoding_service import GeocodingService, GeocodingResult
from app.services.mapbox_geocoding_service import MapboxGeocodingService
from app.schemas.geocoding_preferences import GeocodingProvider

router = APIRouter()


class GeocodingSearchResponse(BaseModel):
    """Response schema for geocoding search"""
    results: list[GeocodingResult]
    provider: str


class GeocodingStatusResponse(BaseModel):
    """Response schema for provider status"""
    nominatim: dict
    mapbox: dict


class CacheStatsResponse(BaseModel):
    """Response schema for cache statistics"""
    nominatim: dict
    mapbox: dict


def get_effective_provider(
    provider_param: Optional[str],
    provider_header: Optional[str],
) -> GeocodingProvider:
    """Determine which provider to use based on param, header, or default"""
    # Priority: query param > header > default
    provider_str = provider_param or provider_header or GeocodingProvider.NOMINATIM.value

    try:
        return GeocodingProvider(provider_str.lower())
    except ValueError:
        return GeocodingProvider.NOMINATIM


@router.get("/search", response_model=GeocodingSearchResponse)
async def search_locations(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=10, description="Maximum number of results"),
    lang: str = Query("en", description="Language for results"),
    provider: Optional[str] = Query(None, description="Geocoding provider: nominatim or mapbox"),
    x_geocoding_provider: Optional[str] = Header(None, alias="X-Geocoding-Provider"),
):
    """
    Search for locations by name/address.

    Supports multiple providers:
    - nominatim (default): OpenStreetMap, free, ~400-600ms
    - mapbox: Fast ~50-150ms, requires token

    Provider can be specified via query param or X-Geocoding-Provider header.
    Falls back to Nominatim if Mapbox is unavailable.
    """
    effective_provider = get_effective_provider(provider, x_geocoding_provider)
    used_provider = effective_provider.value

    try:
        # Try Mapbox if requested
        if effective_provider == GeocodingProvider.MAPBOX:
            if MapboxGeocodingService.is_available():
                try:
                    results = await MapboxGeocodingService.search(
                        query=q,
                        limit=limit,
                        lang=lang,
                    )
                    return GeocodingSearchResponse(results=results, provider="mapbox")
                except Exception as e:
                    # Fallback to Nominatim on Mapbox error
                    used_provider = "nominatim"
            else:
                # Mapbox not available, fallback
                used_provider = "nominatim"

        # Use Nominatim (default or fallback)
        results = await GeocodingService.search(
            query=q,
            limit=limit,
            lang=lang,
        )
        return GeocodingSearchResponse(results=results, provider=used_provider)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding search failed: {str(e)}")


@router.get("/reverse", response_model=Optional[GeocodingResult])
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    lang: str = Query("en", description="Language for results"),
    provider: Optional[str] = Query(None, description="Geocoding provider: nominatim or mapbox"),
    x_geocoding_provider: Optional[str] = Header(None, alias="X-Geocoding-Provider"),
):
    """
    Get location name from coordinates.

    Supports multiple providers:
    - nominatim (default): OpenStreetMap, free, ~400-600ms
    - mapbox: Fast ~50-150ms, requires token

    Provider can be specified via query param or X-Geocoding-Provider header.
    Falls back to Nominatim if Mapbox is unavailable.
    """
    effective_provider = get_effective_provider(provider, x_geocoding_provider)

    try:
        # Try Mapbox if requested
        if effective_provider == GeocodingProvider.MAPBOX:
            if MapboxGeocodingService.is_available():
                try:
                    result = await MapboxGeocodingService.reverse_geocode(
                        latitude=lat,
                        longitude=lon,
                        lang=lang,
                    )
                    return result
                except Exception:
                    # Fallback to Nominatim on Mapbox error
                    pass

        # Use Nominatim (default or fallback)
        result = await GeocodingService.reverse_geocode(
            latitude=lat,
            longitude=lon,
            lang=lang,
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reverse geocoding failed: {str(e)}")


@router.get("/status", response_model=GeocodingStatusResponse)
async def get_provider_status():
    """
    Get availability status of geocoding providers.

    Returns configuration status and availability for each provider.
    """
    return GeocodingStatusResponse(
        nominatim={
            "available": True,
            "description": "OpenStreetMap Nominatim - Free, ~400-600ms latency",
        },
        mapbox={
            "available": MapboxGeocodingService.is_available(),
            "description": "Mapbox Geocoding API v6 - Fast ~50-150ms, requires token",
            "token_configured": MapboxGeocodingService.is_available(),
        },
    )


@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats():
    """
    Get cache statistics for all providers.

    Returns hit/miss rates, cache sizes, and TTL configuration.
    """
    return CacheStatsResponse(
        nominatim=GeocodingService.get_cache_stats(),
        mapbox=MapboxGeocodingService.get_cache_stats(),
    )


@router.delete("/cache")
async def clear_cache():
    """
    Clear all geocoding caches.

    Clears both Nominatim and Mapbox caches.
    """
    GeocodingService.clear_cache()
    MapboxGeocodingService.clear_cache()
    return {"message": "All geocoding caches cleared"}

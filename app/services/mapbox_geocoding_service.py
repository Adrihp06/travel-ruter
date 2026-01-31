"""
Mapbox Geocoding service using Mapbox Geocoding API v6.
Provides fast location search and coordinate lookup functionality.
"""

import httpx
import time
import hashlib
import uuid
from threading import Lock
from typing import Optional
from pydantic import BaseModel

from app.core.config import settings
from app.services.geocoding_service import GeocodingResult, TTLCache


# Separate cache instances for Mapbox (shared TTL config)
_mapbox_search_cache = TTLCache(
    ttl_seconds=settings.GEOCODING_CACHE_TTL_HOURS * 3600,
    max_size=settings.GEOCODING_CACHE_MAX_SIZE,
)
_mapbox_reverse_cache = TTLCache(
    ttl_seconds=settings.GEOCODING_CACHE_TTL_HOURS * 3600,
    max_size=settings.GEOCODING_CACHE_MAX_SIZE // 2,
)


class MapboxGeocodingService:
    """Service for geocoding operations using Mapbox Geocoding API v6"""

    BASE_URL = "https://api.mapbox.com/search/geocode/v6"

    @classmethod
    def is_available(cls) -> bool:
        """Check if Mapbox geocoding is available (token configured)"""
        return bool(settings.MAPBOX_ACCESS_TOKEN)

    @classmethod
    def _generate_place_id(cls, mapbox_id: str) -> int:
        """Generate a numeric place_id from Mapbox's string ID for compatibility"""
        # Use hash to create consistent numeric ID
        return abs(hash(mapbox_id)) % (10 ** 9)

    @classmethod
    async def search(
        cls,
        query: str,
        limit: int = 5,
        lang: str = "en"
    ) -> list[GeocodingResult]:
        """
        Search for locations matching the query using Mapbox.

        Args:
            query: Search query string
            limit: Maximum number of results (default 5)
            lang: Language for results (default English)

        Returns:
            List of GeocodingResult objects
        """
        if not cls.is_available():
            raise ValueError("Mapbox access token not configured")

        # Check cache first
        cache_key = f"mapbox:search:{query}:{limit}:{lang}"
        cached = _mapbox_search_cache.get(cache_key)
        if cached is not None:
            return cached

        params = {
            "q": query,
            "limit": limit,
            "language": lang,
            "access_token": settings.MAPBOX_ACCESS_TOKEN,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{cls.BASE_URL}/forward",
                params=params,
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        results = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0])

            # Mapbox returns [longitude, latitude]
            longitude, latitude = coords[0], coords[1]

            # Get display name (full_address or name)
            display_name = props.get("full_address") or props.get("name", "Unknown")

            # Get feature type
            feature_type = props.get("feature_type", "unknown")

            # Generate compatible place_id from mapbox_id
            mapbox_id = props.get("mapbox_id", str(uuid.uuid4()))
            place_id = cls._generate_place_id(mapbox_id)

            # Mapbox provides relevance (0-1), convert to importance scale
            relevance = feature.get("properties", {}).get("relevance", 0.5)

            results.append(GeocodingResult(
                place_id=place_id,
                display_name=display_name,
                latitude=latitude,
                longitude=longitude,
                type=feature_type,
                importance=relevance,
            ))

        # Cache the results
        _mapbox_search_cache.set(cache_key, results)
        return results

    @classmethod
    async def reverse_geocode(
        cls,
        latitude: float,
        longitude: float,
        lang: str = "en"
    ) -> Optional[GeocodingResult]:
        """
        Get location name from coordinates using Mapbox.

        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            lang: Language for results (default English)

        Returns:
            GeocodingResult object or None if not found
        """
        if not cls.is_available():
            raise ValueError("Mapbox access token not configured")

        # Round to 4 decimal places for cache key (~11m precision)
        lat_key = round(latitude, 4)
        lon_key = round(longitude, 4)
        cache_key = f"mapbox:reverse:{lat_key}:{lon_key}:{lang}"

        cached = _mapbox_reverse_cache.get(cache_key)
        if cached is not None:
            return cached

        params = {
            "longitude": longitude,
            "latitude": latitude,
            "language": lang,
            "access_token": settings.MAPBOX_ACCESS_TOKEN,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{cls.BASE_URL}/reverse",
                params=params,
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        features = data.get("features", [])
        if not features:
            return None

        # Get the first (most relevant) result
        feature = features[0]
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates", [longitude, latitude])

        display_name = props.get("full_address") or props.get("name", "Unknown")
        feature_type = props.get("feature_type", "unknown")
        mapbox_id = props.get("mapbox_id", str(uuid.uuid4()))
        place_id = cls._generate_place_id(mapbox_id)
        relevance = props.get("relevance", 0.5)

        result = GeocodingResult(
            place_id=place_id,
            display_name=display_name,
            latitude=coords[1],  # Mapbox: [lon, lat]
            longitude=coords[0],
            type=feature_type,
            importance=relevance,
        )

        # Cache the result
        _mapbox_reverse_cache.set(cache_key, result)
        return result

    @classmethod
    def get_cache_stats(cls) -> dict:
        """Get statistics for Mapbox caches"""
        return {
            "search_cache": _mapbox_search_cache.get_stats(),
            "reverse_cache": _mapbox_reverse_cache.get_stats(),
        }

    @classmethod
    def clear_cache(cls) -> None:
        """Clear Mapbox caches"""
        _mapbox_search_cache.clear()
        _mapbox_reverse_cache.clear()

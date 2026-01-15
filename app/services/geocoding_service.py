"""
Geocoding service using OpenStreetMap Nominatim API.
Provides location search and coordinate lookup functionality.
"""

import httpx
from typing import Optional
from pydantic import BaseModel


class GeocodingResult(BaseModel):
    """Schema for a geocoding search result"""
    place_id: int
    display_name: str
    latitude: float
    longitude: float
    type: str
    importance: float


class GeocodingService:
    """Service for geocoding operations using OpenStreetMap Nominatim"""

    BASE_URL = "https://nominatim.openstreetmap.org"
    USER_AGENT = "TravelRuter/1.0"

    @classmethod
    async def search(
        cls,
        query: str,
        limit: int = 5,
        lang: str = "en"
    ) -> list[GeocodingResult]:
        """
        Search for locations matching the query.

        Args:
            query: Search query string
            limit: Maximum number of results (default 5)
            lang: Language for results (default English)

        Returns:
            List of GeocodingResult objects
        """
        params = {
            "q": query,
            "format": "json",
            "limit": limit,
            "addressdetails": 1,
            "accept-language": lang,
        }

        headers = {
            "User-Agent": cls.USER_AGENT,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{cls.BASE_URL}/search",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        results = []
        for item in data:
            results.append(GeocodingResult(
                place_id=item["place_id"],
                display_name=item["display_name"],
                latitude=float(item["lat"]),
                longitude=float(item["lon"]),
                type=item.get("type", "unknown"),
                importance=item.get("importance", 0.0),
            ))

        return results

    @classmethod
    async def reverse_geocode(
        cls,
        latitude: float,
        longitude: float,
        lang: str = "en"
    ) -> Optional[GeocodingResult]:
        """
        Get location name from coordinates.

        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            lang: Language for results (default English)

        Returns:
            GeocodingResult object or None if not found
        """
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "accept-language": lang,
        }

        headers = {
            "User-Agent": cls.USER_AGENT,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{cls.BASE_URL}/reverse",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        if "error" in data:
            return None

        return GeocodingResult(
            place_id=data["place_id"],
            display_name=data["display_name"],
            latitude=float(data["lat"]),
            longitude=float(data["lon"]),
            type=data.get("type", "unknown"),
            importance=data.get("importance", 0.0),
        )

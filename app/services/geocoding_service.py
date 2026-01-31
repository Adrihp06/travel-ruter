"""
Geocoding service using OpenStreetMap Nominatim API.
Provides location search and coordinate lookup functionality with TTL caching.
"""

import httpx
import time
import hashlib
from threading import Lock
from typing import Optional
from pydantic import BaseModel

from app.core.config import settings


class GeocodingResult(BaseModel):
    """Schema for a geocoding search result"""
    place_id: int
    display_name: str
    latitude: float
    longitude: float
    type: str
    importance: float


class TTLCache:
    """Thread-safe TTL cache with max size eviction (LRU-like)"""

    def __init__(self, ttl_seconds: int, max_size: int):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self._cache: dict[str, tuple[float, any]] = {}
        self._lock = Lock()
        self._hits = 0
        self._misses = 0

    def _normalize_key(self, key: str) -> str:
        """Normalize and hash the key for consistent storage"""
        normalized = key.lower().strip()
        return hashlib.md5(normalized.encode()).hexdigest()

    def get(self, key: str) -> Optional[any]:
        """Get value from cache if exists and not expired"""
        normalized_key = self._normalize_key(key)
        with self._lock:
            if normalized_key in self._cache:
                timestamp, value = self._cache[normalized_key]
                if time.time() - timestamp < self.ttl_seconds:
                    self._hits += 1
                    return value
                else:
                    # Expired, remove it
                    del self._cache[normalized_key]
            self._misses += 1
            return None

    def set(self, key: str, value: any) -> None:
        """Set value in cache with current timestamp"""
        normalized_key = self._normalize_key(key)
        with self._lock:
            # Evict oldest entries if at max size
            if len(self._cache) >= self.max_size and normalized_key not in self._cache:
                self._evict_oldest()
            self._cache[normalized_key] = (time.time(), value)

    def _evict_oldest(self) -> None:
        """Remove oldest entry (by timestamp)"""
        if not self._cache:
            return
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][0])
        del self._cache[oldest_key]

    def clear(self) -> None:
        """Clear all entries from cache"""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    def get_stats(self) -> dict:
        """Get cache statistics"""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "ttl_hours": self.ttl_seconds / 3600,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_percent": round(hit_rate, 2),
            }


# Global cache instances
_search_cache = TTLCache(
    ttl_seconds=settings.GEOCODING_CACHE_TTL_HOURS * 3600,
    max_size=settings.GEOCODING_CACHE_MAX_SIZE,
)
_reverse_cache = TTLCache(
    ttl_seconds=settings.GEOCODING_CACHE_TTL_HOURS * 3600,
    max_size=settings.GEOCODING_CACHE_MAX_SIZE // 2,  # 500 for reverse
)


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
        # Check cache first
        cache_key = f"search:{query}:{limit}:{lang}"
        cached = _search_cache.get(cache_key)
        if cached is not None:
            return cached

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

        # Cache the results
        _search_cache.set(cache_key, results)
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
        # Round to 4 decimal places for cache key (~11m precision)
        lat_key = round(latitude, 4)
        lon_key = round(longitude, 4)
        cache_key = f"reverse:{lat_key}:{lon_key}:{lang}"

        cached = _reverse_cache.get(cache_key)
        if cached is not None:
            return cached

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

        result = GeocodingResult(
            place_id=data["place_id"],
            display_name=data["display_name"],
            latitude=float(data["lat"]),
            longitude=float(data["lon"]),
            type=data.get("type", "unknown"),
            importance=data.get("importance", 0.0),
        )

        # Cache the result
        _reverse_cache.set(cache_key, result)
        return result

    @classmethod
    def get_cache_stats(cls) -> dict:
        """Get statistics for both caches"""
        return {
            "search_cache": _search_cache.get_stats(),
            "reverse_cache": _reverse_cache.get_stats(),
        }

    @classmethod
    def clear_cache(cls) -> None:
        """Clear both caches"""
        _search_cache.clear()
        _reverse_cache.clear()

"""
NAVITIME Route (totalnavi) API integration for Japan transit routing via RapidAPI.

Provides real transit routing for JR, Shinkansen, and local train/bus lines in Japan.
API Documentation: https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi

Single-call pattern: GET /route_transit with shape=true returns both route data and
GeoJSON geometry (FeatureCollection with LineString features per section).

Japan-only: Used when both origin and destination are within Japan bounding box.
Free tier: 500 requests/month (Basic plan on RapidAPI).
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field, asdict

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client
from app.core.resilience import (
    with_retry,
    with_circuit_breaker,
    navitime_circuit_breaker,
)
from app.core.cache import get_cached, set_cached, make_cache_key, TTL_ROUTE

logger = logging.getLogger(__name__)

# Japan bounding box
JAPAN_LAT_MIN = 20.0
JAPAN_LAT_MAX = 45.6
JAPAN_LON_MIN = 122.0
JAPAN_LON_MAX = 153.0


@dataclass
class NavitimeRouteResult:
    """Result from NAVITIME Route API."""
    distance_meters: float
    duration_seconds: float
    geometry: dict  # GeoJSON LineString
    transit_details: Optional[dict] = field(default=None)


class NavitimeError(Exception):
    """Custom exception for NAVITIME API errors."""
    pass


class NavitimeService:
    """Service for interacting with NAVITIME Route (totalnavi) API via RapidAPI."""

    BASE_URL = "https://navitime-route-totalnavi.p.rapidapi.com"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "NAVITIME_RAPIDAPI_KEY", None)
        self._has_api_key = bool(self.api_key)

    def is_available(self) -> bool:
        """Check if the service is available (has API key configured)."""
        return self._has_api_key

    @staticmethod
    def is_in_japan(lat: float, lng: float) -> bool:
        """Check if coordinates are within Japan bounding box."""
        return (
            JAPAN_LAT_MIN <= lat <= JAPAN_LAT_MAX
            and JAPAN_LON_MIN <= lng <= JAPAN_LON_MAX
        )

    def _build_headers(self) -> dict:
        return {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": "navitime-route-totalnavi.p.rapidapi.com",
        }

    @staticmethod
    def _extract_geometry(shapes: dict) -> dict:
        """
        Extract a single GeoJSON LineString from a FeatureCollection.

        The API returns shapes as a GeoJSON FeatureCollection with multiple
        LineString features (one per route section). We merge them into a
        single LineString for storage.
        """
        if not isinstance(shapes, dict) or shapes.get("type") != "FeatureCollection":
            return None

        features = shapes.get("features", [])
        all_coords = []

        for feat in features:
            geom = feat.get("geometry", {})
            if geom.get("type") != "LineString":
                continue
            coords = geom.get("coordinates", [])
            if not coords:
                continue
            if all_coords:
                # Skip first point to avoid duplicates at junctions
                all_coords.extend(coords[1:])
            else:
                all_coords.extend(coords)

        if len(all_coords) >= 2:
            return {
                "type": "LineString",
                "coordinates": all_coords,
            }
        return None

    @with_retry(max_attempts=3)
    @with_circuit_breaker(navitime_circuit_breaker)
    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        departure_time: Optional[str] = None,
    ) -> NavitimeRouteResult:
        """
        Get transit route in Japan via NAVITIME.

        Single API call to /route_transit with shape=true returns route data
        and GeoJSON geometry in one response.

        Args:
            origin: (longitude, latitude) tuple for start point
            destination: (longitude, latitude) tuple for end point
            departure_time: Optional departure time (ISO 8601, e.g. "2026-03-01T09:00:00")

        Returns:
            NavitimeRouteResult with distance, duration, geometry, and transit details
        """
        if not self._has_api_key:
            raise NavitimeError(
                "NAVITIME RapidAPI key not configured. "
                "Set NAVITIME_RAPIDAPI_KEY in environment."
            )

        origin_lat, origin_lng = origin[1], origin[0]
        dest_lat, dest_lng = destination[1], destination[0]

        # Cache key
        origin_rounded = (round(origin[0], 4), round(origin[1], 4))
        dest_rounded = (round(destination[0], 4), round(destination[1], 4))
        cache_key = f"navitime_route:{make_cache_key(origin_rounded, dest_rounded)}"

        cached = await get_cached(cache_key)
        if cached:
            return NavitimeRouteResult(**cached)

        # Build params - shape=true to get GeoJSON geometry in same call
        if not departure_time:
            tomorrow = datetime.utcnow() + timedelta(days=1)
            departure_time = tomorrow.replace(hour=9, minute=0, second=0).strftime(
                "%Y-%m-%dT%H:%M:%S"
            )

        params = {
            "start": f"{origin_lat},{origin_lng}",
            "goal": f"{dest_lat},{dest_lng}",
            "start_time": departure_time,
            "shape": "true",
            "limit": "1",
            "unuse": "domestic_flight",
        }

        headers = self._build_headers()
        client = await get_http_client()

        try:
            logger.debug(
                f"NAVITIME route_transit: origin=({origin_lat},{origin_lng}), "
                f"dest=({dest_lat},{dest_lng})"
            )
            resp = await client.get(
                f"{self.BASE_URL}/route_transit",
                headers=headers,
                params=params,
            )
            logger.debug(f"NAVITIME route_transit response: status={resp.status_code}")

            if resp.status_code == 401:
                raise NavitimeError("Invalid NAVITIME RapidAPI key")
            if resp.status_code == 403:
                raise NavitimeError(
                    "NAVITIME API access denied. Check RapidAPI subscription."
                )
            if resp.status_code == 429:
                raise NavitimeError(
                    "NAVITIME API rate limit exceeded (500 req/month free tier)"
                )
            if resp.status_code == 500:
                # NAVITIME returns 500 when no route is found
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                msg = body.get("message", "Internal server error")
                raise NavitimeError(f"No transit route found: {msg}")

            resp.raise_for_status()
            data = resp.json()

            items = data.get("items", [])
            if not items:
                raise NavitimeError(
                    "No transit route found between given points in Japan"
                )

            item = items[0]
            summary = item.get("summary", {}).get("move", {})

            # Distance in meters, time in minutes (per API unit spec)
            distance_meters = float(summary.get("distance", 0))
            duration_minutes = float(summary.get("time", 0))
            duration_seconds = duration_minutes * 60

            # Extract transit details (line names, transfers)
            sections = item.get("sections", [])
            transit_lines = []
            for section in sections:
                if section.get("type") == "move":
                    line_name = section.get("line_name", "")
                    move_type = section.get("move", "")
                    if line_name and move_type != "walk":
                        transit_lines.append(line_name)

            transit_count = int(summary.get("transit_count", 0))
            fare = summary.get("fare", {})

            transit_details = {
                "lines": transit_lines,
                "transfers": transit_count,
                "fare_jpy": fare.get("unit_0"),
                "duration_minutes": int(duration_minutes),
            }

            # Extract GeoJSON geometry from shapes FeatureCollection
            shapes = item.get("shapes")
            geometry = self._extract_geometry(shapes) if shapes else None

            if not geometry:
                # Fallback to straight line
                geometry = {
                    "type": "LineString",
                    "coordinates": [list(origin), list(destination)],
                }
                logger.warning("NAVITIME: no shape data, using straight line")
            else:
                coord_count = len(geometry.get("coordinates", []))
                logger.info(f"NAVITIME: got {coord_count} coordinate points")

            result = NavitimeRouteResult(
                distance_meters=distance_meters,
                duration_seconds=duration_seconds,
                geometry=geometry,
                transit_details=transit_details,
            )

            # Cache the result
            await set_cached(cache_key, asdict(result), ttl=TTL_ROUTE)

            logger.info(
                f"NAVITIME routing successful: {distance_meters / 1000:.1f}km, "
                f"{duration_minutes:.0f}min, lines={transit_lines}"
            )
            return result

        except (NavitimeError, httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError):
            raise
        except Exception as e:
            raise NavitimeError(f"NAVITIME request failed: {str(e)}")


# Singleton instance
_navitime_service: Optional[NavitimeService] = None


def get_navitime_service() -> NavitimeService:
    """Get or create a NAVITIME service instance."""
    global _navitime_service
    if _navitime_service is None:
        _navitime_service = NavitimeService()
    return _navitime_service

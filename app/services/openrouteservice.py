"""
OpenRouteService integration for transit/public transport routing.

OpenRouteService provides real routing data including public transport options.
Free tier: 2,000 requests/day.
Get API key at: https://openrouteservice.org/dev/#/signup
"""
from enum import Enum
from typing import Optional
from dataclasses import dataclass
import httpx

from app.core.config import settings
from app.core.http_client import get_http_client
from app.core.resilience import (
    with_retry,
    with_circuit_breaker,
    openrouteservice_circuit_breaker,
)


class ORSRoutingProfile(str, Enum):
    """OpenRouteService routing profiles."""
    DRIVING_CAR = "driving-car"
    DRIVING_HGV = "driving-hgv"  # Heavy goods vehicle
    CYCLING_REGULAR = "cycling-regular"
    CYCLING_ROAD = "cycling-road"
    CYCLING_MOUNTAIN = "cycling-mountain"
    CYCLING_ELECTRIC = "cycling-electric"
    FOOT_WALKING = "foot-walking"
    FOOT_HIKING = "foot-hiking"
    WHEELCHAIR = "wheelchair"


@dataclass
class ORSRouteResult:
    """Result from OpenRouteService Directions API."""
    distance_meters: float
    duration_seconds: float
    geometry: dict
    segments: list[dict]
    bbox: list[float]


class ORSServiceError(Exception):
    """Custom exception for OpenRouteService API errors."""
    pass


class OpenRouteServiceService:
    """Service for interacting with OpenRouteService Directions API."""

    BASE_URL = "https://api.openrouteservice.org/v2"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'OPENROUTESERVICE_API_KEY', None)
        # Allow service to work without API key - will use fallback
        self._has_api_key = bool(self.api_key)

    @with_retry(max_attempts=3)
    @with_circuit_breaker(openrouteservice_circuit_breaker)
    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        profile: ORSRoutingProfile = ORSRoutingProfile.DRIVING_CAR,
        waypoints: Optional[list[tuple[float, float]]] = None,
    ) -> ORSRouteResult:
        """
        Get route from OpenRouteService Directions API.

        Args:
            origin: (longitude, latitude) tuple for start point
            destination: (longitude, latitude) tuple for end point
            profile: Routing profile (driving-car, foot-walking, cycling-regular, etc.)
            waypoints: Optional list of intermediate (lon, lat) waypoints

        Returns:
            ORSRouteResult with distance, duration, and geometry
        """
        if not self._has_api_key:
            raise ORSServiceError("OpenRouteService API key not configured. Set OPENROUTESERVICE_API_KEY in environment.")

        # Build coordinates list: [origin, ...waypoints, destination]
        coordinates = [list(origin)]
        if waypoints:
            for wp in waypoints:
                coordinates.append(list(wp))
        coordinates.append(list(destination))

        url = f"{self.BASE_URL}/directions/{profile.value}"

        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
        }

        body = {
            "coordinates": coordinates,
            "format": "geojson",
        }

        try:
            client = await get_http_client()
            response = await client.post(url, headers=headers, json=body)

            if response.status_code == 401:
                raise ORSServiceError("Invalid OpenRouteService API key")
            if response.status_code == 403:
                raise ORSServiceError("OpenRouteService API rate limit exceeded or access denied")
            if response.status_code == 404:
                raise ORSServiceError("Route not found between given points")

            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])
            if not features:
                raise ORSServiceError("No route found")

            route = features[0]
            properties = route.get("properties", {})
            summary = properties.get("summary", {})

            return ORSRouteResult(
                distance_meters=summary.get("distance", 0),
                duration_seconds=summary.get("duration", 0),
                geometry=route.get("geometry", {}),
                segments=properties.get("segments", []),
                bbox=data.get("bbox", []),
            )

        except httpx.TimeoutException:
            raise ORSServiceError("OpenRouteService API request timed out")
        except httpx.HTTPStatusError as e:
            raise ORSServiceError(f"OpenRouteService API HTTP error: {e.response.status_code}")
        except httpx.RequestError as e:
            raise ORSServiceError(f"OpenRouteService API request failed: {str(e)}")

    async def get_multi_waypoint_route(
        self,
        waypoints: list[tuple[float, float]],
        profile: ORSRoutingProfile = ORSRoutingProfile.FOOT_WALKING,
    ) -> ORSRouteResult:
        """
        Get route through multiple waypoints.

        Args:
            waypoints: List of (longitude, latitude) tuples in order
            profile: Routing profile

        Returns:
            ORSRouteResult with total distance, duration, and full geometry
        """
        if len(waypoints) < 2:
            raise ORSServiceError("At least 2 waypoints are required")

        origin = waypoints[0]
        destination = waypoints[-1]
        intermediate = waypoints[1:-1] if len(waypoints) > 2 else None

        return await self.get_route(
            origin=origin,
            destination=destination,
            profile=profile,
            waypoints=intermediate,
        )

    def is_available(self) -> bool:
        """Check if the service is available (has API key configured)."""
        return self._has_api_key


# Singleton instance for convenience
_ors_service: Optional[OpenRouteServiceService] = None


def get_ors_service() -> OpenRouteServiceService:
    """Get or create an OpenRouteService service instance."""
    global _ors_service
    if _ors_service is None:
        _ors_service = OpenRouteServiceService()
    return _ors_service

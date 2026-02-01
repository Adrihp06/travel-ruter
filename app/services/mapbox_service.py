from enum import Enum
from typing import Optional
from dataclasses import dataclass
import httpx

from app.core.config import settings
from app.core.resilience import (
    with_retry,
    with_circuit_breaker,
    mapbox_circuit_breaker,
    CircuitBreakerOpen,
)


class MapboxRoutingProfile(str, Enum):
    """Mapbox routing profiles for different transportation modes."""
    DRIVING = "driving"
    DRIVING_TRAFFIC = "driving-traffic"
    WALKING = "walking"
    CYCLING = "cycling"


@dataclass
class MapboxRouteResult:
    """Result from Mapbox Directions API."""
    distance_meters: float
    duration_seconds: float
    geometry: dict
    waypoints: list[dict]


class MapboxServiceError(Exception):
    """Custom exception for Mapbox API errors."""
    pass


class MapboxService:
    """Service for interacting with Mapbox Directions API."""

    BASE_URL = "https://api.mapbox.com/directions/v5/mapbox"

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or getattr(settings, 'MAPBOX_ACCESS_TOKEN', None)
        self._has_access_token = bool(self.access_token)

    def is_available(self) -> bool:
        """Check if the service is available (has access token configured)."""
        return self._has_access_token

    @with_retry(max_attempts=3)
    @with_circuit_breaker(mapbox_circuit_breaker)
    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        profile: MapboxRoutingProfile = MapboxRoutingProfile.DRIVING,
        waypoints: Optional[list[tuple[float, float]]] = None,
        alternatives: bool = False,
        geometries: str = "geojson",
        overview: str = "full",
        steps: bool = False,
    ) -> MapboxRouteResult:
        """
        Get route from Mapbox Directions API.

        Args:
            origin: (longitude, latitude) tuple for start point
            destination: (longitude, latitude) tuple for end point
            profile: Routing profile (driving, walking, cycling, driving-traffic)
            waypoints: Optional list of intermediate (lon, lat) waypoints
            alternatives: Whether to return alternative routes
            geometries: Geometry format (geojson, polyline, polyline6)
            overview: Level of detail (full, simplified, false)
            steps: Whether to include turn-by-turn instructions

        Returns:
            MapboxRouteResult with distance, duration, and geometry
        """
        if not self._has_access_token:
            raise MapboxServiceError("Mapbox access token is not configured")

        # Build coordinates string: origin;waypoints;destination
        coords = [f"{origin[0]},{origin[1]}"]
        if waypoints:
            for wp in waypoints:
                coords.append(f"{wp[0]},{wp[1]}")
        coords.append(f"{destination[0]},{destination[1]}")
        coordinates = ";".join(coords)

        url = f"{self.BASE_URL}/{profile.value}/{coordinates}"

        params = {
            "access_token": self.access_token,
            "alternatives": str(alternatives).lower(),
            "geometries": geometries,
            "overview": overview,
            "steps": str(steps).lower(),
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)

                if response.status_code == 401:
                    raise MapboxServiceError("Invalid Mapbox access token")
                if response.status_code == 422:
                    raise MapboxServiceError("Invalid coordinates or parameters")

                response.raise_for_status()
                data = response.json()

                if data.get("code") != "Ok":
                    error_msg = data.get("message", "Unknown Mapbox API error")
                    raise MapboxServiceError(f"Mapbox API error: {error_msg}")

                routes = data.get("routes", [])
                if not routes:
                    raise MapboxServiceError("No routes found")

                # Return the first (best) route
                route = routes[0]

                return MapboxRouteResult(
                    distance_meters=route["distance"],
                    duration_seconds=route["duration"],
                    geometry=route["geometry"],
                    waypoints=data.get("waypoints", []),
                )

        except httpx.TimeoutException:
            raise MapboxServiceError("Mapbox API request timed out")
        except httpx.HTTPStatusError as e:
            raise MapboxServiceError(f"Mapbox API HTTP error: {e.response.status_code}")
        except httpx.RequestError as e:
            raise MapboxServiceError(f"Mapbox API request failed: {str(e)}")

    async def get_multi_waypoint_route(
        self,
        waypoints: list[tuple[float, float]],
        profile: MapboxRoutingProfile = MapboxRoutingProfile.WALKING,
    ) -> MapboxRouteResult:
        """
        Get route through multiple waypoints.

        Args:
            waypoints: List of (longitude, latitude) tuples in order
            profile: Routing profile

        Returns:
            MapboxRouteResult with total distance, duration, and full geometry
        """
        if len(waypoints) < 2:
            raise MapboxServiceError("At least 2 waypoints are required")

        origin = waypoints[0]
        destination = waypoints[-1]
        intermediate = waypoints[1:-1] if len(waypoints) > 2 else None

        return await self.get_route(
            origin=origin,
            destination=destination,
            profile=profile,
            waypoints=intermediate,
            overview="full",
            geometries="geojson",
        )


# Singleton instance for convenience
_mapbox_service: Optional[MapboxService] = None


def get_mapbox_service() -> MapboxService:
    """Get or create a Mapbox service instance."""
    global _mapbox_service
    if _mapbox_service is None:
        _mapbox_service = MapboxService()
    return _mapbox_service

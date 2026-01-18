"""
Google Maps Routes API integration for routing with real transit/public transport support.

Google Maps Routes API provides actual transit routing for trains, buses, and other public transport.
API Documentation: https://developers.google.com/maps/documentation/routes
"""
from enum import Enum
from typing import Optional
from dataclasses import dataclass
import httpx
import base64

from app.core.config import settings


class GoogleMapsRouteTravelMode(str, Enum):
    """Google Maps Routes API travel modes."""
    DRIVE = "DRIVE"
    WALK = "WALK"
    BICYCLE = "BICYCLE"
    TRANSIT = "TRANSIT"
    TWO_WHEELER = "TWO_WHEELER"


@dataclass
class GoogleMapsRouteResult:
    """Result from Google Maps Routes API."""
    distance_meters: float
    duration_seconds: float
    geometry: dict  # GeoJSON LineString
    polyline: str  # Encoded polyline
    transit_details: Optional[dict] = None  # Transit-specific details (stops, lines, etc.)


class GoogleMapsRoutesError(Exception):
    """Custom exception for Google Maps Routes API errors."""
    pass


def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """
    Decode a Google Maps encoded polyline string into a list of (lon, lat) coordinates.

    Based on the algorithm described at:
    https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    """
    coordinates = []
    index = 0
    lat = 0
    lng = 0

    while index < len(encoded):
        # Decode latitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if result & 1 else result >> 1
        lat += dlat

        # Decode longitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if result & 1 else result >> 1
        lng += dlng

        # Convert to actual coordinates (lon, lat for GeoJSON)
        coordinates.append((lng / 1e5, lat / 1e5))

    return coordinates


class GoogleMapsRoutesService:
    """Service for interacting with Google Maps Routes API."""

    BASE_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'GOOGLE_MAPS_API_KEY', None)
        self._has_api_key = bool(self.api_key)

    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        travel_mode: GoogleMapsRouteTravelMode = GoogleMapsRouteTravelMode.DRIVE,
        waypoints: Optional[list[tuple[float, float]]] = None,
        departure_time: Optional[str] = None,
    ) -> GoogleMapsRouteResult:
        """
        Get route from Google Maps Routes API.

        Args:
            origin: (longitude, latitude) tuple for start point
            destination: (longitude, latitude) tuple for end point
            travel_mode: Travel mode (DRIVE, WALK, BICYCLE, TRANSIT)
            waypoints: Optional list of intermediate (lon, lat) waypoints
            departure_time: Optional departure time in RFC3339 format for transit

        Returns:
            GoogleMapsRouteResult with distance, duration, and geometry
        """
        if not self._has_api_key:
            raise GoogleMapsRoutesError(
                "Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY in environment."
            )

        # Build request body
        body = {
            "origin": {
                "location": {
                    "latLng": {
                        "latitude": origin[1],  # origin is (lon, lat)
                        "longitude": origin[0],
                    }
                }
            },
            "destination": {
                "location": {
                    "latLng": {
                        "latitude": destination[1],
                        "longitude": destination[0],
                    }
                }
            },
            "travelMode": travel_mode.value,
            "computeAlternativeRoutes": False,
            "routeModifiers": {
                "avoidTolls": False,
                "avoidHighways": False,
                "avoidFerries": False,
            },
        }

        # Add waypoints if provided
        if waypoints:
            body["intermediates"] = [
                {
                    "location": {
                        "latLng": {
                            "latitude": wp[1],
                            "longitude": wp[0],
                        }
                    }
                }
                for wp in waypoints
            ]

        # Add departure time for transit
        if departure_time and travel_mode == GoogleMapsRouteTravelMode.TRANSIT:
            body["departureTime"] = departure_time

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.transitDetails",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.BASE_URL, headers=headers, json=body)

                if response.status_code == 400:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Bad request")
                    raise GoogleMapsRoutesError(f"Invalid request: {error_msg}")
                if response.status_code == 401:
                    raise GoogleMapsRoutesError("Invalid Google Maps API key")
                if response.status_code == 403:
                    raise GoogleMapsRoutesError(
                        "Google Maps API access denied. Check API key permissions and billing."
                    )
                if response.status_code == 429:
                    raise GoogleMapsRoutesError("Google Maps API rate limit exceeded")

                response.raise_for_status()
                data = response.json()

                routes = data.get("routes", [])
                if not routes:
                    raise GoogleMapsRoutesError("No route found between given points")

                route = routes[0]

                # Parse duration (format: "1234s")
                duration_str = route.get("duration", "0s")
                duration_seconds = float(duration_str.rstrip("s"))

                # Get distance
                distance_meters = float(route.get("distanceMeters", 0))

                # Get encoded polyline
                encoded_polyline = route.get("polyline", {}).get("encodedPolyline", "")

                # Decode polyline to GeoJSON
                if encoded_polyline:
                    coordinates = decode_polyline(encoded_polyline)
                    geometry = {
                        "type": "LineString",
                        "coordinates": coordinates,
                    }
                else:
                    # Fallback to straight line
                    geometry = {
                        "type": "LineString",
                        "coordinates": [list(origin), list(destination)],
                    }

                # Extract transit details if available
                transit_details = None
                if travel_mode == GoogleMapsRouteTravelMode.TRANSIT:
                    legs = route.get("legs", [])
                    if legs:
                        steps_with_transit = []
                        for leg in legs:
                            for step in leg.get("steps", []):
                                if "transitDetails" in step:
                                    steps_with_transit.append(step["transitDetails"])
                        if steps_with_transit:
                            transit_details = {"steps": steps_with_transit}

                return GoogleMapsRouteResult(
                    distance_meters=distance_meters,
                    duration_seconds=duration_seconds,
                    geometry=geometry,
                    polyline=encoded_polyline,
                    transit_details=transit_details,
                )

        except httpx.TimeoutException:
            raise GoogleMapsRoutesError("Google Maps Routes API request timed out")
        except httpx.HTTPStatusError as e:
            raise GoogleMapsRoutesError(f"Google Maps Routes API HTTP error: {e.response.status_code}")
        except httpx.RequestError as e:
            raise GoogleMapsRoutesError(f"Google Maps Routes API request failed: {str(e)}")

    async def get_transit_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        departure_time: Optional[str] = None,
    ) -> GoogleMapsRouteResult:
        """
        Get transit (public transport) route.

        Args:
            origin: (longitude, latitude) tuple for start point
            destination: (longitude, latitude) tuple for end point
            departure_time: Optional departure time in RFC3339 format

        Returns:
            GoogleMapsRouteResult with transit-specific geometry and details
        """
        return await self.get_route(
            origin=origin,
            destination=destination,
            travel_mode=GoogleMapsRouteTravelMode.TRANSIT,
            departure_time=departure_time,
        )

    async def get_multi_waypoint_route(
        self,
        waypoints: list[tuple[float, float]],
        travel_mode: GoogleMapsRouteTravelMode = GoogleMapsRouteTravelMode.DRIVE,
    ) -> GoogleMapsRouteResult:
        """
        Get route through multiple waypoints.

        Args:
            waypoints: List of (longitude, latitude) tuples in order
            travel_mode: Travel mode

        Returns:
            GoogleMapsRouteResult with total distance, duration, and full geometry
        """
        if len(waypoints) < 2:
            raise GoogleMapsRoutesError("At least 2 waypoints are required")

        origin = waypoints[0]
        destination = waypoints[-1]
        intermediate = waypoints[1:-1] if len(waypoints) > 2 else None

        return await self.get_route(
            origin=origin,
            destination=destination,
            travel_mode=travel_mode,
            waypoints=intermediate,
        )

    def is_available(self) -> bool:
        """Check if the service is available (has API key configured)."""
        return self._has_api_key


# Singleton instance for convenience
_google_maps_routes_service: Optional[GoogleMapsRoutesService] = None


def get_google_maps_routes_service() -> GoogleMapsRoutesService:
    """Get or create a Google Maps Routes service instance."""
    global _google_maps_routes_service
    if _google_maps_routes_service is None:
        _google_maps_routes_service = GoogleMapsRoutesService()
    return _google_maps_routes_service

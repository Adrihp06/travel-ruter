from typing import List, Optional
from urllib.parse import urlencode
from app.schemas.google_maps import (
    GoogleMapsCoordinate,
    GoogleMapsTravelMode,
    GoogleMapsExportRequest,
    GoogleMapsExportResponse,
)


class GoogleMapsService:
    """Service for generating Google Maps export URLs"""

    GOOGLE_MAPS_DIRECTIONS_BASE = "https://www.google.com/maps/dir/"

    @staticmethod
    def generate_directions_url(
        origin: GoogleMapsCoordinate,
        destination: GoogleMapsCoordinate,
        waypoints: Optional[List[GoogleMapsCoordinate]] = None,
        travel_mode: GoogleMapsTravelMode = GoogleMapsTravelMode.DRIVING,
    ) -> str:
        """
        Generate a Google Maps directions URL.

        Format: https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={lat},{lng}&waypoints={lat},{lng}|{lat},{lng}...&travelmode={mode}
        """
        params = {
            "api": "1",
            "origin": f"{origin.lat},{origin.lng}",
            "destination": f"{destination.lat},{destination.lng}",
            "travelmode": travel_mode.value,
        }

        if waypoints and len(waypoints) > 0:
            waypoints_str = "|".join(
                f"{wp.lat},{wp.lng}" for wp in waypoints
            )
            params["waypoints"] = waypoints_str

        return f"{GoogleMapsService.GOOGLE_MAPS_DIRECTIONS_BASE}?{urlencode(params)}"

    @staticmethod
    def export_route(request: GoogleMapsExportRequest) -> GoogleMapsExportResponse:
        """
        Export a route to Google Maps URL.

        Supports both inter-city routes (origin to destination) and
        intra-city routes (with multiple waypoints).
        """
        url = GoogleMapsService.generate_directions_url(
            origin=request.origin,
            destination=request.destination,
            waypoints=request.waypoints,
            travel_mode=request.travel_mode,
        )

        return GoogleMapsExportResponse(
            url=url,
            origin=request.origin,
            destination=request.destination,
            waypoints_count=len(request.waypoints) if request.waypoints else 0,
            travel_mode=request.travel_mode,
        )

    @staticmethod
    def generate_url_from_coordinates(
        coordinates: List[tuple],
        travel_mode: str = "driving",
    ) -> str:
        """
        Convenience method to generate URL from a list of (lat, lng) tuples.

        First coordinate is origin, last is destination, middle ones are waypoints.
        """
        if len(coordinates) < 2:
            raise ValueError("At least 2 coordinates required (origin and destination)")

        origin = GoogleMapsCoordinate(lat=coordinates[0][0], lng=coordinates[0][1])
        destination = GoogleMapsCoordinate(
            lat=coordinates[-1][0], lng=coordinates[-1][1]
        )

        waypoints = None
        if len(coordinates) > 2:
            waypoints = [
                GoogleMapsCoordinate(lat=coord[0], lng=coord[1])
                for coord in coordinates[1:-1]
            ]

        mode = GoogleMapsTravelMode(travel_mode)

        return GoogleMapsService.generate_directions_url(
            origin=origin,
            destination=destination,
            waypoints=waypoints,
            travel_mode=mode,
        )

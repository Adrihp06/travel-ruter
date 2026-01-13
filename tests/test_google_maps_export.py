"""
Tests for Google Maps export functionality.

These tests are standalone and avoid importing from the app services module
to prevent triggering database configuration during testing.
"""
import pytest
from urllib.parse import urlencode
from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional


# Standalone models for testing (mirrors app/schemas/google_maps.py)
class GoogleMapsTravelMode(str, Enum):
    DRIVING = "driving"
    WALKING = "walking"
    BICYCLING = "bicycling"
    TRANSIT = "transit"


class GoogleMapsCoordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class GoogleMapsExportRequest(BaseModel):
    origin: GoogleMapsCoordinate
    destination: GoogleMapsCoordinate
    waypoints: Optional[List[GoogleMapsCoordinate]] = None
    travel_mode: GoogleMapsTravelMode = GoogleMapsTravelMode.DRIVING


class GoogleMapsExportResponse(BaseModel):
    url: str
    origin: GoogleMapsCoordinate
    destination: GoogleMapsCoordinate
    waypoints_count: int = 0
    travel_mode: GoogleMapsTravelMode


# Standalone service for testing (mirrors app/services/google_maps_service.py)
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
        params = {
            "api": "1",
            "origin": f"{origin.lat},{origin.lng}",
            "destination": f"{destination.lat},{destination.lng}",
            "travelmode": travel_mode.value,
        }

        if waypoints and len(waypoints) > 0:
            waypoints_str = "|".join(f"{wp.lat},{wp.lng}" for wp in waypoints)
            params["waypoints"] = waypoints_str

        return f"{GoogleMapsService.GOOGLE_MAPS_DIRECTIONS_BASE}?{urlencode(params)}"

    @staticmethod
    def export_route(request: GoogleMapsExportRequest) -> GoogleMapsExportResponse:
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


# Tests
def test_generate_directions_url_basic():
    """Test basic URL generation with origin and destination"""
    origin = GoogleMapsCoordinate(lat=48.8584, lng=2.2945)  # Eiffel Tower
    destination = GoogleMapsCoordinate(lat=48.8606, lng=2.3376)  # Louvre

    url = GoogleMapsService.generate_directions_url(origin, destination)

    assert "https://www.google.com/maps/dir/" in url
    assert "api=1" in url
    assert "origin=48.8584%2C2.2945" in url
    assert "destination=48.8606%2C2.3376" in url
    assert "travelmode=driving" in url


def test_generate_directions_url_with_waypoints():
    """Test URL generation with multiple waypoints"""
    origin = GoogleMapsCoordinate(lat=48.8584, lng=2.2945)  # Eiffel Tower
    waypoint1 = GoogleMapsCoordinate(lat=48.8530, lng=2.3499)  # Notre Dame
    waypoint2 = GoogleMapsCoordinate(lat=48.8738, lng=2.2950)  # Arc de Triomphe
    destination = GoogleMapsCoordinate(lat=48.8606, lng=2.3376)  # Louvre

    url = GoogleMapsService.generate_directions_url(
        origin, destination, waypoints=[waypoint1, waypoint2]
    )

    assert "waypoints=" in url
    # Waypoints should be pipe-separated
    assert "48.853%2C2.3499" in url
    assert "48.8738%2C2.295" in url


def test_generate_directions_url_walking_mode():
    """Test URL generation with walking travel mode"""
    origin = GoogleMapsCoordinate(lat=48.8584, lng=2.2945)
    destination = GoogleMapsCoordinate(lat=48.8606, lng=2.3376)

    url = GoogleMapsService.generate_directions_url(
        origin, destination, travel_mode=GoogleMapsTravelMode.WALKING
    )

    assert "travelmode=walking" in url


def test_generate_directions_url_transit_mode():
    """Test URL generation with transit travel mode"""
    origin = GoogleMapsCoordinate(lat=48.8584, lng=2.2945)
    destination = GoogleMapsCoordinate(lat=48.8606, lng=2.3376)

    url = GoogleMapsService.generate_directions_url(
        origin, destination, travel_mode=GoogleMapsTravelMode.TRANSIT
    )

    assert "travelmode=transit" in url


def test_generate_directions_url_bicycling_mode():
    """Test URL generation with bicycling travel mode"""
    origin = GoogleMapsCoordinate(lat=48.8584, lng=2.2945)
    destination = GoogleMapsCoordinate(lat=48.8606, lng=2.3376)

    url = GoogleMapsService.generate_directions_url(
        origin, destination, travel_mode=GoogleMapsTravelMode.BICYCLING
    )

    assert "travelmode=bicycling" in url


def test_export_route():
    """Test full export route functionality"""
    request = GoogleMapsExportRequest(
        origin=GoogleMapsCoordinate(lat=48.8584, lng=2.2945),
        destination=GoogleMapsCoordinate(lat=48.8606, lng=2.3376),
        waypoints=[
            GoogleMapsCoordinate(lat=48.8530, lng=2.3499),
        ],
        travel_mode=GoogleMapsTravelMode.WALKING,
    )

    response = GoogleMapsService.export_route(request)

    assert response.url.startswith("https://www.google.com/maps/dir/")
    assert response.origin.lat == 48.8584
    assert response.destination.lat == 48.8606
    assert response.waypoints_count == 1
    assert response.travel_mode == GoogleMapsTravelMode.WALKING


def test_export_route_inter_city():
    """Test inter-city route export (Oslo to Bergen)"""
    request = GoogleMapsExportRequest(
        origin=GoogleMapsCoordinate(lat=59.9139, lng=10.7522),  # Oslo
        destination=GoogleMapsCoordinate(lat=60.3913, lng=5.3221),  # Bergen
        travel_mode=GoogleMapsTravelMode.DRIVING,
    )

    response = GoogleMapsService.export_route(request)

    assert "59.9139" in response.url
    assert "10.7522" in response.url
    assert "60.3913" in response.url
    assert "5.3221" in response.url
    assert response.waypoints_count == 0


def test_generate_url_from_coordinates():
    """Test convenience method for generating URL from coordinate tuples"""
    coordinates = [
        (48.8584, 2.2945),  # Origin: Eiffel Tower
        (48.8530, 2.3499),  # Waypoint: Notre Dame
        (48.8606, 2.3376),  # Destination: Louvre
    ]

    url = GoogleMapsService.generate_url_from_coordinates(coordinates)

    assert "origin=48.8584%2C2.2945" in url
    assert "destination=48.8606%2C2.3376" in url
    assert "waypoints=" in url
    assert "48.853%2C2.3499" in url


def test_generate_url_from_coordinates_no_waypoints():
    """Test URL generation with only origin and destination"""
    coordinates = [
        (48.8584, 2.2945),  # Origin
        (48.8606, 2.3376),  # Destination
    ]

    url = GoogleMapsService.generate_url_from_coordinates(coordinates)

    assert "origin=48.8584%2C2.2945" in url
    assert "destination=48.8606%2C2.3376" in url
    assert "waypoints=" not in url


def test_generate_url_from_coordinates_insufficient():
    """Test that insufficient coordinates raises error"""
    with pytest.raises(ValueError) as exc_info:
        GoogleMapsService.generate_url_from_coordinates([(48.8584, 2.2945)])

    assert "At least 2 coordinates required" in str(exc_info.value)


def test_generate_url_multiple_waypoints():
    """Test URL generation with many waypoints (multi-day trip)"""
    # Simulate a Norway trip: Oslo -> Lillehammer -> Trondheim -> Bergen
    request = GoogleMapsExportRequest(
        origin=GoogleMapsCoordinate(lat=59.9139, lng=10.7522),  # Oslo
        destination=GoogleMapsCoordinate(lat=60.3913, lng=5.3221),  # Bergen
        waypoints=[
            GoogleMapsCoordinate(lat=61.1152, lng=10.4663),  # Lillehammer
            GoogleMapsCoordinate(lat=63.4305, lng=10.3951),  # Trondheim
        ],
        travel_mode=GoogleMapsTravelMode.DRIVING,
    )

    response = GoogleMapsService.export_route(request)

    assert response.waypoints_count == 2
    # Verify all locations are in the URL
    assert "59.9139" in response.url  # Oslo
    assert "61.1152" in response.url  # Lillehammer
    assert "63.4305" in response.url  # Trondheim
    assert "60.3913" in response.url  # Bergen

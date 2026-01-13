"""
Unit tests for Mapbox service with comprehensive mocking.
Tests all Mapbox API integration scenarios including error handling.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from app.services.mapbox_service import (
    MapboxService,
    MapboxServiceError,
    MapboxRoutingProfile,
    MapboxRouteResult,
)


class TestMapboxServiceInit:
    """Tests for MapboxService initialization."""

    def test_init_with_token(self):
        """Test initialization with explicit token."""
        service = MapboxService(access_token="test_token")
        assert service.access_token == "test_token"

    def test_init_from_settings(self):
        """Test initialization from settings."""
        with patch("app.services.mapbox_service.settings") as mock_settings:
            mock_settings.MAPBOX_ACCESS_TOKEN = "settings_token"
            service = MapboxService()
            assert service.access_token == "settings_token"

    def test_init_no_token_raises_error(self):
        """Test that missing token raises error."""
        with patch("app.services.mapbox_service.settings") as mock_settings:
            mock_settings.MAPBOX_ACCESS_TOKEN = None
            with pytest.raises(MapboxServiceError) as exc_info:
                MapboxService()
            assert "not configured" in str(exc_info.value)


class TestMapboxRoutingProfiles:
    """Tests for MapboxRoutingProfile enum."""

    def test_driving_profile(self):
        """Test driving profile value."""
        assert MapboxRoutingProfile.DRIVING.value == "driving"

    def test_driving_traffic_profile(self):
        """Test driving-traffic profile value."""
        assert MapboxRoutingProfile.DRIVING_TRAFFIC.value == "driving-traffic"

    def test_walking_profile(self):
        """Test walking profile value."""
        assert MapboxRoutingProfile.WALKING.value == "walking"

    def test_cycling_profile(self):
        """Test cycling profile value."""
        assert MapboxRoutingProfile.CYCLING.value == "cycling"


class TestMapboxGetRoute:
    """Tests for MapboxService.get_route method."""

    @pytest.fixture
    def mock_successful_response(self) -> dict:
        """Return a successful Mapbox API response."""
        return {
            "code": "Ok",
            "routes": [
                {
                    "distance": 5432.1,
                    "duration": 789.5,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [2.3522, 48.8566],
                            [2.3000, 48.8600],
                            [2.2945, 48.8584]
                        ]
                    }
                }
            ],
            "waypoints": [
                {"name": "Paris Center", "location": [2.3522, 48.8566]},
                {"name": "Eiffel Tower", "location": [2.2945, 48.8584]}
            ]
        }

    @pytest.mark.asyncio
    async def test_get_route_success(self, mock_successful_response: dict):
        """Test successful route retrieval."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_successful_response
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")
            result = await service.get_route(
                origin=(2.3522, 48.8566),
                destination=(2.2945, 48.8584),
                profile=MapboxRoutingProfile.WALKING
            )

            assert isinstance(result, MapboxRouteResult)
            assert result.distance_meters == 5432.1
            assert result.duration_seconds == 789.5
            assert result.geometry["type"] == "LineString"
            assert len(result.waypoints) == 2

    @pytest.mark.asyncio
    async def test_get_route_with_waypoints(self, mock_successful_response: dict):
        """Test route with intermediate waypoints."""
        mock_successful_response["waypoints"].insert(
            1, {"name": "Intermediate", "location": [2.32, 48.86]}
        )

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_successful_response
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")
            result = await service.get_route(
                origin=(2.3522, 48.8566),
                destination=(2.2945, 48.8584),
                waypoints=[(2.32, 48.86)],
                profile=MapboxRoutingProfile.DRIVING
            )

            # Verify waypoints were included in request
            mock_client_instance.get.assert_called_once()
            call_args = mock_client_instance.get.call_args
            url = call_args[0][0]
            assert "2.32,48.86" in url

    @pytest.mark.asyncio
    async def test_get_route_all_profiles(self, mock_successful_response: dict):
        """Test route request with all profiles."""
        profiles = [
            MapboxRoutingProfile.DRIVING,
            MapboxRoutingProfile.DRIVING_TRAFFIC,
            MapboxRoutingProfile.WALKING,
            MapboxRoutingProfile.CYCLING
        ]

        for profile in profiles:
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_successful_response
                mock_response.raise_for_status = MagicMock()

                mock_client_instance = AsyncMock()
                mock_client_instance.get = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                mock_client.return_value = mock_client_instance

                service = MapboxService(access_token="test_token")
                result = await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86),
                    profile=profile
                )

                assert result is not None
                # Verify profile was in URL
                call_args = mock_client_instance.get.call_args
                url = call_args[0][0]
                assert profile.value in url

    @pytest.mark.asyncio
    async def test_get_route_invalid_token(self):
        """Test 401 error for invalid token."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 401

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="invalid_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86)
                )

            assert "Invalid" in str(exc_info.value) or "token" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_route_invalid_coordinates(self):
        """Test 422 error for invalid coordinates."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 422

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(999.0, 999.0),  # Invalid coordinates
                    destination=(2.29, 48.86)
                )

            assert "Invalid" in str(exc_info.value) or "coordinates" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_route_timeout(self):
        """Test timeout handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86)
                )

            assert "timed out" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_route_request_error(self):
        """Test generic request error handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86)
                )

            assert "failed" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_route_api_error_response(self):
        """Test API error in response body."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "code": "NoRoute",
                "message": "No route found between coordinates"
            }
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86)
                )

            assert "No route found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_route_no_routes_in_response(self):
        """Test handling when no routes returned."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "code": "Ok",
                "routes": [],
                "waypoints": []
            }
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86)
                )

            assert "No routes found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_route_http_status_error(self):
        """Test HTTP status error handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 500

            def raise_for_status():
                raise httpx.HTTPStatusError(
                    "Server Error",
                    request=MagicMock(),
                    response=mock_response
                )

            mock_response.raise_for_status = raise_for_status

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")

            with pytest.raises(MapboxServiceError) as exc_info:
                await service.get_route(
                    origin=(2.35, 48.85),
                    destination=(2.29, 48.86)
                )

            assert "500" in str(exc_info.value) or "HTTP" in str(exc_info.value)


class TestMapboxMultiWaypointRoute:
    """Tests for MapboxService.get_multi_waypoint_route method."""

    @pytest.mark.asyncio
    async def test_get_multi_waypoint_route_success(self, mock_mapbox_response: dict):
        """Test successful multi-waypoint route."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_mapbox_response
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")
            result = await service.get_multi_waypoint_route(
                waypoints=[
                    (2.35, 48.85),
                    (2.32, 48.86),
                    (2.29, 48.87)
                ],
                profile=MapboxRoutingProfile.WALKING
            )

            assert isinstance(result, MapboxRouteResult)
            assert result.distance_meters > 0

    @pytest.mark.asyncio
    async def test_get_multi_waypoint_route_minimum_waypoints(self):
        """Test that at least 2 waypoints are required."""
        service = MapboxService(access_token="test_token")

        with pytest.raises(MapboxServiceError) as exc_info:
            await service.get_multi_waypoint_route(
                waypoints=[(2.35, 48.85)],  # Only 1 waypoint
                profile=MapboxRoutingProfile.WALKING
            )

        assert "2 waypoints" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_multi_waypoint_route_two_waypoints(self, mock_mapbox_response: dict):
        """Test route with exactly 2 waypoints."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_mapbox_response
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")
            result = await service.get_multi_waypoint_route(
                waypoints=[
                    (2.35, 48.85),
                    (2.29, 48.87)
                ],
                profile=MapboxRoutingProfile.CYCLING
            )

            assert result is not None

    @pytest.mark.asyncio
    async def test_get_multi_waypoint_route_many_waypoints(self, mock_mapbox_response: dict):
        """Test route with many waypoints."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_mapbox_response
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            service = MapboxService(access_token="test_token")
            result = await service.get_multi_waypoint_route(
                waypoints=[
                    (2.35, 48.85),
                    (2.34, 48.86),
                    (2.33, 48.87),
                    (2.32, 48.88),
                    (2.31, 48.89),
                    (2.30, 48.90)
                ],
                profile=MapboxRoutingProfile.DRIVING
            )

            assert result is not None


class TestMapboxSingleton:
    """Tests for get_mapbox_service singleton function."""

    def test_get_mapbox_service(self):
        """Test singleton creation."""
        from app.services.mapbox_service import get_mapbox_service, _mapbox_service
        import app.services.mapbox_service as mapbox_module

        # Reset singleton
        mapbox_module._mapbox_service = None

        with patch("app.services.mapbox_service.settings") as mock_settings:
            mock_settings.MAPBOX_ACCESS_TOKEN = "singleton_token"

            service1 = get_mapbox_service()
            service2 = get_mapbox_service()

            assert service1 is service2  # Same instance


class TestMapboxRouteResult:
    """Tests for MapboxRouteResult dataclass."""

    def test_route_result_creation(self):
        """Test creating a MapboxRouteResult."""
        result = MapboxRouteResult(
            distance_meters=1234.5,
            duration_seconds=567.8,
            geometry={"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
            waypoints=[{"name": "A", "location": [0, 0]}]
        )

        assert result.distance_meters == 1234.5
        assert result.duration_seconds == 567.8
        assert result.geometry["type"] == "LineString"
        assert len(result.waypoints) == 1

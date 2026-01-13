"""
Integration tests for Routes API endpoints.
Tests inter-city routing, intra-city routing, and Mapbox integration.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestInterCityRoutes:
    """Tests for inter-city route calculation endpoint."""

    @pytest.mark.asyncio
    async def test_calculate_inter_city_route_driving(self, client: AsyncClient):
        """Test POST /api/v1/routes/inter-city - driving mode."""
        request_data = {
            "origin": {"lat": 48.8566, "lon": 2.3522},      # Paris
            "destination": {"lat": 45.7640, "lon": 4.8357}, # Lyon
            "mode": "driving"
        }

        response = await client.post(
            "/api/v1/routes/inter-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "driving"
        assert data["distance_km"] > 0
        assert data["duration_min"] > 0
        assert "geometry" in data
        assert data["geometry"]["type"] == "LineString"
        # Paris to Lyon is ~465km, with 1.3x factor ~600km
        assert 500 < data["distance_km"] < 800

    @pytest.mark.asyncio
    async def test_calculate_inter_city_route_train(self, client: AsyncClient):
        """Test POST /api/v1/routes/inter-city - train mode."""
        request_data = {
            "origin": {"lat": 48.8566, "lon": 2.3522},
            "destination": {"lat": 45.7640, "lon": 4.8357},
            "mode": "train"
        }

        response = await client.post(
            "/api/v1/routes/inter-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "train"
        # Train uses 1.2x factor (less than driving's 1.3x)
        assert data["distance_km"] > 0

    @pytest.mark.asyncio
    async def test_calculate_inter_city_route_flight(self, client: AsyncClient):
        """Test POST /api/v1/routes/inter-city - flight mode."""
        request_data = {
            "origin": {"lat": 48.8566, "lon": 2.3522},      # Paris
            "destination": {"lat": 40.4168, "lon": -3.7038}, # Madrid
            "mode": "flight"
        }

        response = await client.post(
            "/api/v1/routes/inter-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "flight"
        # Flight uses direct distance
        assert 1000 < data["distance_km"] < 1200  # Paris-Madrid ~1050km

    @pytest.mark.asyncio
    async def test_calculate_inter_city_route_invalid_mode(self, client: AsyncClient):
        """Test that invalid mode returns validation error."""
        request_data = {
            "origin": {"lat": 48.8566, "lon": 2.3522},
            "destination": {"lat": 45.7640, "lon": 4.8357},
            "mode": "teleportation"
        }

        response = await client.post(
            "/api/v1/routes/inter-city",
            json=request_data
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_calculate_inter_city_route_invalid_coordinates(
        self, client: AsyncClient
    ):
        """Test that invalid coordinates return validation error."""
        request_data = {
            "origin": {"lat": 200.0, "lon": 2.3522},  # Invalid latitude
            "destination": {"lat": 45.7640, "lon": 4.8357},
            "mode": "driving"
        }

        response = await client.post(
            "/api/v1/routes/inter-city",
            json=request_data
        )

        assert response.status_code == 422


class TestIntraCityRoutes:
    """Tests for intra-city route calculation endpoint."""

    @pytest.mark.asyncio
    async def test_calculate_intra_city_route_walking(self, client: AsyncClient):
        """Test POST /api/v1/routes/intra-city - walking mode."""
        request_data = {
            "mode": "walking",
            "points": [
                {"latitude": 48.8566, "longitude": 2.3522, "dwell_time": 0, "name": "Start"},
                {"latitude": 48.8584, "longitude": 2.2945, "dwell_time": 60, "name": "Eiffel Tower"},
                {"latitude": 48.8606, "longitude": 2.3376, "dwell_time": 0, "name": "End"}
            ]
        }

        response = await client.post(
            "/api/v1/routes/intra-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "walking"
        assert data["total_distance_km"] > 0
        assert data["total_travel_time_minutes"] > 0
        assert data["total_dwell_time_minutes"] == 60
        assert len(data["legs"]) == 2  # 3 points = 2 legs

    @pytest.mark.asyncio
    async def test_calculate_intra_city_route_cycling(self, client: AsyncClient):
        """Test POST /api/v1/routes/intra-city - cycling mode."""
        request_data = {
            "mode": "cycling",
            "points": [
                {"latitude": 48.8566, "longitude": 2.3522, "dwell_time": 0},
                {"latitude": 48.8584, "longitude": 2.2945, "dwell_time": 30}
            ]
        }

        response = await client.post(
            "/api/v1/routes/intra-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "cycling"
        # Cycling at 15km/h should be faster than walking at 5km/h for same distance
        # We just verify it works
        assert data["total_travel_time_minutes"] > 0

    @pytest.mark.asyncio
    async def test_calculate_intra_city_route_legs(self, client: AsyncClient):
        """Test that route legs are properly calculated."""
        request_data = {
            "mode": "walking",
            "points": [
                {"latitude": 48.8566, "longitude": 2.3522, "dwell_time": 0, "name": "Hotel"},
                {"latitude": 48.8584, "longitude": 2.2945, "dwell_time": 60, "name": "Museum"},
                {"latitude": 48.8606, "longitude": 2.3376, "dwell_time": 30, "name": "Restaurant"}
            ]
        }

        response = await client.post(
            "/api/v1/routes/intra-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()

        # Check legs
        assert len(data["legs"]) == 2

        leg1 = data["legs"][0]
        assert "Hotel" in leg1["description"]
        assert "Museum" in leg1["description"]
        assert leg1["distance_km"] > 0

        leg2 = data["legs"][1]
        assert "Museum" in leg2["description"]
        assert "Restaurant" in leg2["description"]

    @pytest.mark.asyncio
    async def test_calculate_intra_city_route_total_duration(self, client: AsyncClient):
        """Test that total duration includes travel time and dwell time."""
        request_data = {
            "mode": "walking",
            "points": [
                {"latitude": 48.8566, "longitude": 2.3522, "dwell_time": 30},
                {"latitude": 48.8584, "longitude": 2.2945, "dwell_time": 60},
                {"latitude": 48.8606, "longitude": 2.3376, "dwell_time": 45}
            ]
        }

        response = await client.post(
            "/api/v1/routes/intra-city",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_dwell_time_minutes"] == 135  # 30 + 60 + 45
        assert data["total_duration_minutes"] == pytest.approx(
            data["total_travel_time_minutes"] + data["total_dwell_time_minutes"],
            rel=0.01
        )

    @pytest.mark.asyncio
    async def test_calculate_intra_city_route_minimum_points(self, client: AsyncClient):
        """Test that at least 2 points are required."""
        request_data = {
            "mode": "walking",
            "points": [
                {"latitude": 48.8566, "longitude": 2.3522, "dwell_time": 0}
            ]
        }

        response = await client.post(
            "/api/v1/routes/intra-city",
            json=request_data
        )

        assert response.status_code == 422


class TestMapboxRoutes:
    """Tests for Mapbox API integration endpoints."""

    @pytest.mark.asyncio
    async def test_get_mapbox_route(
        self, client: AsyncClient, mock_mapbox_response: dict
    ):
        """Test POST /api/v1/routes/mapbox - single route."""
        with patch("app.api.routes.MapboxService") as MockService:
            mock_service = MagicMock()
            mock_service.get_route = AsyncMock(return_value=MagicMock(
                distance_meters=5000.0,
                duration_seconds=600.0,
                geometry={"type": "LineString", "coordinates": [[2.35, 48.85], [2.29, 48.86]]},
                waypoints=[{"name": "Start", "location": [2.35, 48.85]}]
            ))
            MockService.return_value = mock_service

            request_data = {
                "origin": {"lon": 2.3522, "lat": 48.8566},
                "destination": {"lon": 2.2945, "lat": 48.8584},
                "profile": "walking"
            }

            response = await client.post(
                "/api/v1/routes/mapbox",
                json=request_data
            )

            assert response.status_code == 200
            data = response.json()
            assert data["distance_km"] == 5.0  # 5000m / 1000
            assert data["duration_min"] == 10.0  # 600s / 60
            assert data["profile"] == "walking"
            assert "geometry" in data

    @pytest.mark.asyncio
    async def test_get_mapbox_route_with_waypoints(
        self, client: AsyncClient
    ):
        """Test Mapbox route with intermediate waypoints."""
        with patch("app.api.routes.MapboxService") as MockService:
            mock_service = MagicMock()
            mock_service.get_route = AsyncMock(return_value=MagicMock(
                distance_meters=10000.0,
                duration_seconds=1200.0,
                geometry={"type": "LineString", "coordinates": []},
                waypoints=[]
            ))
            MockService.return_value = mock_service

            request_data = {
                "origin": {"lon": 2.35, "lat": 48.85},
                "destination": {"lon": 2.40, "lat": 48.90},
                "profile": "driving",
                "waypoints": [
                    {"lon": 2.36, "lat": 48.86},
                    {"lon": 2.38, "lat": 48.88}
                ]
            }

            response = await client.post(
                "/api/v1/routes/mapbox",
                json=request_data
            )

            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_mapbox_route_profiles(self, client: AsyncClient):
        """Test different Mapbox routing profiles."""
        profiles = ["driving", "driving-traffic", "walking", "cycling"]

        for profile in profiles:
            with patch("app.api.routes.MapboxService") as MockService:
                mock_service = MagicMock()
                mock_service.get_route = AsyncMock(return_value=MagicMock(
                    distance_meters=5000.0,
                    duration_seconds=600.0,
                    geometry={"type": "LineString", "coordinates": []},
                    waypoints=[]
                ))
                MockService.return_value = mock_service

                response = await client.post(
                    "/api/v1/routes/mapbox",
                    json={
                        "origin": {"lon": 2.35, "lat": 48.85},
                        "destination": {"lon": 2.40, "lat": 48.90},
                        "profile": profile
                    }
                )

                assert response.status_code == 200
                assert response.json()["profile"] == profile

    @pytest.mark.asyncio
    async def test_get_mapbox_route_error(self, client: AsyncClient):
        """Test Mapbox route error handling."""
        from app.services.mapbox_service import MapboxServiceError

        with patch("app.api.routes.MapboxService") as MockService:
            mock_service = MagicMock()
            mock_service.get_route = AsyncMock(
                side_effect=MapboxServiceError("Invalid token")
            )
            MockService.return_value = mock_service

            response = await client.post(
                "/api/v1/routes/mapbox",
                json={
                    "origin": {"lon": 2.35, "lat": 48.85},
                    "destination": {"lon": 2.40, "lat": 48.90},
                    "profile": "driving"
                }
            )

            assert response.status_code == 400
            assert "Invalid token" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_mapbox_multi_waypoint_route(self, client: AsyncClient):
        """Test POST /api/v1/routes/mapbox/multi-waypoint."""
        with patch("app.api.routes.MapboxService") as MockService:
            mock_service = MagicMock()
            mock_service.get_multi_waypoint_route = AsyncMock(return_value=MagicMock(
                distance_meters=15000.0,
                duration_seconds=1800.0,
                geometry={"type": "LineString", "coordinates": []},
                waypoints=[
                    {"name": "A", "location": [2.35, 48.85]},
                    {"name": "B", "location": [2.36, 48.86]},
                    {"name": "C", "location": [2.37, 48.87]}
                ]
            ))
            MockService.return_value = mock_service

            request_data = {
                "waypoints": [
                    {"lon": 2.35, "lat": 48.85},
                    {"lon": 2.36, "lat": 48.86},
                    {"lon": 2.37, "lat": 48.87}
                ],
                "profile": "walking"
            }

            response = await client.post(
                "/api/v1/routes/mapbox/multi-waypoint",
                json=request_data
            )

            assert response.status_code == 200
            data = response.json()
            assert data["distance_km"] == 15.0
            assert data["duration_min"] == 30.0
            assert len(data["waypoints"]) == 3

    @pytest.mark.asyncio
    async def test_get_mapbox_multi_waypoint_minimum(self, client: AsyncClient):
        """Test that at least 2 waypoints are required."""
        response = await client.post(
            "/api/v1/routes/mapbox/multi-waypoint",
            json={
                "waypoints": [{"lon": 2.35, "lat": 48.85}],
                "profile": "walking"
            }
        )

        assert response.status_code == 422


class TestRouteCRUD:
    """Tests for route CRUD endpoints (database operations)."""

    @pytest.mark.asyncio
    async def test_get_routes(self, client: AsyncClient):
        """Test GET /api/v1/routes - list all routes."""
        response = await client.get("/api/v1/routes")

        assert response.status_code == 200
        # Current implementation returns placeholder
        assert "data" in response.json()

    @pytest.mark.asyncio
    async def test_get_route_by_id(self, client: AsyncClient):
        """Test GET /api/v1/routes/{route_id}."""
        response = await client.get("/api/v1/routes/1")

        assert response.status_code == 200
        # Current implementation returns placeholder

    @pytest.mark.asyncio
    async def test_create_route(self, client: AsyncClient):
        """Test POST /api/v1/routes - create route."""
        response = await client.post("/api/v1/routes")

        assert response.status_code == 200
        # Current implementation returns placeholder

    @pytest.mark.asyncio
    async def test_update_route(self, client: AsyncClient):
        """Test PUT /api/v1/routes/{route_id}."""
        response = await client.put("/api/v1/routes/1")

        assert response.status_code == 200
        # Current implementation returns placeholder

    @pytest.mark.asyncio
    async def test_delete_route(self, client: AsyncClient):
        """Test DELETE /api/v1/routes/{route_id}."""
        response = await client.delete("/api/v1/routes/1")

        assert response.status_code == 200
        # Current implementation returns placeholder

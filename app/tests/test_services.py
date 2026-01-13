"""
Unit tests for service layer.
Tests business logic in TripService, RouteService, GeospatialService, and WeatherService.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.services.trip_service import TripService
from app.services.route_service import RouteService
from app.services.weather_service import WeatherService
from app.schemas.trip import TripCreate, TripUpdate
from app.schemas.routing import RoutingRequest, TravelMode, Coordinate
from app.schemas.route import RouteRequest, RoutePoint


class TestTripService:
    """Tests for TripService."""

    @pytest.mark.asyncio
    async def test_create_trip(self, db: AsyncSession):
        """Test creating a trip through the service."""
        trip_data = TripCreate(
            name="Service Test Trip",
            description="Test description",
            start_date=date.today() + timedelta(days=10),
            end_date=date.today() + timedelta(days=20),
            total_budget=Decimal("2000.00"),
            currency="EUR",
            status="planning"
        )

        trip = await TripService.create_trip(db, trip_data)

        assert trip.id is not None
        assert trip.name == "Service Test Trip"
        assert trip.total_budget == Decimal("2000.00")

    @pytest.mark.asyncio
    async def test_get_trip(self, db: AsyncSession, created_trip: Trip):
        """Test getting a trip by ID."""
        trip = await TripService.get_trip(db, created_trip.id)

        assert trip is not None
        assert trip.id == created_trip.id
        assert trip.name == created_trip.name

    @pytest.mark.asyncio
    async def test_get_trip_not_found(self, db: AsyncSession):
        """Test getting a non-existent trip returns None."""
        trip = await TripService.get_trip(db, 99999)
        assert trip is None

    @pytest.mark.asyncio
    async def test_get_trips_with_pagination(self, db: AsyncSession):
        """Test getting trips with pagination."""
        # Create multiple trips
        for i in range(5):
            trip = Trip(
                name=f"Pagination Trip {i}",
                start_date=date.today() + timedelta(days=i),
                end_date=date.today() + timedelta(days=i+5),
                status="planning"
            )
            db.add(trip)
        await db.flush()

        # Test pagination
        trips = await TripService.get_trips(db, skip=0, limit=3)
        assert len(trips) <= 3

        trips_page2 = await TripService.get_trips(db, skip=3, limit=3)
        assert len(trips_page2) <= 3

    @pytest.mark.asyncio
    async def test_update_trip(self, db: AsyncSession, created_trip: Trip):
        """Test updating a trip."""
        update_data = TripUpdate(
            name="Updated Trip Name",
            description="Updated description"
        )

        updated_trip = await TripService.update_trip(db, created_trip.id, update_data)

        assert updated_trip is not None
        assert updated_trip.name == "Updated Trip Name"
        assert updated_trip.description == "Updated description"
        # Original values should be preserved
        assert updated_trip.currency == created_trip.currency

    @pytest.mark.asyncio
    async def test_update_trip_not_found(self, db: AsyncSession):
        """Test updating a non-existent trip returns None."""
        update_data = TripUpdate(name="New Name")
        result = await TripService.update_trip(db, 99999, update_data)
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_trip(self, db: AsyncSession):
        """Test deleting a trip."""
        trip = Trip(
            name="To Delete",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=5),
            status="planning"
        )
        db.add(trip)
        await db.flush()
        trip_id = trip.id

        result = await TripService.delete_trip(db, trip_id)
        assert result is True

        # Verify deletion
        deleted_trip = await TripService.get_trip(db, trip_id)
        assert deleted_trip is None

    @pytest.mark.asyncio
    async def test_delete_trip_not_found(self, db: AsyncSession):
        """Test deleting a non-existent trip returns False."""
        result = await TripService.delete_trip(db, 99999)
        assert result is False

    @pytest.mark.asyncio
    async def test_get_budget_summary_no_budget(
        self, db: AsyncSession, created_trip: Trip, created_destination: Destination
    ):
        """Test budget summary when trip has no budget set."""
        # Create POI with costs
        poi = POI(
            destination_id=created_destination.id,
            name="Budget Test POI",
            category="Restaurant",
            estimated_cost=Decimal("50.00"),
            actual_cost=Decimal("45.00")
        )
        db.add(poi)
        await db.flush()

        # Update trip to have no budget
        created_trip.total_budget = None
        await db.flush()

        summary = await TripService.get_budget_summary(db, created_trip.id)

        assert summary is not None
        assert summary.total_budget is None
        assert summary.estimated_total == Decimal("50.00")
        assert summary.actual_total == Decimal("45.00")
        assert summary.remaining_budget is None
        assert summary.budget_percentage is None

    @pytest.mark.asyncio
    async def test_get_budget_summary_with_budget(
        self, db: AsyncSession, created_destination: Destination
    ):
        """Test budget summary with budget and POI costs."""
        # Create a new trip with budget for this test
        trip = Trip(
            name="Budget Test Trip",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=10),
            total_budget=Decimal("1000.00"),
            currency="USD",
            status="planning"
        )
        db.add(trip)
        await db.flush()

        # Create destination for this trip
        dest = Destination(
            trip_id=trip.id,
            city_name="Test City",
            country="Test Country",
            arrival_date=date.today(),
            departure_date=date.today() + timedelta(days=5),
            order_index=0
        )
        db.add(dest)
        await db.flush()

        # Create POIs with costs
        poi1 = POI(
            destination_id=dest.id,
            name="POI 1",
            category="Food",
            estimated_cost=Decimal("100.00"),
            actual_cost=Decimal("80.00")
        )
        poi2 = POI(
            destination_id=dest.id,
            name="POI 2",
            category="Activity",
            estimated_cost=Decimal("200.00"),
            actual_cost=Decimal("220.00")
        )
        db.add(poi1)
        db.add(poi2)
        await db.flush()

        summary = await TripService.get_budget_summary(db, trip.id)

        assert summary is not None
        assert summary.total_budget == Decimal("1000.00")
        assert summary.estimated_total == Decimal("300.00")  # 100 + 200
        assert summary.actual_total == Decimal("300.00")     # 80 + 220
        assert summary.remaining_budget == Decimal("700.00") # 1000 - 300
        assert summary.budget_percentage == 30.0             # 300/1000 * 100

    @pytest.mark.asyncio
    async def test_get_budget_summary_not_found(self, db: AsyncSession):
        """Test budget summary for non-existent trip."""
        summary = await TripService.get_budget_summary(db, 99999)
        assert summary is None


class TestRouteService:
    """Tests for RouteService."""

    def test_calculate_inter_city_route_driving(self):
        """Test inter-city route calculation for driving."""
        request = RoutingRequest(
            origin=Coordinate(lat=48.8566, lon=2.3522),      # Paris
            destination=Coordinate(lat=45.7640, lon=4.8357), # Lyon
            mode=TravelMode.DRIVING
        )

        response = RouteService.calculate_inter_city_route(request)

        assert response.mode == TravelMode.DRIVING
        assert response.distance_km > 0
        assert response.duration_min > 0
        # Paris to Lyon is about 465 km, with 1.3x factor should be ~600 km
        assert 500 < response.distance_km < 800
        assert response.geometry is not None
        assert response.geometry["type"] == "LineString"

    def test_calculate_inter_city_route_train(self):
        """Test inter-city route calculation for train."""
        request = RoutingRequest(
            origin=Coordinate(lat=48.8566, lon=2.3522),      # Paris
            destination=Coordinate(lat=45.7640, lon=4.8357), # Lyon
            mode=TravelMode.TRAIN
        )

        response = RouteService.calculate_inter_city_route(request)

        assert response.mode == TravelMode.TRAIN
        assert response.distance_km > 0
        # Train distance with 1.2x factor should be less than driving
        driving_request = RoutingRequest(
            origin=Coordinate(lat=48.8566, lon=2.3522),
            destination=Coordinate(lat=45.7640, lon=4.8357),
            mode=TravelMode.DRIVING
        )
        driving_response = RouteService.calculate_inter_city_route(driving_request)
        assert response.distance_km < driving_response.distance_km

    def test_calculate_inter_city_route_flight(self):
        """Test inter-city route calculation for flight."""
        request = RoutingRequest(
            origin=Coordinate(lat=48.8566, lon=2.3522),      # Paris
            destination=Coordinate(lat=40.4168, lon=-3.7038), # Madrid
            mode=TravelMode.FLIGHT
        )

        response = RouteService.calculate_inter_city_route(request)

        assert response.mode == TravelMode.FLIGHT
        # Flight is direct distance, so shortest
        assert response.distance_km > 0
        # Paris to Madrid is about 1050 km direct
        assert 1000 < response.distance_km < 1200

    def test_calculate_haversine_distance(self):
        """Test haversine distance calculation."""
        # New York to Los Angeles approximately 3940 km
        distance = RouteService.calculate_haversine_distance(
            lat1=40.7128, lon1=-74.0060,  # New York
            lat2=34.0522, lon2=-118.2437  # Los Angeles
        )

        assert 3900 < distance < 4000

    def test_calculate_haversine_distance_same_point(self):
        """Test haversine distance for same point is 0."""
        distance = RouteService.calculate_haversine_distance(
            lat1=48.8566, lon1=2.3522,
            lat2=48.8566, lon2=2.3522
        )

        assert distance == 0.0

    def test_calculate_intra_city_route_walking(self):
        """Test intra-city route calculation for walking."""
        request = RouteRequest(
            mode="walking",
            points=[
                RoutePoint(latitude=48.8566, longitude=2.3522, dwell_time=30, name="Start"),
                RoutePoint(latitude=48.8584, longitude=2.2945, dwell_time=60, name="Eiffel Tower"),
                RoutePoint(latitude=48.8606, longitude=2.3376, dwell_time=0, name="End")
            ]
        )

        response = RouteService.calculate_intra_city_route(request)

        assert response.mode == "walking"
        assert response.total_distance_km > 0
        assert response.total_travel_time_minutes > 0
        assert response.total_dwell_time_minutes == 90  # 30 + 60 + 0
        assert response.total_duration_minutes == response.total_travel_time_minutes + 90
        assert len(response.legs) == 2  # 3 points = 2 legs

    def test_calculate_intra_city_route_cycling(self):
        """Test intra-city route calculation for cycling."""
        request = RouteRequest(
            mode="cycling",
            points=[
                RoutePoint(latitude=48.8566, longitude=2.3522, dwell_time=0),
                RoutePoint(latitude=48.8584, longitude=2.2945, dwell_time=0)
            ]
        )

        response = RouteService.calculate_intra_city_route(request)

        assert response.mode == "cycling"
        # Cycling at 15 km/h should be faster than walking at 5 km/h
        walking_request = RouteRequest(
            mode="walking",
            points=[
                RoutePoint(latitude=48.8566, longitude=2.3522, dwell_time=0),
                RoutePoint(latitude=48.8584, longitude=2.2945, dwell_time=0)
            ]
        )
        walking_response = RouteService.calculate_intra_city_route(walking_request)
        assert response.total_travel_time_minutes < walking_response.total_travel_time_minutes

    def test_calculate_intra_city_route_leg_description(self):
        """Test that route legs have proper descriptions."""
        request = RouteRequest(
            mode="walking",
            points=[
                RoutePoint(latitude=48.8566, longitude=2.3522, dwell_time=0, name="Hotel"),
                RoutePoint(latitude=48.8584, longitude=2.2945, dwell_time=0, name="Museum")
            ]
        )

        response = RouteService.calculate_intra_city_route(request)

        assert len(response.legs) == 1
        assert "Hotel" in response.legs[0].description
        assert "Museum" in response.legs[0].description

    @pytest.mark.asyncio
    async def test_get_all_routes(self, db: AsyncSession):
        """Test getting all routes from database."""
        from app.models.route import Route

        # Create test routes
        route1 = Route(
            name="Test Route 1",
            start_location="A",
            end_location="B"
        )
        route2 = Route(
            name="Test Route 2",
            start_location="C",
            end_location="D"
        )
        db.add(route1)
        db.add(route2)
        await db.flush()

        routes = await RouteService.get_all_routes(db)
        assert len(routes) >= 2

    @pytest.mark.asyncio
    async def test_create_route(self, db: AsyncSession):
        """Test creating a route in database."""
        route_data = {
            "name": "New Route",
            "start_location": "Paris",
            "end_location": "Lyon",
            "distance": 465.0,
            "duration": 270.0
        }

        route = await RouteService.create_route(db, route_data)

        assert route.id is not None
        assert route.name == "New Route"
        assert route.distance == 465.0

    @pytest.mark.asyncio
    async def test_update_route(self, db: AsyncSession):
        """Test updating a route in database."""
        from app.models.route import Route

        route = Route(
            name="Original Name",
            start_location="A",
            end_location="B"
        )
        db.add(route)
        await db.flush()

        updated = await RouteService.update_route(
            db, route.id, {"name": "Updated Name", "distance": 100.0}
        )

        assert updated.name == "Updated Name"
        assert updated.distance == 100.0

    @pytest.mark.asyncio
    async def test_delete_route(self, db: AsyncSession):
        """Test deleting a route from database."""
        from app.models.route import Route

        route = Route(
            name="To Delete",
            start_location="A",
            end_location="B"
        )
        db.add(route)
        await db.flush()
        route_id = route.id

        result = await RouteService.delete_route(db, route_id)
        assert result is True

        # Verify deletion
        deleted = await RouteService.get_route_by_id(db, route_id)
        assert deleted is None


class TestWeatherService:
    """Tests for WeatherService."""

    @pytest.mark.asyncio
    async def test_get_average_temperature_cached(self):
        """Test that weather data is cached."""
        from app.services.weather_service import _weather_cache

        # Clear cache
        WeatherService.clear_cache()

        # Mock the HTTP response
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "daily": {
                    "temperature_2m_mean": [15.0, 16.0, 14.0, 15.5, 16.5]
                }
            }
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            # First call - should hit API
            temp1 = await WeatherService.get_average_temperature(48.86, 2.35, 6)
            assert temp1 is not None

            # Second call - should use cache
            temp2 = await WeatherService.get_average_temperature(48.86, 2.35, 6)
            assert temp2 == temp1

            # API should only be called once
            assert mock_client_instance.get.call_count == 1

    @pytest.mark.asyncio
    async def test_get_average_temperature_calculation(self):
        """Test temperature average calculation."""
        WeatherService.clear_cache()

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "daily": {
                    "temperature_2m_mean": [10.0, 20.0, 15.0]  # Average = 15.0
                }
            }
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            temp = await WeatherService.get_average_temperature(40.0, -74.0, 7)
            assert temp == 15.0

    @pytest.mark.asyncio
    async def test_get_average_temperature_with_none_values(self):
        """Test temperature calculation handles None values."""
        WeatherService.clear_cache()

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "daily": {
                    "temperature_2m_mean": [10.0, None, 20.0, None, 15.0]
                }
            }
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            temp = await WeatherService.get_average_temperature(35.0, 139.0, 8)
            assert temp == 15.0  # (10 + 20 + 15) / 3 = 15.0

    @pytest.mark.asyncio
    async def test_get_average_temperature_api_error(self):
        """Test handling of API errors."""
        WeatherService.clear_cache()

        with patch("httpx.AsyncClient") as mock_client:
            import httpx
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(
                side_effect=httpx.HTTPError("API Error")
            )
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            temp = await WeatherService.get_average_temperature(51.0, -0.1, 12)
            assert temp is None

    @pytest.mark.asyncio
    async def test_get_average_temperature_empty_data(self):
        """Test handling of empty temperature data."""
        WeatherService.clear_cache()

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "daily": {
                    "temperature_2m_mean": []
                }
            }
            mock_response.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            temp = await WeatherService.get_average_temperature(35.0, 139.0, 1)
            assert temp is None

    def test_get_month_name(self):
        """Test month name conversion."""
        assert WeatherService.get_month_name(1) == "January"
        assert WeatherService.get_month_name(6) == "June"
        assert WeatherService.get_month_name(12) == "December"
        assert WeatherService.get_month_name(0) == "Unknown"
        assert WeatherService.get_month_name(13) == "Unknown"

    def test_clear_cache(self):
        """Test cache clearing."""
        from app.services.weather_service import _weather_cache

        # Add something to cache
        _weather_cache[(1.0, 2.0, 1)] = (15.0, date.today())
        assert len(_weather_cache) > 0

        WeatherService.clear_cache()
        assert len(_weather_cache) == 0

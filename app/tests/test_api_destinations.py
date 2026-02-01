"""
Integration tests for Destinations API endpoints.
Tests CRUD operations and trip-destination relationships.
"""
import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.destination import Destination


class TestDestinationsAPI:
    """Integration tests for /api/v1/destinations endpoints."""

    @pytest.mark.asyncio
    async def test_create_destination(
        self,
        client: AsyncClient,
        created_trip: Trip,
        sample_destination_data: dict
    ):
        """Test POST /api/v1/destinations - create a new destination."""
        data = {**sample_destination_data, "trip_id": created_trip.id}

        response = await client.post("/api/v1/destinations", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["city_name"] == data["city_name"]
        assert result["country"] == data["country"]
        assert result["trip_id"] == created_trip.id
        assert "id" in result
        assert "created_at" in result

    @pytest.mark.asyncio
    async def test_create_destination_minimal(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test creating a destination with minimal required fields."""
        minimal_data = {
            "trip_id": created_trip.id,
            "city_name": "London",
            "country": "UK",
            "arrival_date": str(date.today() + timedelta(days=5)),
            "departure_date": str(date.today() + timedelta(days=10))
        }

        response = await client.post("/api/v1/destinations", json=minimal_data)

        assert response.status_code == 201
        result = response.json()
        assert result["city_name"] == "London"
        assert result["order_index"] == 0  # default

    @pytest.mark.asyncio
    async def test_create_destination_with_coordinates(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test creating a destination with latitude/longitude."""
        data = {
            "trip_id": created_trip.id,
            "city_name": "Tokyo",
            "country": "Japan",
            "arrival_date": str(date.today() + timedelta(days=5)),
            "departure_date": str(date.today() + timedelta(days=10)),
            "latitude": 35.6762,
            "longitude": 139.6503
        }

        response = await client.post("/api/v1/destinations", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["latitude"] == 35.6762
        assert result["longitude"] == 139.6503

    @pytest.mark.asyncio
    async def test_create_destination_trip_not_found(self, client: AsyncClient):
        """Test creating destination with non-existent trip fails."""
        data = {
            "trip_id": 99999,
            "city_name": "Berlin",
            "country": "Germany",
            "arrival_date": str(date.today() + timedelta(days=5)),
            "departure_date": str(date.today() + timedelta(days=10))
        }

        response = await client.post("/api/v1/destinations", json=data)

        assert response.status_code == 404
        assert "Trip" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_destinations_by_trip(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test GET /api/v1/trips/{trip_id}/destinations - list destinations."""
        # Create multiple destinations
        dest1 = Destination(
            trip_id=created_trip.id,
            city_name="Paris",
            country="France",
            arrival_date=date.today(),
            departure_date=date.today() + timedelta(days=3),
            order_index=0
        )
        dest2 = Destination(
            trip_id=created_trip.id,
            city_name="London",
            country="UK",
            arrival_date=date.today() + timedelta(days=3),
            departure_date=date.today() + timedelta(days=6),
            order_index=1
        )
        db.add(dest1)
        db.add(dest2)
        await db.flush()

        response = await client.get(
            f"/api/v1/trips/{created_trip.id}/destinations"
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) >= 2
        assert data["total"] >= 2

        # Check ordering by order_index
        order_indices = [d["order_index"] for d in data["items"]]
        assert order_indices == sorted(order_indices)

    @pytest.mark.asyncio
    async def test_list_destinations_trip_not_found(self, client: AsyncClient):
        """Test listing destinations for non-existent trip returns 404."""
        response = await client.get("/api/v1/trips/99999/destinations")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_destinations_empty(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test listing destinations for trip with no destinations."""
        # Use a new trip without destinations
        response = await client.get(
            f"/api/v1/trips/{created_trip.id}/destinations"
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert data["skip"] == 0
        assert data["limit"] == 50  # default limit

    @pytest.mark.asyncio
    async def test_get_destination_by_id(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test GET /api/v1/destinations/{id} - get specific destination."""
        response = await client.get(
            f"/api/v1/destinations/{created_destination.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_destination.id
        assert data["city_name"] == created_destination.city_name

    @pytest.mark.asyncio
    async def test_get_destination_not_found(self, client: AsyncClient):
        """Test GET destination returns 404 for non-existent destination."""
        response = await client.get("/api/v1/destinations/99999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_destination(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test PUT /api/v1/destinations/{id} - update destination."""
        update_data = {
            "city_name": "Updated City",
            "notes": "New notes about the destination"
        }

        response = await client.put(
            f"/api/v1/destinations/{created_destination.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["city_name"] == "Updated City"
        assert data["notes"] == "New notes about the destination"
        # Original values should be preserved
        assert data["country"] == created_destination.country

    @pytest.mark.asyncio
    async def test_update_destination_coordinates(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test updating destination coordinates."""
        update_data = {
            "latitude": 51.5074,
            "longitude": -0.1278
        }

        response = await client.put(
            f"/api/v1/destinations/{created_destination.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["latitude"] == 51.5074
        assert data["longitude"] == -0.1278

    @pytest.mark.asyncio
    async def test_update_destination_not_found(self, client: AsyncClient):
        """Test updating non-existent destination returns 404."""
        response = await client.put(
            "/api/v1/destinations/99999",
            json={"city_name": "Updated"}
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_destination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test DELETE /api/v1/destinations/{id} - delete destination."""
        # Create destination to delete
        dest = Destination(
            trip_id=created_trip.id,
            city_name="To Delete",
            country="Test Country",
            arrival_date=date.today(),
            departure_date=date.today() + timedelta(days=5),
            order_index=99
        )
        db.add(dest)
        await db.flush()
        dest_id = dest.id

        response = await client.delete(f"/api/v1/destinations/{dest_id}")

        assert response.status_code == 204

        # Verify deletion
        get_response = await client.get(f"/api/v1/destinations/{dest_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_destination_not_found(self, client: AsyncClient):
        """Test deleting non-existent destination returns 404."""
        response = await client.delete("/api/v1/destinations/99999")

        assert response.status_code == 404


class TestDestinationsAPIValidation:
    """Tests for input validation on Destinations API."""

    @pytest.mark.asyncio
    async def test_create_destination_empty_city_name(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test that empty city_name is rejected."""
        data = {
            "trip_id": created_trip.id,
            "city_name": "",
            "country": "France",
            "arrival_date": str(date.today()),
            "departure_date": str(date.today() + timedelta(days=5))
        }

        response = await client.post("/api/v1/destinations", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_destination_empty_country(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test that empty country is rejected."""
        data = {
            "trip_id": created_trip.id,
            "city_name": "Paris",
            "country": "",
            "arrival_date": str(date.today()),
            "departure_date": str(date.today() + timedelta(days=5))
        }

        response = await client.post("/api/v1/destinations", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_destination_missing_dates(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test that missing dates are rejected."""
        data = {
            "trip_id": created_trip.id,
            "city_name": "Paris",
            "country": "France"
        }

        response = await client.post("/api/v1/destinations", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_destination_invalid_coordinates(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test that invalid coordinates are handled."""
        data = {
            "trip_id": created_trip.id,
            "city_name": "Paris",
            "country": "France",
            "arrival_date": str(date.today()),
            "departure_date": str(date.today() + timedelta(days=5)),
            "latitude": "not a number",
            "longitude": 2.35
        }

        response = await client.post("/api/v1/destinations", json=data)
        assert response.status_code == 422


class TestDestinationsOrdering:
    """Tests for destination ordering functionality."""

    @pytest.mark.asyncio
    async def test_destinations_ordered_by_index(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test that destinations are returned in order_index order."""
        # Create destinations with specific order indices
        dest3 = Destination(
            trip_id=created_trip.id,
            city_name="Third",
            country="Test",
            arrival_date=date.today() + timedelta(days=10),
            departure_date=date.today() + timedelta(days=15),
            order_index=2
        )
        dest1 = Destination(
            trip_id=created_trip.id,
            city_name="First",
            country="Test",
            arrival_date=date.today(),
            departure_date=date.today() + timedelta(days=5),
            order_index=0
        )
        dest2 = Destination(
            trip_id=created_trip.id,
            city_name="Second",
            country="Test",
            arrival_date=date.today() + timedelta(days=5),
            departure_date=date.today() + timedelta(days=10),
            order_index=1
        )
        db.add(dest3)
        db.add(dest1)
        db.add(dest2)
        await db.flush()

        response = await client.get(
            f"/api/v1/trips/{created_trip.id}/destinations"
        )

        assert response.status_code == 200
        data = response.json()
        city_names = [d["city_name"] for d in data["items"]]

        # Verify order (First, Second, Third)
        first_idx = city_names.index("First")
        second_idx = city_names.index("Second")
        third_idx = city_names.index("Third")
        assert first_idx < second_idx < third_idx

    @pytest.mark.asyncio
    async def test_list_destinations_with_pagination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test pagination parameters on list destinations."""
        # Create multiple destinations
        for i in range(5):
            dest = Destination(
                trip_id=created_trip.id,
                city_name=f"City{i}",
                country="Test",
                arrival_date=date.today() + timedelta(days=i*5),
                departure_date=date.today() + timedelta(days=(i+1)*5),
                order_index=i
            )
            db.add(dest)
        await db.flush()

        # Test with skip and limit
        response = await client.get(
            f"/api/v1/trips/{created_trip.id}/destinations?skip=1&limit=2"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["skip"] == 1
        assert data["limit"] == 2
        assert data["total"] >= 5

    @pytest.mark.asyncio
    async def test_update_destination_order(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test updating destination order_index."""
        response = await client.put(
            f"/api/v1/destinations/{created_destination.id}",
            json={"order_index": 5}
        )

        assert response.status_code == 200
        assert response.json()["order_index"] == 5

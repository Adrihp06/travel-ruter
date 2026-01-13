"""
Integration tests for Trips API endpoints.
Tests CRUD operations and budget summary endpoint.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI


class TestTripsAPI:
    """Integration tests for /api/v1/trips endpoints."""

    @pytest.mark.asyncio
    async def test_create_trip(self, client: AsyncClient, sample_trip_data: dict):
        """Test POST /api/v1/trips - create a new trip."""
        response = await client.post("/api/v1/trips/", json=sample_trip_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_trip_data["name"]
        assert data["description"] == sample_trip_data["description"]
        assert data["currency"] == sample_trip_data["currency"]
        assert data["status"] == sample_trip_data["status"]
        assert "id" in data
        assert "created_at" in data
        assert "nights" in data
        # nights should be 15 (45 - 30 days)
        assert data["nights"] == 15

    @pytest.mark.asyncio
    async def test_create_trip_minimal(self, client: AsyncClient):
        """Test creating a trip with minimal required fields."""
        minimal_data = {
            "name": "Minimal Trip",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=7))
        }

        response = await client.post("/api/v1/trips/", json=minimal_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Trip"
        assert data["currency"] == "USD"  # default
        assert data["status"] == "planning"  # default
        assert data["nights"] == 7

    @pytest.mark.asyncio
    async def test_create_trip_invalid_dates(self, client: AsyncClient):
        """Test creating a trip with end_date before start_date fails."""
        invalid_data = {
            "name": "Invalid Trip",
            "start_date": str(date.today() + timedelta(days=10)),
            "end_date": str(date.today())  # Before start_date
        }

        response = await client.post("/api/v1/trips/", json=invalid_data)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_missing_name(self, client: AsyncClient):
        """Test creating a trip without name fails."""
        invalid_data = {
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=7))
        }

        response = await client.post("/api/v1/trips/", json=invalid_data)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_trips(self, client: AsyncClient, created_trip: Trip):
        """Test GET /api/v1/trips - list all trips."""
        response = await client.get("/api/v1/trips/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

        # Check that our created trip is in the list
        trip_ids = [t["id"] for t in data]
        assert created_trip.id in trip_ids

    @pytest.mark.asyncio
    async def test_get_trips_pagination(self, client: AsyncClient, db: AsyncSession):
        """Test GET /api/v1/trips with pagination parameters."""
        # Create multiple trips
        for i in range(5):
            trip = Trip(
                name=f"Pagination Test {i}",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=5),
                status="planning"
            )
            db.add(trip)
        await db.flush()

        # Test skip
        response = await client.get("/api/v1/trips/?skip=2&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2

    @pytest.mark.asyncio
    async def test_get_trips_limit_validation(self, client: AsyncClient):
        """Test GET /api/v1/trips limit validation."""
        # Test limit too high
        response = await client.get("/api/v1/trips/?limit=2000")
        assert response.status_code == 422

        # Test negative skip
        response = await client.get("/api/v1/trips/?skip=-1")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_trip_by_id(self, client: AsyncClient, created_trip: Trip):
        """Test GET /api/v1/trips/{trip_id} - get specific trip."""
        response = await client.get(f"/api/v1/trips/{created_trip.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_trip.id
        assert data["name"] == created_trip.name

    @pytest.mark.asyncio
    async def test_get_trip_not_found(self, client: AsyncClient):
        """Test GET /api/v1/trips/{trip_id} returns 404 for non-existent trip."""
        response = await client.get("/api/v1/trips/99999")

        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_update_trip(self, client: AsyncClient, created_trip: Trip):
        """Test PUT /api/v1/trips/{trip_id} - update trip."""
        update_data = {
            "name": "Updated Trip Name",
            "description": "New description",
            "status": "booked"
        }

        response = await client.put(
            f"/api/v1/trips/{created_trip.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Trip Name"
        assert data["description"] == "New description"
        assert data["status"] == "booked"
        # Original values should be preserved
        assert data["currency"] == created_trip.currency

    @pytest.mark.asyncio
    async def test_update_trip_partial(self, client: AsyncClient, created_trip: Trip):
        """Test partial update with only some fields."""
        update_data = {"name": "Only Name Changed"}

        response = await client.put(
            f"/api/v1/trips/{created_trip.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Only Name Changed"
        # Other fields should remain unchanged
        assert data["status"] == created_trip.status

    @pytest.mark.asyncio
    async def test_update_trip_not_found(self, client: AsyncClient):
        """Test PUT /api/v1/trips/{trip_id} returns 404 for non-existent trip."""
        response = await client.put(
            "/api/v1/trips/99999",
            json={"name": "Updated"}
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_trip(self, client: AsyncClient, db: AsyncSession):
        """Test DELETE /api/v1/trips/{trip_id} - delete trip."""
        # Create a trip to delete
        trip = Trip(
            name="To Delete",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=5),
            status="planning"
        )
        db.add(trip)
        await db.flush()
        trip_id = trip.id

        response = await client.delete(f"/api/v1/trips/{trip_id}")

        assert response.status_code == 204

        # Verify deletion
        get_response = await client.get(f"/api/v1/trips/{trip_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_trip_not_found(self, client: AsyncClient):
        """Test DELETE /api/v1/trips/{trip_id} returns 404 for non-existent trip."""
        response = await client.delete("/api/v1/trips/99999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_trip_budget(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip,
        created_destination: Destination
    ):
        """Test GET /api/v1/trips/{trip_id}/budget - get budget summary."""
        # Create POIs with costs
        poi1 = POI(
            destination_id=created_destination.id,
            name="Expensive Attraction",
            category="Entertainment",
            estimated_cost=Decimal("100.00"),
            actual_cost=Decimal("90.00")
        )
        poi2 = POI(
            destination_id=created_destination.id,
            name="Cheap Meal",
            category="Food",
            estimated_cost=Decimal("20.00"),
            actual_cost=Decimal("25.00")
        )
        db.add(poi1)
        db.add(poi2)
        await db.flush()

        response = await client.get(f"/api/v1/trips/{created_trip.id}/budget")

        assert response.status_code == 200
        data = response.json()
        assert data["estimated_total"] == "120.00"  # 100 + 20
        assert data["actual_total"] == "115.00"     # 90 + 25
        assert data["currency"] == created_trip.currency
        # Check budget calculations if total_budget is set
        if created_trip.total_budget:
            assert "remaining_budget" in data
            assert "budget_percentage" in data

    @pytest.mark.asyncio
    async def test_get_trip_budget_no_pois(
        self,
        client: AsyncClient,
        created_trip: Trip
    ):
        """Test budget summary with no POIs returns zeros."""
        response = await client.get(f"/api/v1/trips/{created_trip.id}/budget")

        assert response.status_code == 200
        data = response.json()
        assert data["estimated_total"] == "0"
        assert data["actual_total"] == "0"

    @pytest.mark.asyncio
    async def test_get_trip_budget_not_found(self, client: AsyncClient):
        """Test budget endpoint returns 404 for non-existent trip."""
        response = await client.get("/api/v1/trips/99999/budget")

        assert response.status_code == 404


class TestTripsAPIValidation:
    """Tests for input validation on Trips API."""

    @pytest.mark.asyncio
    async def test_create_trip_empty_name(self, client: AsyncClient):
        """Test that empty name is rejected."""
        data = {
            "name": "",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=5))
        }

        response = await client.post("/api/v1/trips/", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_name_too_long(self, client: AsyncClient):
        """Test that name over 255 chars is rejected."""
        data = {
            "name": "A" * 300,
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=5))
        }

        response = await client.post("/api/v1/trips/", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_invalid_currency(self, client: AsyncClient):
        """Test that currency must be 3 characters."""
        data = {
            "name": "Test Trip",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=5)),
            "currency": "EURO"  # 4 chars, should fail
        }

        response = await client.post("/api/v1/trips/", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_negative_budget(self, client: AsyncClient):
        """Test that negative budget is rejected."""
        data = {
            "name": "Test Trip",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=5)),
            "total_budget": "-100.00"
        }

        response = await client.post("/api/v1/trips/", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_invalid_date_format(self, client: AsyncClient):
        """Test that invalid date format is rejected."""
        data = {
            "name": "Test Trip",
            "start_date": "2026/01/01",  # Wrong format
            "end_date": str(date.today() + timedelta(days=5))
        }

        response = await client.post("/api/v1/trips/", json=data)
        assert response.status_code == 422

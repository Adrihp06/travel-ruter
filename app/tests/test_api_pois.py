"""
Integration tests for POIs API endpoints.
Tests CRUD operations, voting, and category grouping.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI


class TestPOIsAPI:
    """Integration tests for /api/v1/pois endpoints."""

    @pytest.mark.asyncio
    async def test_create_poi(
        self,
        client: AsyncClient,
        created_destination: Destination,
        sample_poi_data: dict
    ):
        """Test POST /api/v1/pois - create a new POI."""
        data = {**sample_poi_data, "destination_id": created_destination.id}

        response = await client.post("/api/v1/pois", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["name"] == data["name"]
        assert result["category"] == data["category"]
        assert result["destination_id"] == created_destination.id
        assert result["likes"] == 0
        assert result["vetoes"] == 0
        assert "id" in result

    @pytest.mark.asyncio
    async def test_create_poi_minimal(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test creating a POI with minimal required fields."""
        minimal_data = {
            "destination_id": created_destination.id,
            "name": "Simple POI",
            "category": "Restaurant"
        }

        response = await client.post("/api/v1/pois", json=minimal_data)

        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "Simple POI"
        assert result["currency"] == "USD"  # default
        assert result["priority"] == 0  # default

    @pytest.mark.asyncio
    async def test_create_poi_with_coordinates(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test creating a POI with latitude/longitude."""
        data = {
            "destination_id": created_destination.id,
            "name": "Geo POI",
            "category": "Landmark",
            "latitude": 48.8584,
            "longitude": 2.2945
        }

        response = await client.post("/api/v1/pois", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["latitude"] == 48.8584
        assert result["longitude"] == 2.2945

    @pytest.mark.asyncio
    async def test_create_poi_with_costs(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test creating a POI with cost information."""
        data = {
            "destination_id": created_destination.id,
            "name": "Paid Attraction",
            "category": "Museum",
            "estimated_cost": "25.00",
            "actual_cost": "22.50",
            "currency": "EUR"
        }

        response = await client.post("/api/v1/pois", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["estimated_cost"] == "25.00"
        assert result["actual_cost"] == "22.50"
        assert result["currency"] == "EUR"

    @pytest.mark.asyncio
    async def test_create_poi_destination_not_found(self, client: AsyncClient):
        """Test creating POI with non-existent destination fails."""
        data = {
            "destination_id": 99999,
            "name": "Test POI",
            "category": "Test"
        }

        response = await client.post("/api/v1/pois", json=data)

        assert response.status_code == 404
        assert "Destination" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_list_pois_by_destination_grouped(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_destination: Destination
    ):
        """Test GET /api/v1/destinations/{destination_id}/pois - list POIs grouped by category."""
        # Create POIs in different categories
        poi1 = POI(
            destination_id=created_destination.id,
            name="Restaurant 1",
            category="Food",
            priority=1
        )
        poi2 = POI(
            destination_id=created_destination.id,
            name="Restaurant 2",
            category="Food",
            priority=2
        )
        poi3 = POI(
            destination_id=created_destination.id,
            name="Museum",
            category="Culture",
            priority=1
        )
        db.add(poi1)
        db.add(poi2)
        db.add(poi3)
        await db.flush()

        response = await client.get(
            f"/api/v1/destinations/{created_destination.id}/pois"
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert isinstance(data["items"], list)
        assert data["total"] >= 3

        # Check that results are grouped by category
        categories = [item["category"] for item in data["items"]]
        assert "Food" in categories
        assert "Culture" in categories

        # Check that each category has its POIs
        for item in data["items"]:
            if item["category"] == "Food":
                assert len(item["pois"]) >= 2

    @pytest.mark.asyncio
    async def test_list_pois_destination_not_found(self, client: AsyncClient):
        """Test listing POIs for non-existent destination returns 404."""
        response = await client.get("/api/v1/destinations/99999/pois")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_poi_by_id(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test GET /api/v1/pois/{id} - get specific POI."""
        response = await client.get(f"/api/v1/pois/{created_poi.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_poi.id
        assert data["name"] == created_poi.name

    @pytest.mark.asyncio
    async def test_get_poi_not_found(self, client: AsyncClient):
        """Test GET POI returns 404 for non-existent POI."""
        response = await client.get("/api/v1/pois/99999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_poi(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test PUT /api/v1/pois/{id} - update POI."""
        update_data = {
            "name": "Updated POI Name",
            "description": "New description",
            "priority": 5
        }

        response = await client.put(
            f"/api/v1/pois/{created_poi.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated POI Name"
        assert data["description"] == "New description"
        assert data["priority"] == 5
        # Original values preserved
        assert data["category"] == created_poi.category

    @pytest.mark.asyncio
    async def test_update_poi_coordinates(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test updating POI coordinates."""
        response = await client.put(
            f"/api/v1/pois/{created_poi.id}",
            json={"latitude": 40.7128, "longitude": -74.0060}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["latitude"] == 40.7128
        assert data["longitude"] == -74.0060

    @pytest.mark.asyncio
    async def test_update_poi_not_found(self, client: AsyncClient):
        """Test updating non-existent POI returns 404."""
        response = await client.put(
            "/api/v1/pois/99999",
            json={"name": "Updated"}
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_poi(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_destination: Destination
    ):
        """Test DELETE /api/v1/pois/{id} - delete POI."""
        # Create POI to delete
        poi = POI(
            destination_id=created_destination.id,
            name="To Delete",
            category="Test"
        )
        db.add(poi)
        await db.flush()
        poi_id = poi.id

        response = await client.delete(f"/api/v1/pois/{poi_id}")

        assert response.status_code == 204

        # Verify deletion
        get_response = await client.get(f"/api/v1/pois/{poi_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_poi_not_found(self, client: AsyncClient):
        """Test deleting non-existent POI returns 404."""
        response = await client.delete("/api/v1/pois/99999")

        assert response.status_code == 404


class TestPOIVoting:
    """Tests for POI voting functionality."""

    @pytest.mark.asyncio
    async def test_vote_like(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test POST /api/v1/pois/{id}/vote - like a POI."""
        response = await client.post(
            f"/api/v1/pois/{created_poi.id}/vote",
            json={"type": "like"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["likes"] == created_poi.likes + 1
        assert data["vetoes"] == created_poi.vetoes

    @pytest.mark.asyncio
    async def test_vote_veto(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test POST /api/v1/pois/{id}/vote - veto a POI."""
        response = await client.post(
            f"/api/v1/pois/{created_poi.id}/vote",
            json={"type": "veto"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vetoes"] == created_poi.vetoes + 1
        assert data["likes"] == created_poi.likes

    @pytest.mark.asyncio
    async def test_vote_multiple_times(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_destination: Destination
    ):
        """Test voting multiple times accumulates votes."""
        poi = POI(
            destination_id=created_destination.id,
            name="Popular POI",
            category="Test"
        )
        db.add(poi)
        await db.flush()

        # Vote like 3 times
        for _ in range(3):
            response = await client.post(
                f"/api/v1/pois/{poi.id}/vote",
                json={"type": "like"}
            )
            assert response.status_code == 200

        # Vote veto 2 times
        for _ in range(2):
            response = await client.post(
                f"/api/v1/pois/{poi.id}/vote",
                json={"type": "veto"}
            )
            assert response.status_code == 200

        # Check final counts
        response = await client.get(f"/api/v1/pois/{poi.id}")
        data = response.json()
        assert data["likes"] == 3
        assert data["vetoes"] == 2

    @pytest.mark.asyncio
    async def test_vote_invalid_type(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test voting with invalid type fails."""
        response = await client.post(
            f"/api/v1/pois/{created_poi.id}/vote",
            json={"type": "invalid"}
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_vote_poi_not_found(self, client: AsyncClient):
        """Test voting on non-existent POI returns 404."""
        response = await client.post(
            "/api/v1/pois/99999/vote",
            json={"type": "like"}
        )

        assert response.status_code == 404


class TestPOIsAPIValidation:
    """Tests for input validation on POIs API."""

    @pytest.mark.asyncio
    async def test_create_poi_empty_name(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test that empty name is rejected."""
        data = {
            "destination_id": created_destination.id,
            "name": "",
            "category": "Test"
        }

        response = await client.post("/api/v1/pois", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_poi_empty_category(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test that empty category is rejected."""
        data = {
            "destination_id": created_destination.id,
            "name": "Test POI",
            "category": ""
        }

        response = await client.post("/api/v1/pois", json=data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_poi_with_metadata(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test creating POI with metadata_json."""
        data = {
            "destination_id": created_destination.id,
            "name": "POI with Metadata",
            "category": "Test",
            "metadata_json": {
                "opening_hours": "9am-5pm",
                "phone": "+1-234-567-8900",
                "website": "https://example.com"
            }
        }

        response = await client.post("/api/v1/pois", json=data)

        assert response.status_code == 201
        result = response.json()
        assert result["metadata_json"]["opening_hours"] == "9am-5pm"

    @pytest.mark.asyncio
    async def test_create_poi_with_files(
        self,
        client: AsyncClient,
        created_destination: Destination
    ):
        """Test creating POI with files array."""
        data = {
            "destination_id": created_destination.id,
            "name": "POI with Files",
            "category": "Test",
            "files": [
                {"url": "https://example.com/photo1.jpg", "type": "image"},
                {"url": "https://example.com/menu.pdf", "type": "document"}
            ]
        }

        response = await client.post("/api/v1/pois", json=data)

        assert response.status_code == 201
        result = response.json()
        assert len(result["files"]) == 2


class TestPOIPriority:
    """Tests for POI priority functionality."""

    @pytest.mark.asyncio
    async def test_pois_ordered_by_priority(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_destination: Destination
    ):
        """Test that POIs are ordered by priority within category."""
        # Create POIs with different priorities in same category
        poi_low = POI(
            destination_id=created_destination.id,
            name="Low Priority",
            category="SameCategory",
            priority=1
        )
        poi_high = POI(
            destination_id=created_destination.id,
            name="High Priority",
            category="SameCategory",
            priority=10
        )
        poi_medium = POI(
            destination_id=created_destination.id,
            name="Medium Priority",
            category="SameCategory",
            priority=5
        )
        db.add(poi_low)
        db.add(poi_high)
        db.add(poi_medium)
        await db.flush()

        response = await client.get(
            f"/api/v1/destinations/{created_destination.id}/pois"
        )

        assert response.status_code == 200
        data = response.json()

        # Find SameCategory group
        same_category = None
        for item in data["items"]:
            if item["category"] == "SameCategory":
                same_category = item
                break

        assert same_category is not None
        # POIs should be ordered by priority descending
        priorities = [p["priority"] for p in same_category["pois"]]
        assert priorities == sorted(priorities, reverse=True)

    @pytest.mark.asyncio
    async def test_list_pois_with_pagination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_destination: Destination
    ):
        """Test pagination parameters on list POIs."""
        # Create multiple POIs
        for i in range(10):
            poi = POI(
                destination_id=created_destination.id,
                name=f"POI{i}",
                category="TestCategory",
                priority=i
            )
            db.add(poi)
        await db.flush()

        # Test with skip and limit
        response = await client.get(
            f"/api/v1/destinations/{created_destination.id}/pois?skip=2&limit=3"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["skip"] == 2
        assert data["limit"] == 3
        assert data["total"] >= 10

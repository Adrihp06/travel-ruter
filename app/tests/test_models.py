"""
Unit tests for database models.
Tests model creation, relationships, hybrid properties, and validation.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.models.accommodation import Accommodation
from app.models.document import Document, DocumentType
from app.models.route import Route


class TestTripModel:
    """Tests for the Trip model."""

    @pytest.mark.asyncio
    async def test_create_trip(self, db: AsyncSession):
        """Test creating a trip with all fields."""
        trip = Trip(
            name="Summer Vacation",
            description="Beach holiday",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 15),
            total_budget=Decimal("3000.00"),
            currency="USD",
            status="planning"
        )
        db.add(trip)
        await db.flush()
        await db.refresh(trip)

        assert trip.id is not None
        assert trip.name == "Summer Vacation"
        assert trip.description == "Beach holiday"
        assert trip.start_date == date(2026, 7, 1)
        assert trip.end_date == date(2026, 7, 15)
        assert trip.total_budget == Decimal("3000.00")
        assert trip.currency == "USD"
        assert trip.status == "planning"
        assert trip.created_at is not None
        assert trip.updated_at is not None

    @pytest.mark.asyncio
    async def test_trip_nights_calculation(self, db: AsyncSession):
        """Test that nights hybrid property calculates correctly."""
        trip = Trip(
            name="Week Trip",
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 8),
            status="planning"
        )
        db.add(trip)
        await db.flush()

        assert trip.nights == 7  # 8 - 1 = 7 nights

    @pytest.mark.asyncio
    async def test_trip_nights_same_day(self, db: AsyncSession):
        """Test nights calculation when start and end date are the same."""
        trip = Trip(
            name="Day Trip",
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 1),
            status="planning"
        )
        db.add(trip)
        await db.flush()

        assert trip.nights == 0

    @pytest.mark.asyncio
    async def test_trip_default_values(self, db: AsyncSession):
        """Test trip default values."""
        trip = Trip(
            name="Basic Trip",
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 5)
        )
        db.add(trip)
        await db.flush()
        await db.refresh(trip)

        assert trip.currency == "USD"
        assert trip.status == "planning"
        assert trip.description is None
        assert trip.total_budget is None

    @pytest.mark.asyncio
    async def test_trip_repr(self, db: AsyncSession):
        """Test trip string representation."""
        trip = Trip(
            name="Test Trip",
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 5),
            status="planning"
        )
        db.add(trip)
        await db.flush()

        repr_str = repr(trip)
        assert "Trip" in repr_str
        assert "Test Trip" in repr_str


class TestDestinationModel:
    """Tests for the Destination model."""

    @pytest.mark.asyncio
    async def test_create_destination(self, db: AsyncSession, created_trip: Trip):
        """Test creating a destination with all fields."""
        dest = Destination(
            trip_id=created_trip.id,
            city_name="Tokyo",
            country="Japan",
            arrival_date=date(2026, 7, 1),
            departure_date=date(2026, 7, 5),
            notes="Visit temples",
            order_index=0,
            name="Tokyo City",
            description="Capital of Japan",
            address="Tokyo, Japan",
            latitude=35.6762,
            longitude=139.6503
        )
        db.add(dest)
        await db.flush()
        await db.refresh(dest)

        assert dest.id is not None
        assert dest.trip_id == created_trip.id
        assert dest.city_name == "Tokyo"
        assert dest.country == "Japan"
        assert dest.latitude == 35.6762
        assert dest.longitude == 139.6503

    @pytest.mark.asyncio
    async def test_destination_trip_relationship(
        self, db: AsyncSession, created_trip: Trip
    ):
        """Test destination-trip relationship."""
        dest = Destination(
            trip_id=created_trip.id,
            city_name="London",
            country="UK",
            arrival_date=date(2026, 7, 1),
            departure_date=date(2026, 7, 5),
            order_index=0
        )
        db.add(dest)
        await db.flush()
        await db.refresh(dest)
        await db.refresh(created_trip)

        assert dest.trip == created_trip
        assert dest in created_trip.destinations

    @pytest.mark.asyncio
    async def test_destination_cascade_delete(self, db: AsyncSession):
        """Test that deleting a trip cascades to destinations."""
        trip = Trip(
            name="Cascade Test Trip",
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 10),
            status="planning"
        )
        db.add(trip)
        await db.flush()
        await db.refresh(trip)

        dest = Destination(
            trip_id=trip.id,
            city_name="Berlin",
            country="Germany",
            arrival_date=date(2026, 6, 1),
            departure_date=date(2026, 6, 5),
            order_index=0
        )
        db.add(dest)
        await db.flush()
        dest_id = dest.id

        # Delete the trip
        await db.delete(trip)
        await db.flush()

        # Check destination is also deleted
        result = await db.execute(
            select(Destination).where(Destination.id == dest_id)
        )
        assert result.scalar_one_or_none() is None


class TestPOIModel:
    """Tests for the POI model."""

    @pytest.mark.asyncio
    async def test_create_poi(self, db: AsyncSession, created_destination: Destination):
        """Test creating a POI with all fields."""
        poi = POI(
            destination_id=created_destination.id,
            name="Big Ben",
            category="Sightseeing",
            description="Famous clock tower",
            address="Westminster, London",
            estimated_cost=Decimal("0.00"),
            actual_cost=Decimal("0.00"),
            currency="GBP",
            dwell_time=60,
            likes=0,
            vetoes=0,
            priority=1,
            external_id="google_place_123",
            external_source="google_places"
        )
        db.add(poi)
        await db.flush()
        await db.refresh(poi)

        assert poi.id is not None
        assert poi.name == "Big Ben"
        assert poi.category == "Sightseeing"
        assert poi.dwell_time == 60
        assert poi.likes == 0
        assert poi.vetoes == 0

    @pytest.mark.asyncio
    async def test_poi_default_values(
        self, db: AsyncSession, created_destination: Destination
    ):
        """Test POI default values."""
        poi = POI(
            destination_id=created_destination.id,
            name="Test POI",
            category="Restaurant"
        )
        db.add(poi)
        await db.flush()
        await db.refresh(poi)

        assert poi.currency == "USD"
        assert poi.likes == 0
        assert poi.vetoes == 0
        assert poi.priority == 0

    @pytest.mark.asyncio
    async def test_poi_votes(self, db: AsyncSession, created_destination: Destination):
        """Test POI like and veto functionality."""
        poi = POI(
            destination_id=created_destination.id,
            name="Popular Spot",
            category="Cafe"
        )
        db.add(poi)
        await db.flush()

        # Simulate voting
        poi.likes += 1
        poi.likes += 1
        poi.vetoes += 1
        await db.flush()
        await db.refresh(poi)

        assert poi.likes == 2
        assert poi.vetoes == 1

    @pytest.mark.asyncio
    async def test_poi_json_fields(
        self, db: AsyncSession, created_destination: Destination
    ):
        """Test POI JSON fields (files and metadata)."""
        poi = POI(
            destination_id=created_destination.id,
            name="JSON Test POI",
            category="Museum",
            files=[{"url": "http://example.com/photo1.jpg", "type": "image"}],
            metadata_json={"opening_hours": "9am-5pm", "website": "http://museum.com"}
        )
        db.add(poi)
        await db.flush()
        await db.refresh(poi)

        assert poi.files == [{"url": "http://example.com/photo1.jpg", "type": "image"}]
        assert poi.metadata_json["opening_hours"] == "9am-5pm"


class TestAccommodationModel:
    """Tests for the Accommodation model."""

    @pytest.mark.asyncio
    async def test_create_accommodation(
        self, db: AsyncSession, created_destination: Destination
    ):
        """Test creating an accommodation with all fields."""
        acc = Accommodation(
            destination_id=created_destination.id,
            name="Grand Hotel",
            type="hotel",
            address="123 Main St",
            check_in_date=date(2026, 7, 1),
            check_out_date=date(2026, 7, 5),
            booking_reference="REF123",
            booking_url="http://booking.com/ref123",
            total_cost=Decimal("500.00"),
            currency="EUR",
            is_paid=True,
            rating=Decimal("4.5"),
            review="Great stay!",
            amenities=["wifi", "pool", "spa"],
            contact_info={"phone": "+1-234-567-8900", "email": "hotel@example.com"}
        )
        db.add(acc)
        await db.flush()
        await db.refresh(acc)

        assert acc.id is not None
        assert acc.name == "Grand Hotel"
        assert acc.type == "hotel"
        assert acc.is_paid is True
        assert acc.rating == Decimal("4.5")
        assert "wifi" in acc.amenities

    @pytest.mark.asyncio
    async def test_accommodation_default_values(
        self, db: AsyncSession, created_destination: Destination
    ):
        """Test accommodation default values."""
        acc = Accommodation(
            destination_id=created_destination.id,
            name="Basic Hostel",
            type="hostel",
            check_in_date=date(2026, 7, 1),
            check_out_date=date(2026, 7, 3)
        )
        db.add(acc)
        await db.flush()
        await db.refresh(acc)

        assert acc.currency == "USD"
        assert acc.is_paid is False

    @pytest.mark.asyncio
    async def test_accommodation_destination_relationship(
        self, db: AsyncSession, created_destination: Destination
    ):
        """Test accommodation-destination relationship."""
        acc = Accommodation(
            destination_id=created_destination.id,
            name="Relationship Test Hotel",
            type="hotel",
            check_in_date=date(2026, 7, 1),
            check_out_date=date(2026, 7, 3)
        )
        db.add(acc)
        await db.flush()
        await db.refresh(acc)
        await db.refresh(created_destination)

        assert acc.destination == created_destination
        assert acc in created_destination.accommodations


class TestDocumentModel:
    """Tests for the Document model."""

    @pytest.mark.asyncio
    async def test_create_document_for_poi(
        self, db: AsyncSession, created_poi: POI
    ):
        """Test creating a document linked to a POI."""
        doc = Document(
            filename="uuid-file.pdf",
            original_filename="ticket.pdf",
            file_path="/app/documents/pois/1/uuid-file.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type=DocumentType.TICKET.value,
            title="Flight Ticket",
            description="Round trip to Paris",
            poi_id=created_poi.id
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)

        assert doc.id is not None
        assert doc.poi_id == created_poi.id
        assert doc.trip_id is None
        assert doc.document_type == "ticket"
        assert doc.file_size == 1024

    @pytest.mark.asyncio
    async def test_create_document_for_trip(
        self, db: AsyncSession, created_trip: Trip
    ):
        """Test creating a document linked to a trip."""
        doc = Document(
            filename="uuid-file.pdf",
            original_filename="itinerary.pdf",
            file_path="/app/documents/trips/1/uuid-file.pdf",
            file_size=2048,
            mime_type="application/pdf",
            document_type=DocumentType.OTHER.value,
            title="Trip Itinerary",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)

        assert doc.id is not None
        assert doc.trip_id == created_trip.id
        assert doc.poi_id is None

    @pytest.mark.asyncio
    async def test_document_types(self, db: AsyncSession, created_trip: Trip):
        """Test all document type values."""
        doc_types = [
            DocumentType.TICKET,
            DocumentType.CONFIRMATION,
            DocumentType.RESERVATION,
            DocumentType.RECEIPT,
            DocumentType.MAP,
            DocumentType.OTHER
        ]

        for doc_type in doc_types:
            doc = Document(
                filename=f"test-{doc_type.value}.pdf",
                original_filename=f"{doc_type.value}.pdf",
                file_path=f"/app/documents/{doc_type.value}.pdf",
                file_size=100,
                mime_type="application/pdf",
                document_type=doc_type.value,
                trip_id=created_trip.id
            )
            db.add(doc)

        await db.flush()

        result = await db.execute(
            select(Document).where(Document.trip_id == created_trip.id)
        )
        docs = result.scalars().all()
        assert len(docs) == len(doc_types)


class TestRouteModel:
    """Tests for the Route model."""

    @pytest.mark.asyncio
    async def test_create_route(self, db: AsyncSession):
        """Test creating a route with all fields."""
        route = Route(
            name="Paris to Lyon",
            description="Highway route",
            start_location="Paris",
            end_location="Lyon",
            distance=465.5,
            duration=270.0,
            metadata_json={
                "toll_roads": True,
                "fuel_stops": ["Beaune"]
            }
        )
        db.add(route)
        await db.flush()
        await db.refresh(route)

        assert route.id is not None
        assert route.name == "Paris to Lyon"
        assert route.distance == 465.5
        assert route.duration == 270.0
        assert route.metadata_json["toll_roads"] is True

    @pytest.mark.asyncio
    async def test_route_optional_fields(self, db: AsyncSession):
        """Test route with only required fields."""
        route = Route(
            name="Short Walk",
            start_location="Hotel",
            end_location="Restaurant"
        )
        db.add(route)
        await db.flush()
        await db.refresh(route)

        assert route.id is not None
        assert route.description is None
        assert route.distance is None
        assert route.duration is None
        assert route.geometry is None
        assert route.metadata_json is None


class TestModelRelationships:
    """Tests for complex model relationships."""

    @pytest.mark.asyncio
    async def test_full_hierarchy(self, db: AsyncSession):
        """Test creating a full hierarchy: Trip -> Destination -> POI/Accommodation."""
        # Create trip
        trip = Trip(
            name="Full Test Trip",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 15),
            status="planning"
        )
        db.add(trip)
        await db.flush()

        # Create destination
        dest = Destination(
            trip_id=trip.id,
            city_name="Rome",
            country="Italy",
            arrival_date=date(2026, 8, 1),
            departure_date=date(2026, 8, 7),
            order_index=0
        )
        db.add(dest)
        await db.flush()

        # Create POIs
        poi1 = POI(
            destination_id=dest.id,
            name="Colosseum",
            category="Historical"
        )
        poi2 = POI(
            destination_id=dest.id,
            name="Trevi Fountain",
            category="Landmark"
        )
        db.add(poi1)
        db.add(poi2)

        # Create accommodation
        acc = Accommodation(
            destination_id=dest.id,
            name="Rome Hotel",
            type="hotel",
            check_in_date=date(2026, 8, 1),
            check_out_date=date(2026, 8, 7)
        )
        db.add(acc)
        await db.flush()

        # Refresh and verify relationships
        await db.refresh(trip)
        await db.refresh(dest)

        assert len(trip.destinations) == 1
        assert len(dest.pois) == 2
        assert len(dest.accommodations) == 1
        assert dest.trip == trip

    @pytest.mark.asyncio
    async def test_cascade_delete_full_hierarchy(self, db: AsyncSession):
        """Test that deleting a trip cascades through all children."""
        # Create full hierarchy
        trip = Trip(
            name="Cascade Delete Test",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 10),
            status="planning"
        )
        db.add(trip)
        await db.flush()

        dest = Destination(
            trip_id=trip.id,
            city_name="Madrid",
            country="Spain",
            arrival_date=date(2026, 9, 1),
            departure_date=date(2026, 9, 5),
            order_index=0
        )
        db.add(dest)
        await db.flush()

        poi = POI(
            destination_id=dest.id,
            name="Prado Museum",
            category="Museum"
        )
        acc = Accommodation(
            destination_id=dest.id,
            name="Madrid Hotel",
            type="hotel",
            check_in_date=date(2026, 9, 1),
            check_out_date=date(2026, 9, 5)
        )
        db.add(poi)
        db.add(acc)
        await db.flush()

        # Store IDs
        dest_id = dest.id
        poi_id = poi.id
        acc_id = acc.id

        # Delete trip
        await db.delete(trip)
        await db.flush()

        # Verify all children are deleted
        result = await db.execute(
            select(Destination).where(Destination.id == dest_id)
        )
        assert result.scalar_one_or_none() is None

        result = await db.execute(select(POI).where(POI.id == poi_id))
        assert result.scalar_one_or_none() is None

        result = await db.execute(
            select(Accommodation).where(Accommodation.id == acc_id)
        )
        assert result.scalar_one_or_none() is None

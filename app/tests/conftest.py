"""
Test configuration and fixtures for Travel Ruter backend tests.
"""
import os
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import tempfile
import shutil

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db, Base
from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.models.accommodation import Accommodation
from app.models.document import Document
from app.models.route import Route
from app.models.user import User
from app.models.trip_member import TripMember


# Test database URL - use SQLite for unit tests, PostgreSQL for integration tests
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/travel_ruter_test"
)

# For SQLite in-memory tests (useful for CI without PostgreSQL)
SQLITE_TEST_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=StaticPool if "sqlite" in TEST_DATABASE_URL else None,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for testing API endpoints."""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ============================================================================
# Sample Data Fixtures
# ============================================================================

@pytest.fixture
def sample_trip_data() -> dict:
    """Return sample trip data for testing."""
    return {
        "name": "Test European Adventure",
        "description": "A test trip through Europe",
        "start_date": str(date.today() + timedelta(days=30)),
        "end_date": str(date.today() + timedelta(days=45)),
        "total_budget": "5000.00",
        "currency": "EUR",
        "status": "planning"
    }


@pytest.fixture
def sample_destination_data() -> dict:
    """Return sample destination data for testing."""
    return {
        "city_name": "Paris",
        "country": "France",
        "arrival_date": str(date.today() + timedelta(days=30)),
        "departure_date": str(date.today() + timedelta(days=35)),
        "notes": "Visit the Eiffel Tower",
        "order_index": 0,
        "name": "Paris City Center",
        "description": "Beautiful city of lights",
        "address": "Paris, France",
        "latitude": 48.8566,
        "longitude": 2.3522
    }


@pytest.fixture
def sample_poi_data() -> dict:
    """Return sample POI data for testing."""
    return {
        "name": "Eiffel Tower",
        "category": "Sightseeing",
        "description": "Iconic iron lattice tower",
        "address": "Champ de Mars, 5 Avenue Anatole France, 75007 Paris",
        "latitude": 48.8584,
        "longitude": 2.2945,
        "estimated_cost": "25.00",
        "currency": "EUR",
        "dwell_time": 120,
        "priority": 1
    }


@pytest.fixture
def sample_accommodation_data() -> dict:
    """Return sample accommodation data for testing."""
    return {
        "name": "Hotel Parisien",
        "type": "hotel",
        "address": "123 Rue de Rivoli, Paris",
        "check_in_date": str(date.today() + timedelta(days=30)),
        "check_out_date": str(date.today() + timedelta(days=35)),
        "booking_reference": "BOOK123456",
        "total_cost": "750.00",
        "currency": "EUR",
        "is_paid": False,
        "rating": "4.5",
        "amenities": ["wifi", "breakfast", "gym"]
    }


@pytest.fixture
async def created_trip(db: AsyncSession, sample_trip_data: dict) -> Trip:
    """Create and return a trip in the database."""
    trip = Trip(
        name=sample_trip_data["name"],
        description=sample_trip_data["description"],
        start_date=date.fromisoformat(sample_trip_data["start_date"]),
        end_date=date.fromisoformat(sample_trip_data["end_date"]),
        total_budget=Decimal(sample_trip_data["total_budget"]),
        currency=sample_trip_data["currency"],
        status=sample_trip_data["status"]
    )
    db.add(trip)
    await db.flush()
    await db.refresh(trip)
    return trip


@pytest.fixture
async def created_destination(
    db: AsyncSession,
    created_trip: Trip,
    sample_destination_data: dict
) -> Destination:
    """Create and return a destination in the database."""
    dest = Destination(
        trip_id=created_trip.id,
        city_name=sample_destination_data["city_name"],
        country=sample_destination_data["country"],
        arrival_date=date.fromisoformat(sample_destination_data["arrival_date"]),
        departure_date=date.fromisoformat(sample_destination_data["departure_date"]),
        notes=sample_destination_data["notes"],
        order_index=sample_destination_data["order_index"],
        name=sample_destination_data.get("name"),
        description=sample_destination_data.get("description"),
        address=sample_destination_data.get("address"),
        latitude=sample_destination_data.get("latitude"),
        longitude=sample_destination_data.get("longitude")
    )
    db.add(dest)
    await db.flush()
    await db.refresh(dest)
    return dest


@pytest.fixture
async def created_poi(
    db: AsyncSession,
    created_destination: Destination,
    sample_poi_data: dict
) -> POI:
    """Create and return a POI in the database."""
    poi = POI(
        destination_id=created_destination.id,
        name=sample_poi_data["name"],
        category=sample_poi_data["category"],
        description=sample_poi_data["description"],
        address=sample_poi_data["address"],
        estimated_cost=Decimal(sample_poi_data["estimated_cost"]),
        currency=sample_poi_data["currency"],
        dwell_time=sample_poi_data["dwell_time"],
        priority=sample_poi_data["priority"]
    )
    db.add(poi)
    await db.flush()
    await db.refresh(poi)
    return poi


@pytest.fixture
async def created_accommodation(
    db: AsyncSession,
    created_destination: Destination,
    sample_accommodation_data: dict
) -> Accommodation:
    """Create and return an accommodation in the database."""
    from app.services.geospatial_service import GeospatialService

    acc = Accommodation(
        destination_id=created_destination.id,
        name=sample_accommodation_data["name"],
        type=sample_accommodation_data["type"],
        address=sample_accommodation_data["address"],
        check_in_date=date.fromisoformat(sample_accommodation_data["check_in_date"]),
        check_out_date=date.fromisoformat(sample_accommodation_data["check_out_date"]),
        booking_reference=sample_accommodation_data["booking_reference"],
        total_cost=Decimal(sample_accommodation_data["total_cost"]),
        currency=sample_accommodation_data["currency"],
        is_paid=sample_accommodation_data["is_paid"],
        rating=Decimal(sample_accommodation_data["rating"]),
        amenities=sample_accommodation_data["amenities"],
        # Set coordinates for Paris
        coordinates=GeospatialService.create_point(48.8566, 2.3522)
    )
    db.add(acc)
    await db.flush()
    await db.refresh(acc)
    return acc


# ============================================================================
# Auth Fixtures
# ============================================================================

@pytest.fixture
async def created_user(db: AsyncSession) -> User:
    """Create a test user and return it."""
    user = User(
        email="test@example.com",
        name="Test User",
        oauth_provider="google",
        oauth_id="123",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def second_user(db: AsyncSession) -> User:
    """Create a second test user for collaboration tests."""
    user = User(
        email="other@example.com",
        name="Other User",
        oauth_provider="github",
        oauth_id="456",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
async def inactive_user(db: AsyncSession) -> User:
    """Create an inactive test user."""
    user = User(
        email="inactive@example.com",
        name="Inactive User",
        oauth_provider="google",
        oauth_id="789",
        is_active=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest.fixture
def auth_token(created_user: User) -> str:
    """Generate a valid JWT for the test user."""
    from app.services.auth_service import create_access_token
    return create_access_token(created_user.id)


@pytest.fixture
def second_auth_token(second_user: User) -> str:
    """Generate a valid JWT for the second test user."""
    from app.services.auth_service import create_access_token
    return create_access_token(second_user.id)


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """HTTP headers with valid Bearer token."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def second_auth_headers(second_auth_token: str) -> dict:
    """HTTP headers with valid Bearer token for second user."""
    return {"Authorization": f"Bearer {second_auth_token}"}


@pytest.fixture
async def authenticated_client(client: AsyncClient, auth_headers: dict) -> AsyncClient:
    """AsyncClient that sends authenticated requests."""
    client.headers.update(auth_headers)
    return client


@pytest.fixture
async def trip_with_owner(db: AsyncSession, created_user: User, sample_trip_data: dict) -> Trip:
    """Create a trip with the test user as owner."""
    trip = Trip(
        name=sample_trip_data["name"],
        description=sample_trip_data["description"],
        start_date=date.fromisoformat(sample_trip_data["start_date"]),
        end_date=date.fromisoformat(sample_trip_data["end_date"]),
        total_budget=Decimal(sample_trip_data["total_budget"]),
        currency=sample_trip_data["currency"],
        status=sample_trip_data["status"],
        user_id=created_user.id,
    )
    db.add(trip)
    await db.flush()

    member = TripMember(
        trip_id=trip.id,
        user_id=created_user.id,
        role="owner",
        status="accepted",
    )
    db.add(member)
    await db.flush()
    await db.refresh(trip)
    return trip


# ============================================================================
# File Upload Fixtures
# ============================================================================

@pytest.fixture
def temp_upload_dir() -> Generator[str, None, None]:
    """Create a temporary directory for file uploads during testing."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def sample_pdf_file(temp_upload_dir: str) -> str:
    """Create a sample PDF file for testing."""
    # Create a minimal valid PDF
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
xref
0 3
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
trailer
<< /Size 3 /Root 1 0 R >>
startxref
109
%%EOF"""

    file_path = os.path.join(temp_upload_dir, "test_document.pdf")
    with open(file_path, "wb") as f:
        f.write(pdf_content)
    return file_path


@pytest.fixture
def sample_image_file(temp_upload_dir: str) -> str:
    """Create a sample JPEG file for testing."""
    # Create a minimal valid JPEG (1x1 white pixel)
    jpeg_content = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
        0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
        0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
        0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
        0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
        0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
        0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
        0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD3, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xFF, 0xD9
    ])

    file_path = os.path.join(temp_upload_dir, "test_image.jpg")
    with open(file_path, "wb") as f:
        f.write(jpeg_content)
    return file_path


# ============================================================================
# Mock Fixtures
# ============================================================================

@pytest.fixture
def mock_mapbox_response() -> dict:
    """Return a mock Mapbox API response."""
    return {
        "code": "Ok",
        "routes": [
            {
                "distance": 5000.0,  # meters
                "duration": 600.0,   # seconds
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [2.3522, 48.8566],
                        [2.2945, 48.8584]
                    ]
                }
            }
        ],
        "waypoints": [
            {"name": "Start", "location": [2.3522, 48.8566]},
            {"name": "End", "location": [2.2945, 48.8584]}
        ]
    }


@pytest.fixture
def mock_weather_response() -> dict:
    """Return a mock OpenMeteo API response."""
    return {
        "daily": {
            "temperature_2m_mean": [15.5, 16.2, 14.8, 15.9, 16.5, 15.1, 14.9]
        }
    }


@pytest.fixture
def mock_httpx_client(mock_mapbox_response: dict):
    """Create a mock httpx client for external API calls."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_mapbox_response
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    return mock_client

"""
Comprehensive tests for GeospatialService.
Tests PostGIS integration, distance calculations, and walkable radius queries.
"""
import pytest
import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement

from app.services.geospatial_service import GeospatialService
from app.models.poi import POI
from app.models.accommodation import Accommodation
from app.models.destination import Destination
from app.models.trip import Trip


class TestCreatePoint:
    """Tests for GeospatialService.create_point method."""

    def test_create_point_basic(self):
        """Test creating a basic point geometry."""
        point = GeospatialService.create_point(48.8566, 2.3522)
        # Returns an SQLAlchemy expression, not evaluated yet
        assert point is not None

    def test_create_point_with_srid(self):
        """Test creating a point with custom SRID."""
        point = GeospatialService.create_point(48.8566, 2.3522, srid=4326)
        assert point is not None

    def test_create_point_equator(self):
        """Test creating a point at the equator."""
        point = GeospatialService.create_point(0.0, 0.0)
        assert point is not None

    def test_create_point_extreme_latitudes(self):
        """Test creating points at extreme latitudes."""
        # Near North Pole
        point_north = GeospatialService.create_point(89.0, 0.0)
        assert point_north is not None

        # Near South Pole
        point_south = GeospatialService.create_point(-89.0, 0.0)
        assert point_south is not None

    def test_create_point_extreme_longitudes(self):
        """Test creating points at extreme longitudes."""
        point_east = GeospatialService.create_point(0.0, 179.0)
        assert point_east is not None

        point_west = GeospatialService.create_point(0.0, -179.0)
        assert point_west is not None


class TestCalculateDistance:
    """Tests for GeospatialService.calculate_distance method."""

    @pytest.mark.asyncio
    async def test_calculate_distance_new_york_to_london(self, db: AsyncSession):
        """Test distance calculation between New York and London."""
        # New York to London
        lat1, lon1 = 40.7128, -74.0060
        lat2, lon2 = 51.5074, -0.1278

        dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)

        # Approx 5570 km = 5,570,000 meters
        assert 5500000 < dist < 5650000

    @pytest.mark.asyncio
    async def test_calculate_distance_paris_to_london(self, db: AsyncSession):
        """Test distance between Paris and London."""
        # Paris to London
        lat1, lon1 = 48.8566, 2.3522
        lat2, lon2 = 51.5074, -0.1278

        dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)

        # Approx 340 km = 340,000 meters
        assert 330000 < dist < 360000

    @pytest.mark.asyncio
    async def test_calculate_distance_same_point(self, db: AsyncSession):
        """Test that distance between same point is 0."""
        dist = await GeospatialService.calculate_distance(
            db, 48.8566, 2.3522, 48.8566, 2.3522
        )
        assert dist == pytest.approx(0.0, abs=0.1)

    @pytest.mark.asyncio
    async def test_calculate_distance_short(self, db: AsyncSession):
        """Test short distance calculation (within a city)."""
        # Paris Center to Eiffel Tower (~4.3 km)
        lat1, lon1 = 48.8566, 2.3522
        lat2, lon2 = 48.8584, 2.2945

        dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)

        # Approx 4.3 km = 4300 meters
        assert 4000 < dist < 5000

    @pytest.mark.asyncio
    async def test_calculate_distance_antipodal(self, db: AsyncSession):
        """Test distance between nearly antipodal points."""
        # New York to approximately opposite side of Earth
        lat1, lon1 = 40.7128, -74.0060
        lat2, lon2 = -40.7128, 106.0060

        dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)

        # Should be approximately half Earth's circumference (~20,000 km)
        assert 19000000 < dist < 21000000

    @pytest.mark.asyncio
    async def test_calculate_distance_across_date_line(self, db: AsyncSession):
        """Test distance calculation across the International Date Line."""
        # Tokyo to Hawaii across Pacific
        lat1, lon1 = 35.6762, 139.6503
        lat2, lon2 = 21.3069, -157.8583

        dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)

        # Approx 6200 km
        assert 6000000 < dist < 6500000


class TestWalkableRadius:
    """Tests for walkable radius geometry and POI queries."""

    @pytest.fixture
    async def test_setup(self, db: AsyncSession):
        """Set up test data for walkable radius tests."""
        # Create Trip
        trip = Trip(
            name="Geospatial Test Trip",
            start_date=datetime.date.today(),
            end_date=datetime.date.today() + datetime.timedelta(days=5),
            status="planning"
        )
        db.add(trip)
        await db.flush()
        await db.refresh(trip)

        # Create Destination
        dest = Destination(
            trip_id=trip.id,
            city_name="Test City",
            country="Test Country",
            arrival_date=trip.start_date,
            departure_date=trip.end_date,
            order_index=0
        )
        db.add(dest)
        await db.flush()
        await db.refresh(dest)

        # Create Accommodation at origin (0, 0 - Null Island for easy math)
        acc = Accommodation(
            destination_id=dest.id,
            name="Center Hotel",
            type="Hotel",
            check_in_date=trip.start_date,
            check_out_date=trip.end_date,
            coordinates=GeospatialService.create_point(0, 0)
        )
        db.add(acc)
        await db.flush()
        await db.refresh(acc)

        yield {"trip": trip, "dest": dest, "acc": acc}

        # Cleanup
        await db.delete(trip)
        await db.commit()

    @pytest.mark.asyncio
    async def test_get_walkable_radius_geometry(self, db: AsyncSession, test_setup: dict):
        """Test getting walkable radius geometry."""
        acc = test_setup["acc"]

        geometry = await GeospatialService.get_walkable_radius_geometry(
            db, acc.id, radius_km=5.0
        )

        assert geometry is not None

    @pytest.mark.asyncio
    async def test_get_walkable_radius_default(self, db: AsyncSession, test_setup: dict):
        """Test walkable radius with default 5km."""
        acc = test_setup["acc"]

        geometry = await GeospatialService.get_walkable_radius_geometry(db, acc.id)
        assert geometry is not None

    @pytest.mark.asyncio
    async def test_get_walkable_radius_accommodation_not_found(self, db: AsyncSession):
        """Test walkable radius for non-existent accommodation."""
        geometry = await GeospatialService.get_walkable_radius_geometry(db, 99999)
        assert geometry is None

    @pytest.mark.asyncio
    async def test_pois_within_walkable_radius_st_dwithin(
        self, db: AsyncSession, test_setup: dict
    ):
        """Test finding POIs within walkable radius using ST_DWithin."""
        dest = test_setup["dest"]
        acc = test_setup["acc"]

        # Create POI very close (~1.11km) -> Within 5km
        # 0.01 degrees latitude = ~1.11 km
        poi_near = POI(
            destination_id=dest.id,
            name="Near POI",
            category="Sightseeing",
            coordinates=GeospatialService.create_point(0.01, 0)
        )

        # Create POI far (~11.1km) -> Outside 5km
        poi_far = POI(
            destination_id=dest.id,
            name="Far POI",
            category="Sightseeing",
            coordinates=GeospatialService.create_point(0.1, 0)
        )

        db.add(poi_near)
        db.add(poi_far)
        await db.flush()

        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=5.0, use_st_within=False
        )
        poi_ids = [p.id for p in pois]

        assert poi_near.id in poi_ids, "Near POI should be found"
        assert poi_far.id not in poi_ids, "Far POI should not be found"

    @pytest.mark.asyncio
    async def test_pois_within_walkable_radius_st_within(
        self, db: AsyncSession, test_setup: dict
    ):
        """Test finding POIs within walkable radius using ST_Within."""
        dest = test_setup["dest"]
        acc = test_setup["acc"]

        # Create POI within radius
        poi_near = POI(
            destination_id=dest.id,
            name="Near ST_Within POI",
            category="Restaurant",
            coordinates=GeospatialService.create_point(0.02, 0)  # ~2.22km
        )

        # Create POI outside radius
        poi_far = POI(
            destination_id=dest.id,
            name="Far ST_Within POI",
            category="Restaurant",
            coordinates=GeospatialService.create_point(0.1, 0)  # ~11.1km
        )

        db.add(poi_near)
        db.add(poi_far)
        await db.flush()

        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=5.0, use_st_within=True
        )
        poi_ids = [p.id for p in pois]

        assert poi_near.id in poi_ids, "Near POI should be found with ST_Within"
        assert poi_far.id not in poi_ids, "Far POI should not be found with ST_Within"

    @pytest.mark.asyncio
    async def test_pois_within_walkable_radius_edge_case(
        self, db: AsyncSession, test_setup: dict
    ):
        """Test POI at edge of radius."""
        dest = test_setup["dest"]
        acc = test_setup["acc"]

        # Create POI at approximately 5km (edge)
        # 0.045 degrees ≈ 5km
        poi_edge = POI(
            destination_id=dest.id,
            name="Edge POI",
            category="Edge",
            coordinates=GeospatialService.create_point(0.045, 0)
        )

        # Create POI just outside 5km
        poi_outside = POI(
            destination_id=dest.id,
            name="Outside POI",
            category="Edge",
            coordinates=GeospatialService.create_point(0.05, 0)  # ~5.55km
        )

        db.add(poi_edge)
        db.add(poi_outside)
        await db.flush()

        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=5.0
        )
        poi_ids = [p.id for p in pois]

        assert poi_edge.id in poi_ids, "Edge POI should be found"
        assert poi_outside.id not in poi_ids, "Outside POI should not be found"

    @pytest.mark.asyncio
    async def test_pois_within_different_radii(self, db: AsyncSession, test_setup: dict):
        """Test POI queries with different radius values."""
        dest = test_setup["dest"]
        acc = test_setup["acc"]

        # Create POI at 3km
        poi_3km = POI(
            destination_id=dest.id,
            name="3km POI",
            category="Test",
            coordinates=GeospatialService.create_point(0.027, 0)  # ~3km
        )

        # Create POI at 7km
        poi_7km = POI(
            destination_id=dest.id,
            name="7km POI",
            category="Test",
            coordinates=GeospatialService.create_point(0.063, 0)  # ~7km
        )

        db.add(poi_3km)
        db.add(poi_7km)
        await db.flush()

        # With 5km radius
        pois_5km = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=5.0
        )
        poi_ids_5km = [p.id for p in pois_5km]

        # With 10km radius
        pois_10km = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=10.0
        )
        poi_ids_10km = [p.id for p in pois_10km]

        assert poi_3km.id in poi_ids_5km
        assert poi_7km.id not in poi_ids_5km
        assert poi_3km.id in poi_ids_10km
        assert poi_7km.id in poi_ids_10km

    @pytest.mark.asyncio
    async def test_pois_within_radius_no_coordinates(
        self, db: AsyncSession, test_setup: dict
    ):
        """Test that POIs without coordinates are not returned."""
        dest = test_setup["dest"]
        acc = test_setup["acc"]

        # Create POI without coordinates
        poi_no_coords = POI(
            destination_id=dest.id,
            name="No Coords POI",
            category="Test",
            coordinates=None
        )

        db.add(poi_no_coords)
        await db.flush()

        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=10.0
        )
        poi_ids = [p.id for p in pois]

        assert poi_no_coords.id not in poi_ids

    @pytest.mark.asyncio
    async def test_pois_within_radius_accommodation_not_found(self, db: AsyncSession):
        """Test POI query for non-existent accommodation returns empty."""
        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, 99999, radius_km=5.0
        )
        assert pois == []

    @pytest.mark.asyncio
    async def test_pois_within_radius_accommodation_no_coordinates(
        self, db: AsyncSession, test_setup: dict
    ):
        """Test POI query when accommodation has no coordinates."""
        dest = test_setup["dest"]

        # Create accommodation without coordinates
        acc_no_coords = Accommodation(
            destination_id=dest.id,
            name="No Coords Hotel",
            type="Hotel",
            check_in_date=datetime.date.today(),
            check_out_date=datetime.date.today() + datetime.timedelta(days=2),
            coordinates=None
        )
        db.add(acc_no_coords)
        await db.flush()

        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, acc_no_coords.id, radius_km=5.0
        )
        assert pois == []


class TestGeospatialRealWorldScenarios:
    """Tests with real-world coordinate scenarios."""

    @pytest.mark.asyncio
    async def test_paris_landmarks_distance(self, db: AsyncSession):
        """Test distances between Paris landmarks."""
        # Eiffel Tower
        eiffel = (48.8584, 2.2945)
        # Louvre Museum
        louvre = (48.8606, 2.3376)
        # Notre-Dame
        notre_dame = (48.8530, 2.3499)

        # Eiffel to Louvre (~3.6 km)
        dist1 = await GeospatialService.calculate_distance(
            db, eiffel[0], eiffel[1], louvre[0], louvre[1]
        )
        assert 3000 < dist1 < 4500

        # Louvre to Notre-Dame (~1.2 km)
        dist2 = await GeospatialService.calculate_distance(
            db, louvre[0], louvre[1], notre_dame[0], notre_dame[1]
        )
        assert 1000 < dist2 < 1500

    @pytest.mark.asyncio
    async def test_tokyo_landmarks_distance(self, db: AsyncSession):
        """Test distances between Tokyo landmarks."""
        # Tokyo Tower
        tokyo_tower = (35.6586, 139.7454)
        # Shibuya Crossing
        shibuya = (35.6595, 139.7004)

        dist = await GeospatialService.calculate_distance(
            db, tokyo_tower[0], tokyo_tower[1], shibuya[0], shibuya[1]
        )

        # About 4.5 km
        assert 4000 < dist < 5000

    @pytest.mark.asyncio
    async def test_intercontinental_distances(self, db: AsyncSession):
        """Test intercontinental distances."""
        # San Francisco
        sf = (37.7749, -122.4194)
        # Sydney
        sydney = (-33.8688, 151.2093)
        # Cape Town
        cape_town = (-33.9249, 18.4241)

        # SF to Sydney (~12,000 km)
        dist1 = await GeospatialService.calculate_distance(
            db, sf[0], sf[1], sydney[0], sydney[1]
        )
        assert 11500000 < dist1 < 12500000

        # Sydney to Cape Town (~11,000 km)
        dist2 = await GeospatialService.calculate_distance(
            db, sydney[0], sydney[1], cape_town[0], cape_town[1]
        )
        assert 10500000 < dist2 < 11500000


# Keep backward compatibility with original test functions
@pytest.mark.asyncio
async def test_calculate_distance(db: AsyncSession):
    """Test distance calculation between New York and London."""
    lat1, lon1 = 40.7128, -74.0060
    lat2, lon2 = 51.5074, -0.1278

    dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)

    assert 5500000 < dist < 5650000


@pytest.mark.asyncio
async def test_walkable_radius(db: AsyncSession):
    """Test finding POIs within a walkable radius."""
    # Create Trip
    trip = Trip(
        name="Geospatial Test Trip",
        start_date=datetime.date.today(),
        end_date=datetime.date.today() + datetime.timedelta(days=5),
        status="planning"
    )
    db.add(trip)
    await db.flush()
    await db.refresh(trip)

    # Create Destination
    dest = Destination(
        trip_id=trip.id,
        city_name="Test City",
        country="Test Country",
        arrival_date=trip.start_date,
        departure_date=trip.end_date,
        order_index=0
    )
    db.add(dest)
    await db.flush()
    await db.refresh(dest)

    # Create Accommodation at (0, 0)
    acc = Accommodation(
        destination_id=dest.id,
        name="Center Hotel",
        type="Hotel",
        check_in_date=trip.start_date,
        check_out_date=trip.end_date,
        coordinates=GeospatialService.create_point(0, 0)
    )
    db.add(acc)
    await db.flush()
    await db.refresh(acc)

    # Create POIs
    poi_near = POI(
        destination_id=dest.id,
        name="Near POI",
        category="Sightseeing",
        coordinates=GeospatialService.create_point(0.01, 0)
    )

    poi_far = POI(
        destination_id=dest.id,
        name="Far POI",
        category="Sightseeing",
        coordinates=GeospatialService.create_point(0.1, 0)
    )

    db.add(poi_near)
    db.add(poi_far)
    await db.commit()

    try:
        # Test Default (ST_DWithin)
        pois = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=5.0
        )
        poi_ids = [p.id for p in pois]

        assert poi_near.id in poi_ids, "Near POI should be found"
        assert poi_far.id not in poi_ids, "Far POI should not be found"

        # Test Explicit ST_Within
        pois_within = await GeospatialService.get_pois_within_walkable_radius(
            db, acc.id, radius_km=5.0, use_st_within=True
        )
        poi_ids_within = [p.id for p in pois_within]

        assert poi_near.id in poi_ids_within, "Near POI should be found with ST_Within"
        assert poi_far.id not in poi_ids_within, "Far POI should not be found with ST_Within"

    finally:
        await db.delete(trip)
        await db.commit()

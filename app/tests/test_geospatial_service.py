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

@pytest.mark.asyncio
async def test_calculate_distance(db: AsyncSession):
    """
    Test distance calculation between New York and London.
    """
    # New York (approx 40.7128, -74.0060) to London (approx 51.5074, -0.1278)
    lat1, lon1 = 40.7128, -74.0060
    lat2, lon2 = 51.5074, -0.1278
    
    dist = await GeospatialService.calculate_distance(db, lat1, lon1, lat2, lon2)
    
    # Approx 5570 km = 5,570,000 meters
    # Allow reasonable margin for spheroid differences
    assert 5500000 < dist < 5650000

@pytest.mark.asyncio
async def test_walkable_radius(db: AsyncSession):
    """
    Test finding POIs within a walkable radius.
    """
    # 1. Create Trip
    trip = Trip(
        name="Geospatial Test Trip",
        start_date=datetime.date.today(),
        end_date=datetime.date.today() + datetime.timedelta(days=5),
        status="planning"
    )
    db.add(trip)
    await db.flush()
    await db.refresh(trip)
    
    # 2. Create Destination
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
    
    # 3. Create Accommodation at (0, 0)
    # Using (0, 0) (Null Island) is easy for distance math
    # 1 degree lat is approx 111 km.
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
    
    # 4. Create POIs
    # POI 1: Very close (approx 1.11km) -> Within 5km
    # 0.01 degrees latitude = ~1.11 km
    poi_near = POI(
        destination_id=dest.id,
        name="Near POI",
        category="Sightseeing",
        coordinates=GeospatialService.create_point(0.01, 0)
    )
    
    # POI 2: Far (approx 11.1km) -> Outside 5km
    # 0.1 degrees latitude = ~11.1 km
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
        # Cleanup
        # Deleting trip should cascade delete destination, accommodation, pois if configured
        # But we delete manually to be safe or if cascade isn't set up in DB
        await db.delete(trip) 
        # Check if cascade works, if not we might get FK error. 
        # Models say: destination -> trip (cascade delete-orphan)
        # accommodations -> destination (cascade delete-orphan)
        # pois -> destination (cascade delete-orphan)
        # So deleting trip should be enough.
        await db.commit()

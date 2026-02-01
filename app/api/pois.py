import logging
from typing import List
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_X, ST_Y

from app.core.database import get_db

logger = logging.getLogger(__name__)
from app.models import POI, Destination, Accommodation
from app.schemas.poi import (
    POICreate, POIUpdate, POIResponse, POIsByCategory, POIVote,
    POIBulkScheduleUpdate, POIOptimizationRequest, POIOptimizationResponse, OptimizedPOI
)
from app.schemas.poi_suggestions import (
    POISuggestionRequest, POISuggestionsResponse, POISuggestion,
    POISuggestionMetadata, POISuggestionPhoto, BulkAddPOIsRequest
)
from app.services.poi_optimization_service import get_poi_optimization_service, POIOptimizationError
from app.services.google_places_service import GooglePlacesService
import math

router = APIRouter()


def poi_to_response(poi: POI, latitude: float | None = None, longitude: float | None = None) -> dict:
    """Convert POI model to response dict with explicit lat/lng"""
    return {
        "id": poi.id,
        "destination_id": poi.destination_id,
        "name": poi.name,
        "category": poi.category,
        "description": poi.description,
        "address": poi.address,
        "latitude": latitude if latitude is not None else poi.latitude,
        "longitude": longitude if longitude is not None else poi.longitude,
        "estimated_cost": poi.estimated_cost,
        "actual_cost": poi.actual_cost,
        "currency": poi.currency,
        "dwell_time": poi.dwell_time,
        "likes": poi.likes,
        "vetoes": poi.vetoes,
        "priority": poi.priority,
        "files": poi.files,
        "metadata_json": poi.metadata_json,
        "external_id": poi.external_id,
        "external_source": poi.external_source,
        "scheduled_date": poi.scheduled_date,
        "day_order": poi.day_order,
        "created_at": poi.created_at,
        "updated_at": poi.updated_at,
    }


@router.post("/pois", response_model=POIResponse, status_code=status.HTTP_201_CREATED)
async def create_poi(
    poi: POICreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new POI"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == poi.destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {poi.destination_id} not found"
        )

    # Create POI
    poi_data = poi.model_dump()
    # Remove latitude/longitude as they're not direct model fields
    latitude = poi_data.pop("latitude", None)
    longitude = poi_data.pop("longitude", None)

    db_poi = POI(**poi_data)

    # If latitude and longitude are provided, create PostGIS point
    if latitude is not None and longitude is not None:
        db_poi.coordinates = ST_SetSRID(
            ST_MakePoint(longitude, latitude),
            4326
        )

    db.add(db_poi)
    await db.flush()

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == db_poi.id)
    )
    row = result.one()
    created_poi, lat, lng = row

    return poi_to_response(created_poi, lat, lng)


@router.get("/destinations/{destination_id}/pois", response_model=List[POIsByCategory])
async def list_pois_by_destination(
    destination_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all POIs for a specific destination, grouped by category"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Get POIs ordered by category and priority, with explicit lat/lng extraction
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.destination_id == destination_id)
        .order_by(POI.category.asc(), POI.priority.desc(), POI.created_at.asc())
    )
    rows = result.all()

    # Group POIs by category
    categories_dict: dict[str, list] = {}
    for row in rows:
        poi = row[0]
        lat = row[1]
        lng = row[2]

        if poi.category not in categories_dict:
            categories_dict[poi.category] = []

        # Create response dict with explicit coordinates
        poi_response = poi_to_response(poi, lat, lng)
        categories_dict[poi.category].append(poi_response)

    # Convert to list of POIsByCategory
    grouped_pois = [
        {"category": category, "pois": pois_list}
        for category, pois_list in categories_dict.items()
    ]

    return grouped_pois


@router.get("/pois/{id}", response_model=POIResponse)
async def get_poi(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific POI by ID"""
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    poi, lat, lng = row
    return poi_to_response(poi, lat, lng)


@router.put("/pois/{id}", response_model=POIResponse)
async def update_poi(
    id: int,
    poi_update: POIUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a POI"""
    result = await db.execute(select(POI).where(POI.id == id))
    db_poi = result.scalar_one_or_none()

    if not db_poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    # Update fields
    update_data = poi_update.model_dump(exclude_unset=True)

    # Handle coordinates separately
    latitude = update_data.pop("latitude", None)
    longitude = update_data.pop("longitude", None)

    for field, value in update_data.items():
        setattr(db_poi, field, value)

    # Update coordinates if latitude and longitude are provided
    if latitude is not None and longitude is not None:
        db_poi.coordinates = ST_SetSRID(
            ST_MakePoint(longitude, latitude),
            4326
        )

    await db.flush()

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == id)
    )
    row = result.one()
    updated_poi, lat, lng = row

    return poi_to_response(updated_poi, lat, lng)


@router.delete("/pois/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a POI"""
    result = await db.execute(select(POI).where(POI.id == id))
    db_poi = result.scalar_one_or_none()

    if not db_poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    await db.delete(db_poi)

    return None

@router.post("/pois/{id}/vote", response_model=POIResponse)
async def vote_poi(
    id: int,
    vote: POIVote,
    db: AsyncSession = Depends(get_db)
):
    """Vote for a POI (like or veto)"""
    result = await db.execute(select(POI).where(POI.id == id))
    db_poi = result.scalar_one_or_none()

    if not db_poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    if vote.type == 'like':
        db_poi.likes += 1
    elif vote.type == 'veto':
        db_poi.vetoes += 1

    await db.flush()

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == id)
    )
    row = result.one()
    updated_poi, lat, lng = row

    return poi_to_response(updated_poi, lat, lng)


@router.put("/destinations/{destination_id}/pois/schedule", response_model=List[POIResponse])
async def bulk_update_poi_schedule(
    destination_id: int,
    schedule_update: POIBulkScheduleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Bulk update POI schedules for drag-and-drop functionality"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    updated_pois = []

    for update_item in schedule_update.updates:
        result = await db.execute(
            select(POI).where(POI.id == update_item.id, POI.destination_id == destination_id)
        )
        db_poi = result.scalar_one_or_none()

        if not db_poi:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"POI with id {update_item.id} not found in destination {destination_id}"
            )

        db_poi.scheduled_date = update_item.scheduled_date
        db_poi.day_order = update_item.day_order
        updated_pois.append(db_poi)

    await db.flush()

    # Re-query all updated POIs with coordinates
    poi_ids = [poi.id for poi in updated_pois]
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id.in_(poi_ids))
        .order_by(POI.scheduled_date.nulls_last(), POI.day_order)
    )
    rows = result.all()

    return [poi_to_response(row[0], row[1], row[2]) for row in rows]


@router.post("/destinations/{destination_id}/pois/optimize-day", response_model=POIOptimizationResponse)
async def optimize_day_route(
    destination_id: int,
    request: POIOptimizationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize the order of POIs for a specific day to minimize travel time.

    Uses ORS Optimization API when available, falls back to TSP algorithm.
    The route starts from the provided start_location (typically accommodation).
    """
    # Verify destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Calculate the target date based on day_number
    if not destination.arrival_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination has no arrival date set"
        )

    target_date = destination.arrival_date + timedelta(days=request.day_number - 1)

    # Get POIs scheduled for this day
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.destination_id == destination_id)
        .where(POI.scheduled_date == target_date)
        .order_by(POI.day_order.nulls_last())
    )
    rows = result.all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No POIs scheduled for day {request.day_number}"
        )

    # Build POI data for optimization
    pois_data = []
    original_order = []
    for row in rows:
        poi, lat, lng = row
        if lat is None or lng is None:
            continue  # Skip POIs without coordinates
        pois_data.append({
            'id': poi.id,
            'latitude': lat,
            'longitude': lng,
            'dwell_time': poi.dwell_time or 30,  # Default 30 minutes
        })
        original_order.append(poi.id)

    if not pois_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No POIs with valid coordinates found for this day"
        )

    # Prepare start location
    start_location = {
        'lat': request.start_location.lat,
        'lon': request.start_location.lon
    }

    # Optimize route
    service = get_poi_optimization_service()
    try:
        result = await service.optimize_route(
            pois=pois_data,
            start_location=start_location,
            profile="foot-walking"
        )
    except POIOptimizationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route optimization failed: {str(e)}"
        )

    # Build POI responses in optimized order
    poi_map = {row[0].id: (row[0], row[1], row[2]) for row in rows}
    optimized_pois = []
    for poi_id in result.optimized_order:
        if poi_id in poi_map:
            poi, lat, lng = poi_map[poi_id]
            optimized_pois.append(poi_to_response(poi, lat, lng))

    # Calculate estimated visit times
    schedule = []
    start_time = request.start_time
    # Parse start time
    hours, minutes = map(int, start_time.split(':'))
    current_minutes = hours * 60 + minutes

    # Calculate travel time per POI (distribute total travel time across segments)
    num_pois = len(result.optimized_order)
    if num_pois > 1:
        travel_time_per_segment = result.total_duration_minutes / num_pois
    else:
        travel_time_per_segment = 0

    for i, poi_id in enumerate(result.optimized_order):
        if poi_id not in poi_map:
            continue

        poi, lat, lng = poi_map[poi_id]
        dwell_time = poi.dwell_time or 30  # Default 30 minutes

        # Add travel time (except for first POI)
        if i > 0:
            current_minutes += int(travel_time_per_segment)

        arrival_hours = int(current_minutes // 60) % 24
        arrival_mins = int(current_minutes % 60)
        arrival_time = f"{arrival_hours:02d}:{arrival_mins:02d}"

        # Add dwell time
        current_minutes += dwell_time

        departure_hours = int(current_minutes // 60) % 24
        departure_mins = int(current_minutes % 60)
        departure_time = f"{departure_hours:02d}:{departure_mins:02d}"

        schedule.append(OptimizedPOI(
            id=poi.id,
            name=poi.name,
            category=poi.category,
            latitude=lat,
            longitude=lng,
            dwell_time=dwell_time,
            estimated_arrival=arrival_time,
            estimated_departure=departure_time
        ))

    return POIOptimizationResponse(
        optimized_order=result.optimized_order,
        total_distance_km=result.total_distance_km,
        total_duration_minutes=result.total_duration_minutes,
        route_geometry=result.route_geometry,
        original_order=original_order,
        pois=optimized_pois,
        schedule=schedule,
        start_time=start_time
    )


@router.get("/destinations/{destination_id}/accommodation-for-day")
async def get_accommodation_for_day(
    destination_id: int,
    day_number: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the accommodation for a specific day of a destination.

    Returns the accommodation where the traveler stays the night before this day.
    If no accommodation is found, returns the destination center coordinates.
    """
    # Verify destination exists
    dest_result = await db.execute(
        select(
            Destination,
            ST_Y(Destination.coordinates).label('dest_lat'),
            ST_X(Destination.coordinates).label('dest_lon')
        )
        .where(Destination.id == destination_id)
    )
    dest_row = dest_result.one_or_none()

    if not dest_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    destination, dest_lat, dest_lon = dest_row

    if not destination.arrival_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination has no arrival date set"
        )

    # Calculate the night before this day (for day 1, it's arrival night)
    target_night = destination.arrival_date + timedelta(days=day_number - 1)

    # Find accommodation that covers this night
    # (check_in_date <= target_night < check_out_date)
    acc_result = await db.execute(
        select(
            Accommodation,
            ST_Y(Accommodation.coordinates).label('acc_lat'),
            ST_X(Accommodation.coordinates).label('acc_lon')
        )
        .where(Accommodation.destination_id == destination_id)
        .where(Accommodation.check_in_date <= target_night)
        .where(Accommodation.check_out_date > target_night)
    )
    acc_row = acc_result.first()

    if acc_row:
        accommodation, acc_lat, acc_lon = acc_row
        return {
            "has_accommodation": True,
            "accommodation": {
                "id": accommodation.id,
                "name": accommodation.name,
                "type": accommodation.type,
                "address": accommodation.address,
            },
            "start_location": {
                "lat": acc_lat,
                "lon": acc_lon
            }
        }

    # No accommodation found, use destination center or coordinates
    lat = dest_lat or destination.latitude
    lon = dest_lon or destination.longitude

    if lat is None or lon is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No accommodation found and destination has no coordinates"
        )

    return {
        "has_accommodation": False,
        "accommodation": None,
        "start_location": {
            "lat": lat,
            "lon": lon
        },
        "warning": "No accommodation set for this day. Using destination center as start point."
    }


@router.get("/destinations/{destination_id}/pois/suggestions", response_model=POISuggestionsResponse)
async def get_poi_suggestions(
    destination_id: int,
    radius: int = 5000,
    category_filter: str | None = None,
    trip_type: str | None = None,
    max_results: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """
    Get POI suggestions for a destination using Google Places API.

    Suggestions are based on:
    - Popular attractions near the destination
    - User ratings and reviews
    - Category variety (temples, food, nature, etc.)
    - Optional trip type tags (romantic, adventure, family, etc.)
    """
    # Verify destination exists and get coordinates
    dest_result = await db.execute(
        select(
            Destination,
            ST_Y(Destination.coordinates).label('dest_lat'),
            ST_X(Destination.coordinates).label('dest_lon')
        )
        .where(Destination.id == destination_id)
    )
    dest_row = dest_result.one_or_none()

    if not dest_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    destination, dest_lat, dest_lon = dest_row

    # Use coordinates from PostGIS or fallback to latitude/longitude fields
    latitude = dest_lat or destination.latitude
    longitude = dest_lon or destination.longitude

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination has no coordinates set"
        )

    # Fetch suggestions from Google Places API
    try:
        suggestions_data = await GooglePlacesService.get_suggestions_for_destination(
            latitude=latitude,
            longitude=longitude,
            radius=radius,
            category_filter=category_filter,
            trip_type=trip_type,
            max_results=max_results,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch suggestions: {str(e)}"
        )

    # Calculate distance for each suggestion
    def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate haversine distance between two points in km"""
        R = 6371  # Earth radius in km

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    # Estimate cost and dwell time based on category and price level
    def estimate_cost(price_level: int | None) -> float | None:
        if price_level is None:
            return None
        # Price level mapping: 0=Free, 1=$, 2=$$, 3=$$$, 4=$$$$
        cost_map = {0: 0, 1: 10, 2: 25, 3: 50, 4: 100}
        return cost_map.get(price_level, 25)

    def estimate_dwell_time(category: str) -> int:
        """Estimate visit duration in minutes based on category"""
        dwell_map = {
            "Museums": 120,
            "Sights": 60,
            "Food": 90,
            "Nature": 90,
            "Shopping": 60,
            "Entertainment": 120,
            "Viewpoints": 30,
            "Activity": 90,
            "Accommodation": 0,
        }
        return dwell_map.get(category, 60)  # Default 1 hour

    # Transform to POISuggestion format
    suggestions = []
    for suggestion_data in suggestions_data:
        metadata_json = suggestion_data.get("metadata_json", {})

        # Calculate distance
        distance = None
        if suggestion_data.get("latitude") and suggestion_data.get("longitude"):
            distance = calculate_distance_km(
                latitude, longitude,
                suggestion_data["latitude"], suggestion_data["longitude"]
            )

        # Transform photos
        photos = [
            POISuggestionPhoto(
                photo_reference=photo["photo_reference"],
                width=photo["width"],
                height=photo["height"],
                url=GooglePlacesService.get_photo_url(photo["photo_reference"], max_width=400)
            )
            for photo in metadata_json.get("photos", [])
        ]

        suggestion = POISuggestion(
            name=suggestion_data["name"],
            category=suggestion_data["category"],
            address=suggestion_data.get("address"),
            latitude=suggestion_data.get("latitude"),
            longitude=suggestion_data.get("longitude"),
            external_id=suggestion_data["external_id"],
            external_source=suggestion_data["external_source"],
            metadata=POISuggestionMetadata(
                rating=metadata_json.get("rating"),
                user_ratings_total=metadata_json.get("user_ratings_total"),
                price_level=metadata_json.get("price_level"),
                types=metadata_json.get("types", []),
                photos=photos,
                business_status=metadata_json.get("business_status"),
                opening_hours=metadata_json.get("opening_hours"),
            ),
            distance_km=round(distance, 2) if distance else None,
            estimated_cost=estimate_cost(metadata_json.get("price_level")),
            suggested_dwell_time=estimate_dwell_time(suggestion_data["category"]),
        )
        suggestions.append(suggestion)

    return POISuggestionsResponse(
        destination_id=destination_id,
        suggestions=suggestions,
        total_count=len(suggestions),
        filters_applied={
            "radius": radius,
            "category_filter": category_filter,
            "trip_type": trip_type,
        }
    )


@router.post("/destinations/{destination_id}/pois/suggestions/bulk-add", response_model=List[POIResponse])
async def bulk_add_suggested_pois(
    destination_id: int,
    request: BulkAddPOIsRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Add multiple suggested POIs to a destination at once.

    This is used for the "Add All" functionality.
    """
    # Verify destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Fetch details for each place_id from Google Places API
    created_pois = []
    for place_id in request.place_ids:
        try:
            place_details = await GooglePlacesService.get_place_details(place_id)

            # Extract coordinates
            geometry = place_details.get("geometry", {})
            location = geometry.get("location", {})
            latitude = location.get("lat")
            longitude = location.get("lng")

            # Determine category
            category = request.category_override or GooglePlacesService.get_category_from_types(
                place_details.get("types", [])
            )

            # Create POI
            poi_data = {
                "destination_id": destination_id,
                "name": place_details.get("name"),
                "category": category,
                "description": None,
                "address": place_details.get("formatted_address"),
                "external_id": place_id,
                "external_source": "google_places",
                "metadata_json": {
                    "rating": place_details.get("rating"),
                    "user_ratings_total": place_details.get("user_ratings_total"),
                    "price_level": place_details.get("price_level"),
                    "website": place_details.get("website"),
                    "phone": place_details.get("formatted_phone_number"),
                    "types": place_details.get("types", []),
                    "url": place_details.get("url"),
                },
            }

            db_poi = POI(**poi_data)

            # Set coordinates
            if latitude is not None and longitude is not None:
                db_poi.coordinates = ST_SetSRID(
                    ST_MakePoint(longitude, latitude),
                    4326
                )

            db.add(db_poi)
            await db.flush()

            # Re-query to get coordinates
            result = await db.execute(
                select(
                    POI,
                    ST_Y(POI.coordinates).label('latitude'),
                    ST_X(POI.coordinates).label('longitude')
                )
                .where(POI.id == db_poi.id)
            )
            row = result.one()
            created_poi, lat, lng = row
            created_pois.append(poi_to_response(created_poi, lat, lng))

        except Exception as e:
            # Log error but continue with other POIs
            logger.warning(f"Error adding POI {place_id}: {e}")
            continue

    if not created_pois:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add any POIs"
        )

    return created_pois
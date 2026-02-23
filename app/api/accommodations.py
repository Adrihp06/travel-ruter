from typing import List
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_X, ST_Y

from app.core.database import get_db
from app.models import Accommodation, Destination
from app.schemas import AccommodationCreate, AccommodationUpdate, AccommodationResponse, PaginatedResponse
from app.api.deps import PaginationParams, get_current_user
from app.models.user import User
from app.services.geocoding_service import GeocodingService
from app.services.activity_service import log_activity

router = APIRouter()


def validate_accommodation_dates(
    check_in: date,
    check_out: date,
    dest_arrival: date,
    dest_departure: date
) -> List[str]:
    """
    Validate accommodation dates against destination dates.
    Returns list of error messages.
    """
    errors = []

    if check_in < dest_arrival:
        errors.append(f"Check-in date ({check_in}) is before destination arrival ({dest_arrival})")

    if check_out > dest_departure:
        errors.append(f"Check-out date ({check_out}) is after destination departure ({dest_departure})")

    return errors


def check_overlap(
    check_in: date,
    check_out: date,
    existing_accommodations: List[dict],
    exclude_id: int = None
) -> List[dict]:
    """
    Check if new accommodation dates overlap with existing ones.
    Returns list of overlapping accommodations.
    """
    overlaps = []

    for acc in existing_accommodations:
        if exclude_id and acc['id'] == exclude_id:
            continue

        acc_check_in = acc['check_in_date']
        acc_check_out = acc['check_out_date']

        # Check for overlap: intervals overlap if start1 < end2 and start2 < end1
        if check_in < acc_check_out and acc_check_in < check_out:
            overlap_start = max(check_in, acc_check_in)
            overlap_end = min(check_out, acc_check_out)
            overlaps.append({
                'accommodation_id': acc['id'],
                'accommodation_name': acc['name'],
                'overlap_start': str(overlap_start),
                'overlap_end': str(overlap_end)
            })

    return overlaps


def accommodation_to_response(acc: Accommodation, latitude: float | None = None, longitude: float | None = None) -> dict:
    """Convert Accommodation model to response dict with explicit lat/lng"""
    return {
        "id": acc.id,
        "destination_id": acc.destination_id,
        "name": acc.name,
        "type": acc.type,
        "address": acc.address,
        "latitude": latitude if latitude is not None else acc.latitude,
        "longitude": longitude if longitude is not None else acc.longitude,
        "check_in_date": acc.check_in_date,
        "check_out_date": acc.check_out_date,
        "booking_reference": acc.booking_reference,
        "booking_url": acc.booking_url,
        "total_cost": float(acc.total_cost) if acc.total_cost is not None else None,
        "currency": acc.currency,
        "is_paid": acc.is_paid,
        "description": acc.description,
        "contact_info": acc.contact_info,
        "amenities": acc.amenities,
        "files": acc.files,
        "rating": float(acc.rating) if acc.rating is not None else None,
        "review": acc.review,
        "created_at": acc.created_at,
        "updated_at": acc.updated_at,
    }


@router.post("/accommodations", response_model=AccommodationResponse, status_code=status.HTTP_201_CREATED)
async def create_accommodation(
    accommodation: AccommodationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new accommodation for a destination"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == accommodation.destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {accommodation.destination_id} not found"
        )

    # Validate dates are within destination range
    date_errors = validate_accommodation_dates(
        accommodation.check_in_date,
        accommodation.check_out_date,
        destination.arrival_date,
        destination.departure_date
    )

    if date_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                'message': 'Accommodation dates are outside destination stay',
                'errors': date_errors
            }
        )

    # Check for overlaps with existing accommodations
    existing_result = await db.execute(
        select(Accommodation)
        .where(Accommodation.destination_id == accommodation.destination_id)
    )
    existing_accommodations = [
        {'id': a.id, 'name': a.name, 'check_in_date': a.check_in_date, 'check_out_date': a.check_out_date}
        for a in existing_result.scalars().all()
    ]

    overlaps = check_overlap(
        accommodation.check_in_date,
        accommodation.check_out_date,
        existing_accommodations
    )

    if overlaps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                'message': 'Accommodation dates overlap with existing bookings',
                'overlaps': overlaps
            }
        )

    # Create accommodation
    acc_data = accommodation.model_dump()
    # Remove latitude/longitude as they're not direct model fields
    latitude = acc_data.pop("latitude", None)
    longitude = acc_data.pop("longitude", None)

    # Geocode address if coordinates are missing
    if latitude is None and longitude is None and acc_data.get("address"):
        try:
            results = await GeocodingService.search(query=acc_data["address"], limit=1)
            if results:
                latitude = results[0].latitude
                longitude = results[0].longitude
        except Exception:
            pass  # Geocoding failure is not fatal

    db_accommodation = Accommodation(**acc_data)

    # If latitude and longitude are provided, create PostGIS point
    if latitude is not None and longitude is not None:
        db_accommodation.coordinates = ST_SetSRID(
            ST_MakePoint(longitude, latitude),
            4326
        )

    db.add(db_accommodation)
    await db.flush()

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            Accommodation,
            ST_Y(Accommodation.coordinates).label('latitude'),
            ST_X(Accommodation.coordinates).label('longitude')
        )
        .where(Accommodation.id == db_accommodation.id)
    )
    row = result.one()
    created_acc, lat, lng = row

    await log_activity(
        db,
        trip_id=destination.trip_id,
        user_id=current_user.id,
        action="created",
        entity_type="accommodation",
        entity_id=created_acc.id,
        entity_name=created_acc.name,
    )

    return accommodation_to_response(created_acc, lat, lng)


@router.get("/destinations/{destination_id}/accommodations", response_model=PaginatedResponse[AccommodationResponse])
async def list_accommodations_by_destination(
    destination_id: int,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get accommodations for a specific destination with pagination"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(Accommodation).where(Accommodation.destination_id == destination_id)
    )
    total = count_result.scalar()

    # Get accommodations ordered by check-in date, with explicit lat/lng extraction and pagination
    result = await db.execute(
        select(
            Accommodation,
            ST_Y(Accommodation.coordinates).label('latitude'),
            ST_X(Accommodation.coordinates).label('longitude')
        )
        .where(Accommodation.destination_id == destination_id)
        .order_by(Accommodation.check_in_date.asc(), Accommodation.created_at.asc())
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    rows = result.all()

    return PaginatedResponse(
        items=[accommodation_to_response(row[0], row[1], row[2]) for row in rows],
        total=total,
        skip=pagination.skip,
        limit=pagination.limit,
    )


@router.get("/accommodations/{id}", response_model=AccommodationResponse)
async def get_accommodation(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific accommodation by ID"""
    result = await db.execute(
        select(
            Accommodation,
            ST_Y(Accommodation.coordinates).label('latitude'),
            ST_X(Accommodation.coordinates).label('longitude')
        )
        .where(Accommodation.id == id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accommodation with id {id} not found"
        )

    acc, lat, lng = row
    return accommodation_to_response(acc, lat, lng)


@router.put("/accommodations/{id}", response_model=AccommodationResponse)
async def update_accommodation(
    id: int,
    accommodation_update: AccommodationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an accommodation"""
    result = await db.execute(select(Accommodation).where(Accommodation.id == id))
    db_accommodation = result.scalar_one_or_none()

    if not db_accommodation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accommodation with id {id} not found"
        )

    # Get the destination for validation
    dest_result = await db.execute(select(Destination).where(Destination.id == db_accommodation.destination_id))
    destination = dest_result.scalar_one_or_none()

    # Update fields
    update_data = accommodation_update.model_dump(exclude_unset=True)

    # Handle coordinates separately
    latitude = update_data.pop("latitude", None)
    longitude = update_data.pop("longitude", None)

    # Geocode address if coordinates are missing and address is being updated
    if latitude is None and longitude is None and update_data.get("address"):
        try:
            results = await GeocodingService.search(query=update_data["address"], limit=1)
            if results:
                latitude = results[0].latitude
                longitude = results[0].longitude
        except Exception:
            pass  # Geocoding failure is not fatal

    # Validate dates if both are being updated
    check_in = update_data.get('check_in_date', db_accommodation.check_in_date)
    check_out = update_data.get('check_out_date', db_accommodation.check_out_date)
    if check_out <= check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="check_out_date must be after check_in_date"
        )

    # Validate dates are within destination range
    if destination:
        date_errors = validate_accommodation_dates(
            check_in,
            check_out,
            destination.arrival_date,
            destination.departure_date
        )

        if date_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    'message': 'Accommodation dates are outside destination stay',
                    'errors': date_errors
                }
            )

        # Check for overlaps with existing accommodations (excluding self)
        existing_result = await db.execute(
            select(Accommodation)
            .where(Accommodation.destination_id == db_accommodation.destination_id)
        )
        existing_accommodations = [
            {'id': a.id, 'name': a.name, 'check_in_date': a.check_in_date, 'check_out_date': a.check_out_date}
            for a in existing_result.scalars().all()
        ]

        overlaps = check_overlap(
            check_in,
            check_out,
            existing_accommodations,
            exclude_id=id
        )

        if overlaps:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    'message': 'Accommodation dates overlap with existing bookings',
                    'overlaps': overlaps
                }
            )

    for field, value in update_data.items():
        setattr(db_accommodation, field, value)

    # Update coordinates if latitude and longitude are provided
    if latitude is not None and longitude is not None:
        db_accommodation.coordinates = ST_SetSRID(
            ST_MakePoint(longitude, latitude),
            4326
        )

    await db.flush()

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            Accommodation,
            ST_Y(Accommodation.coordinates).label('latitude'),
            ST_X(Accommodation.coordinates).label('longitude')
        )
        .where(Accommodation.id == id)
    )
    row = result.one()
    updated_acc, lat, lng = row

    if destination:
        await log_activity(
            db,
            trip_id=destination.trip_id,
            user_id=current_user.id,
            action="updated",
            entity_type="accommodation",
            entity_id=updated_acc.id,
            entity_name=updated_acc.name,
        )

    return accommodation_to_response(updated_acc, lat, lng)


@router.delete("/accommodations/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_accommodation(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an accommodation"""
    result = await db.execute(select(Accommodation).where(Accommodation.id == id))
    db_accommodation = result.scalar_one_or_none()

    if not db_accommodation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accommodation with id {id} not found"
        )

    acc_id = db_accommodation.id
    acc_name = db_accommodation.name
    dest_result = await db.execute(select(Destination).where(Destination.id == db_accommodation.destination_id))
    destination = dest_result.scalar_one_or_none()

    await db.delete(db_accommodation)

    if destination:
        await log_activity(
            db,
            trip_id=destination.trip_id,
            user_id=current_user.id,
            action="deleted",
            entity_type="accommodation",
            entity_id=acc_id,
            entity_name=acc_name,
        )

    return None

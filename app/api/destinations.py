from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint

from app.core.database import get_db
from app.models import Destination, Trip, TravelSegment
from app.schemas import DestinationCreate, DestinationUpdate, DestinationResponse, DestinationReorderRequest, PaginatedResponse
from app.api.deps import PaginationParams, get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/destinations", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED)
async def create_destination(
    destination: DestinationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new destination"""
    # Verify that the trip exists
    trip_result = await db.execute(select(Trip).where(Trip.id == destination.trip_id))
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {destination.trip_id} not found"
        )

    # Create destination
    db_destination = Destination(**destination.model_dump())

    # If latitude and longitude are provided, create PostGIS point for coordinates
    if destination.latitude is not None and destination.longitude is not None:
        db_destination.coordinates = ST_SetSRID(
            ST_MakePoint(destination.longitude, destination.latitude),
            4326
        )

    db.add(db_destination)
    await db.flush()
    await db.refresh(db_destination)

    return db_destination


@router.get("/trips/{trip_id}/destinations", response_model=PaginatedResponse[DestinationResponse])
async def list_destinations_by_trip(
    trip_id: int,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all destinations for a specific trip with pagination"""
    # Verify that the trip exists
    trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Get total count
    count_result = await db.execute(
        select(func.count()).select_from(Destination).where(Destination.trip_id == trip_id)
    )
    total = count_result.scalar()

    # Get destinations ordered by the 'order_index' field with pagination
    result = await db.execute(
        select(Destination)
        .where(Destination.trip_id == trip_id)
        .order_by(Destination.order_index.asc(), Destination.created_at.asc())
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    destinations = result.scalars().all()

    return PaginatedResponse(
        items=destinations,
        total=total,
        skip=pagination.skip,
        limit=pagination.limit,
    )


@router.get("/destinations/{id}", response_model=DestinationResponse)
async def get_destination(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific destination by ID"""
    result = await db.execute(select(Destination).where(Destination.id == id))
    destination = result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {id} not found"
        )

    return destination


@router.put("/destinations/{id}", response_model=DestinationResponse)
async def update_destination(
    id: int,
    destination_update: DestinationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a destination"""
    result = await db.execute(select(Destination).where(Destination.id == id))
    db_destination = result.scalar_one_or_none()

    if not db_destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {id} not found"
        )

    # Update fields
    update_data = destination_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_destination, field, value)

    # Update coordinates if latitude and longitude are provided
    if "latitude" in update_data and "longitude" in update_data:
        if update_data["latitude"] is not None and update_data["longitude"] is not None:
            db_destination.coordinates = ST_SetSRID(
                ST_MakePoint(update_data["longitude"], update_data["latitude"]),
                4326
            )

    await db.flush()
    await db.refresh(db_destination)

    return db_destination


@router.delete("/destinations/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_destination(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a destination and its related travel segments"""
    result = await db.execute(select(Destination).where(Destination.id == id))
    db_destination = result.scalar_one_or_none()

    if not db_destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {id} not found"
        )

    # Delete all travel segments that reference this destination
    await db.execute(
        delete(TravelSegment).where(
            or_(
                TravelSegment.from_destination_id == id,
                TravelSegment.to_destination_id == id
            )
        )
    )

    # Now delete the destination
    await db.delete(db_destination)
    await db.flush()

    return None


@router.post("/trips/{trip_id}/destinations/reorder", response_model=List[DestinationResponse])
async def reorder_destinations(
    trip_id: int,
    reorder_request: DestinationReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder destinations within a trip by providing destination IDs in new order.

    This endpoint also recalculates arrival/departure dates to maintain sequential ordering:
    - The first destination keeps its original arrival_date as the trip start
    - Each destination preserves its duration (nights)
    - Subsequent destinations' dates are shifted to follow the previous one
    """
    # Verify that the trip exists
    trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Fetch all destinations for this trip ordered by current order_index
    result = await db.execute(
        select(Destination)
        .where(Destination.trip_id == trip_id)
        .order_by(Destination.order_index.asc())
    )
    destinations = {d.id: d for d in result.scalars().all()}

    # Validate that all provided IDs belong to this trip
    for dest_id in reorder_request.destination_ids:
        if dest_id not in destinations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Destination with id {dest_id} not found in trip {trip_id}"
            )

    # Calculate the duration (nights) for each destination before reordering
    durations = {}
    for dest_id, dest in destinations.items():
        duration = (dest.departure_date - dest.arrival_date).days
        durations[dest_id] = duration

    # Get the trip start date from the earliest arrival date in the current order
    trip_start = min(dest.arrival_date for dest in destinations.values())

    # Reorder and recalculate dates
    current_date = trip_start
    for new_index, dest_id in enumerate(reorder_request.destination_ids):
        dest = destinations[dest_id]
        dest.order_index = new_index
        dest.arrival_date = current_date
        dest.departure_date = current_date + timedelta(days=durations[dest_id])
        # Next destination starts when this one ends
        current_date = dest.departure_date

    # Commit changes to database
    await db.commit()

    # Refresh all destinations and return in new order
    reordered = []
    for dest_id in reorder_request.destination_ids:
        await db.refresh(destinations[dest_id])
        reordered.append(destinations[dest_id])

    return reordered

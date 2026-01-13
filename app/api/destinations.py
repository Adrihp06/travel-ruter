from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint

from app.core.database import get_db
from app.models import Destination, Trip
from app.schemas import DestinationCreate, DestinationUpdate, DestinationResponse

router = APIRouter()


@router.post("/destinations", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED)
async def create_destination(
    destination: DestinationCreate,
    db: AsyncSession = Depends(get_db)
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

    # If latitude and longitude are provided, create PostGIS points for both coordinates and location
    if destination.latitude is not None and destination.longitude is not None:
        db_destination.coordinates = ST_SetSRID(
            ST_MakePoint(destination.longitude, destination.latitude),
            4326
        )
        db_destination.location = ST_SetSRID(
            ST_MakePoint(destination.longitude, destination.latitude),
            4326
        )

    db.add(db_destination)
    await db.flush()
    await db.refresh(db_destination)

    return db_destination


@router.get("/trips/{trip_id}/destinations", response_model=List[DestinationResponse])
async def list_destinations_by_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all destinations for a specific trip"""
    # Verify that the trip exists
    trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Get destinations ordered by the 'order_index' field
    result = await db.execute(
        select(Destination)
        .where(Destination.trip_id == trip_id)
        .order_by(Destination.order_index.asc(), Destination.created_at.asc())
    )
    destinations = result.scalars().all()

    return destinations


@router.get("/destinations/{id}", response_model=DestinationResponse)
async def get_destination(
    id: int,
    db: AsyncSession = Depends(get_db)
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
    db: AsyncSession = Depends(get_db)
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

    # Update coordinates and location if latitude and longitude are provided
    if "latitude" in update_data and "longitude" in update_data:
        if update_data["latitude"] is not None and update_data["longitude"] is not None:
            db_destination.coordinates = ST_SetSRID(
                ST_MakePoint(update_data["longitude"], update_data["latitude"]),
                4326
            )
            db_destination.location = ST_SetSRID(
                ST_MakePoint(update_data["longitude"], update_data["latitude"]),
                4326
            )

    await db.flush()
    await db.refresh(db_destination)

    return db_destination


@router.delete("/destinations/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_destination(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a destination"""
    result = await db.execute(select(Destination).where(Destination.id == id))
    db_destination = result.scalar_one_or_none()

    if not db_destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {id} not found"
        )

    await db.delete(db_destination)

    return None

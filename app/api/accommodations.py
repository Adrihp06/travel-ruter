from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Accommodation, Destination
from app.schemas import AccommodationCreate, AccommodationUpdate, AccommodationResponse

router = APIRouter()


@router.post("/accommodations", response_model=AccommodationResponse, status_code=status.HTTP_201_CREATED)
async def create_accommodation(
    accommodation: AccommodationCreate,
    db: AsyncSession = Depends(get_db)
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

    # Create accommodation
    db_accommodation = Accommodation(**accommodation.model_dump())

    db.add(db_accommodation)
    await db.flush()
    await db.refresh(db_accommodation)

    return db_accommodation


@router.get("/destinations/{destination_id}/accommodations", response_model=List[AccommodationResponse])
async def list_accommodations_by_destination(
    destination_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all accommodations for a specific destination"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Get accommodations ordered by check-in date
    result = await db.execute(
        select(Accommodation)
        .where(Accommodation.destination_id == destination_id)
        .order_by(Accommodation.check_in_date.asc(), Accommodation.created_at.asc())
    )
    accommodations = result.scalars().all()

    return accommodations


@router.get("/accommodations/{id}", response_model=AccommodationResponse)
async def get_accommodation(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific accommodation by ID"""
    result = await db.execute(select(Accommodation).where(Accommodation.id == id))
    accommodation = result.scalar_one_or_none()

    if not accommodation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accommodation with id {id} not found"
        )

    return accommodation


@router.put("/accommodations/{id}", response_model=AccommodationResponse)
async def update_accommodation(
    id: int,
    accommodation_update: AccommodationUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an accommodation"""
    result = await db.execute(select(Accommodation).where(Accommodation.id == id))
    db_accommodation = result.scalar_one_or_none()

    if not db_accommodation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accommodation with id {id} not found"
        )

    # Update fields
    update_data = accommodation_update.model_dump(exclude_unset=True)

    # Validate dates if both are being updated
    check_in = update_data.get('check_in_date', db_accommodation.check_in_date)
    check_out = update_data.get('check_out_date', db_accommodation.check_out_date)
    if check_out <= check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="check_out_date must be after check_in_date"
        )

    for field, value in update_data.items():
        setattr(db_accommodation, field, value)

    await db.flush()
    await db.refresh(db_accommodation)

    return db_accommodation


@router.delete("/accommodations/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_accommodation(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an accommodation"""
    result = await db.execute(select(Accommodation).where(Accommodation.id == id))
    db_accommodation = result.scalar_one_or_none()

    if not db_accommodation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accommodation with id {id} not found"
        )

    await db.delete(db_accommodation)

    return None

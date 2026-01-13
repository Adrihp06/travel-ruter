from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.trip import Trip
from app.schemas.trip import TripCreate, TripUpdate


class TripService:
    """Service for Trip CRUD operations"""

    @staticmethod
    async def create_trip(db: AsyncSession, trip_data: TripCreate) -> Trip:
        """Create a new trip"""
        trip = Trip(**trip_data.model_dump())
        db.add(trip)
        await db.flush()
        await db.refresh(trip)
        return trip

    @staticmethod
    async def get_trip(db: AsyncSession, trip_id: int) -> Optional[Trip]:
        """Get a trip by ID"""
        result = await db.execute(select(Trip).where(Trip.id == trip_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_trips(
        db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> List[Trip]:
        """Get all trips with pagination"""
        result = await db.execute(select(Trip).offset(skip).limit(limit))
        return list(result.scalars().all())

    @staticmethod
    async def update_trip(
        db: AsyncSession, trip_id: int, trip_data: TripUpdate
    ) -> Optional[Trip]:
        """Update a trip"""
        trip = await TripService.get_trip(db, trip_id)
        if not trip:
            return None

        # Update only provided fields
        update_data = trip_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(trip, field, value)

        await db.flush()
        await db.refresh(trip)
        return trip

    @staticmethod
    async def delete_trip(db: AsyncSession, trip_id: int) -> bool:
        """Delete a trip"""
        trip = await TripService.get_trip(db, trip_id)
        if not trip:
            return False

        await db.delete(trip)
        await db.flush()
        return True

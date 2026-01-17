from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.schemas.trip import TripCreate, TripUpdate, BudgetSummary


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
    async def get_trip_with_destinations(db: AsyncSession, trip_id: int) -> Optional[Trip]:
        """Get a trip by ID with destinations eagerly loaded"""
        result = await db.execute(
            select(Trip)
            .options(selectinload(Trip.destinations))
            .where(Trip.id == trip_id)
        )
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

    @staticmethod
    async def get_budget_summary(db: AsyncSession, trip_id: int) -> Optional[BudgetSummary]:
        """Calculate budget summary for a trip by aggregating POI costs"""
        # Get the trip first
        trip = await TripService.get_trip(db, trip_id)
        if not trip:
            return None

        # Get sum of estimated and actual costs from all POIs in this trip's destinations
        result = await db.execute(
            select(
                func.coalesce(func.sum(POI.estimated_cost), 0).label('estimated_total'),
                func.coalesce(func.sum(POI.actual_cost), 0).label('actual_total')
            )
            .select_from(POI)
            .join(Destination, POI.destination_id == Destination.id)
            .where(Destination.trip_id == trip_id)
        )
        row = result.one()
        estimated_total = Decimal(str(row.estimated_total))
        actual_total = Decimal(str(row.actual_total))

        # Calculate remaining budget and percentage
        remaining_budget = None
        budget_percentage = None
        if trip.total_budget is not None and trip.total_budget > 0:
            remaining_budget = trip.total_budget - actual_total
            budget_percentage = float((actual_total / trip.total_budget) * 100)

        return BudgetSummary(
            total_budget=trip.total_budget,
            estimated_total=estimated_total,
            actual_total=actual_total,
            currency=trip.currency,
            remaining_budget=remaining_budget,
            budget_percentage=budget_percentage
        )

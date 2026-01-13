from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.trip import TripCreate, TripUpdate, TripResponse, BudgetSummary
from app.services.trip_service import TripService

router = APIRouter()


@router.post(
    "/",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new trip",
    description="Create a new trip with automatic night calculation based on start and end dates"
)
async def create_trip(
    trip_data: TripCreate,
    db: AsyncSession = Depends(get_db)
) -> TripResponse:
    """Create a new trip"""
    trip = await TripService.create_trip(db, trip_data)
    return TripResponse.model_validate(trip)


@router.get(
    "/",
    response_model=List[TripResponse],
    summary="List all trips",
    description="Retrieve all trips with pagination support"
)
async def get_trips(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: AsyncSession = Depends(get_db)
) -> List[TripResponse]:
    """Get all trips with pagination"""
    trips = await TripService.get_trips(db, skip=skip, limit=limit)
    return [TripResponse.model_validate(trip) for trip in trips]


@router.get(
    "/{trip_id}",
    response_model=TripResponse,
    summary="Get trip details",
    description="Retrieve details of a specific trip by ID"
)
async def get_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> TripResponse:
    """Get a specific trip by ID"""
    trip = await TripService.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return TripResponse.model_validate(trip)


@router.put(
    "/{trip_id}",
    response_model=TripResponse,
    summary="Update a trip",
    description="Update an existing trip. Nights are automatically recalculated if dates change."
)
async def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    db: AsyncSession = Depends(get_db)
) -> TripResponse:
    """Update a trip"""
    trip = await TripService.update_trip(db, trip_id, trip_data)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return TripResponse.model_validate(trip)


@router.delete(
    "/{trip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a trip",
    description="Delete a trip by ID"
)
async def delete_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a trip"""
    success = await TripService.delete_trip(db, trip_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )


@router.get(
    "/{trip_id}/budget",
    response_model=BudgetSummary,
    summary="Get trip budget summary",
    description="Calculate and return budget summary for a trip, including estimated and actual costs from all POIs"
)
async def get_trip_budget(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> BudgetSummary:
    """Get budget summary for a trip"""
    budget = await TripService.get_budget_summary(db, trip_id)
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return budget

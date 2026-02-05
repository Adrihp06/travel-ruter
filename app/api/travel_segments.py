from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.trip import Trip
from app.schemas.travel_segment import (
    TravelMode,
    TravelSegmentResponse,
    TravelSegmentCalculateRequest,
    TripTravelSegmentsResponse,
    TripTravelSegmentsWithOriginReturnResponse,
)
from app.services.travel_segment_service import TravelSegmentService


class RecalculateAllResponse(BaseModel):
    """Response model for bulk recalculation endpoint."""
    trips_processed: int
    total_segments_recalculated: int
    message: str

router = APIRouter()


@router.post(
    "/destinations/{from_id}/travel-segment/{to_id}",
    response_model=TravelSegmentResponse,
    status_code=status.HTTP_200_OK
)
async def calculate_travel_segment(
    from_id: int,
    to_id: int,
    request: TravelSegmentCalculateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate and save travel segment between two destinations.
    If a segment already exists, it will be updated with the new mode.
    """
    try:
        segment = await TravelSegmentService.calculate_and_save_segment(
            db, from_id, to_id, request.travel_mode
        )
        await db.commit()
        return segment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/destinations/{from_id}/travel-segment/{to_id}",
    response_model=TravelSegmentResponse
)
async def get_travel_segment(
    from_id: int,
    to_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get the travel segment between two destinations"""
    segment = await TravelSegmentService.get_segment(db, from_id, to_id)

    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No travel segment found between destinations {from_id} and {to_id}"
        )

    return segment


@router.get(
    "/trips/{trip_id}/travel-segments",
    response_model=TripTravelSegmentsWithOriginReturnResponse
)
async def get_trip_travel_segments(
    trip_id: int,
    include_origin_return: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all travel segments for a trip.

    Args:
        trip_id: The trip ID
        include_origin_return: If True, includes origin and return segments calculated
                              from the trip's origin/return points (default: True)
    """
    segments = await TravelSegmentService.get_trip_segments(db, trip_id)

    origin_segment = None
    return_segment = None

    if include_origin_return:
        # Get trip to read origin/return travel modes
        trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
        trip = trip_result.scalar_one_or_none()

        if trip:
            # Get travel modes from trip (defaults to plane if not set)
            origin_mode = TravelMode(trip.origin_travel_mode or "plane")
            return_mode = TravelMode(trip.return_travel_mode or "plane")

            origin_segment, return_segment = await TravelSegmentService.calculate_origin_return_segments(
                db, trip_id, origin_travel_mode=origin_mode, return_travel_mode=return_mode
            )

    return TripTravelSegmentsWithOriginReturnResponse(
        segments=segments,
        origin_segment=origin_segment,
        return_segment=return_segment
    )


@router.post(
    "/trips/{trip_id}/travel-segments/recalculate",
    response_model=TripTravelSegmentsResponse
)
async def recalculate_trip_travel_segments(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Recalculate all travel segments for a trip.
    Call this after reordering destinations.
    """
    segments = await TravelSegmentService.recalculate_trip_segments(db, trip_id)
    await db.commit()
    return TripTravelSegmentsResponse(segments=segments)


@router.delete(
    "/travel-segments/{segment_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_travel_segment(
    segment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a travel segment"""
    deleted = await TravelSegmentService.delete_segment(db, segment_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    await db.commit()
    return None


@router.post(
    "/travel-segments/recalculate-all",
    response_model=RecalculateAllResponse
)
async def recalculate_all_travel_segments(
    db: AsyncSession = Depends(get_db)
):
    """
    Recalculate all travel segments for all trips in the system.
    Useful after updating routing service configuration or API keys.
    """
    # Get all trips
    result = await db.execute(select(Trip))
    trips = list(result.scalars().all())

    trips_processed = 0
    total_segments = 0

    for trip in trips:
        segments = await TravelSegmentService.recalculate_trip_segments(db, trip.id)
        if segments:
            trips_processed += 1
            total_segments += len(segments)

    await db.commit()

    return RecalculateAllResponse(
        trips_processed=trips_processed,
        total_segments_recalculated=total_segments,
        message=f"Successfully recalculated {total_segments} segments across {trips_processed} trips"
    )

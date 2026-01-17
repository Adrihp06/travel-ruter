from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.travel_segment import (
    TravelMode,
    TravelSegmentResponse,
    TravelSegmentCalculateRequest,
    TripTravelSegmentsResponse,
)
from app.services.travel_segment_service import TravelSegmentService

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
    response_model=TripTravelSegmentsResponse
)
async def get_trip_travel_segments(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all travel segments for a trip"""
    segments = await TravelSegmentService.get_trip_segments(db, trip_id)
    return TripTravelSegmentsResponse(segments=segments)


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

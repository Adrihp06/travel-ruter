"""API routes for TravelStop management."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.travel_stop import TravelStop
from app.models.travel_segment import TravelSegment
from app.schemas.travel_stop import (
    TravelStopCreate,
    TravelStopUpdate,
    TravelStopResponse,
    TravelStopBulkCreate,
    TravelStopReorderRequest,
)
from app.services.travel_segment_service import TravelSegmentService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/travel-segments/{segment_id}/stops",
    response_model=list[TravelStopResponse],
    summary="Get all stops for a travel segment"
)
async def get_segment_stops(
    segment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all planned stops for a travel segment, ordered by order_index."""
    # Verify segment exists
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    result = await db.execute(
        select(TravelStop)
        .where(TravelStop.travel_segment_id == segment_id)
        .order_by(TravelStop.order_index)
    )
    stops = list(result.scalars().all())

    return stops


@router.get(
    "/stops/{stop_id}",
    response_model=TravelStopResponse,
    summary="Get a specific travel stop"
)
async def get_stop(
    stop_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific travel stop."""
    stop = await db.get(TravelStop, stop_id)
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel stop with id {stop_id} not found"
        )
    return stop


@router.post(
    "/travel-segments/{segment_id}/stops",
    response_model=TravelStopResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new travel stop"
)
async def create_stop(
    segment_id: int,
    stop_data: TravelStopCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new planned stop for a travel segment.
    If order_index is not provided, appends to the end.
    """
    # Verify segment exists
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    # Override segment_id from path parameter
    if stop_data.travel_segment_id != segment_id:
        stop_data.travel_segment_id = segment_id

    # Determine order_index
    if stop_data.order_index is None:
        # Get max order_index for this segment
        result = await db.execute(
            select(func.coalesce(func.max(TravelStop.order_index), -1))
            .where(TravelStop.travel_segment_id == segment_id)
        )
        max_order = result.scalar()
        order_index = max_order + 1
    else:
        order_index = stop_data.order_index
        # Shift existing stops if inserting
        result = await db.execute(
            select(TravelStop)
            .where(TravelStop.travel_segment_id == segment_id)
            .where(TravelStop.order_index >= order_index)
            .order_by(TravelStop.order_index.desc())
        )
        for s in result.scalars().all():
            s.order_index += 1

    # Create stop
    stop = TravelStop(
        travel_segment_id=segment_id,
        name=stop_data.name,
        description=stop_data.description,
        latitude=stop_data.latitude,
        longitude=stop_data.longitude,
        address=stop_data.address,
        stop_date=stop_data.stop_date,
        duration_minutes=stop_data.duration_minutes,
        arrival_time=stop_data.arrival_time,
        order_index=order_index
    )
    db.add(stop)

    await db.commit()
    await db.refresh(stop)

    # Recalculate route to include the new stop
    try:
        await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to recalculate route after adding stop: {e}")

    return stop


@router.post(
    "/travel-segments/{segment_id}/stops/bulk",
    response_model=list[TravelStopResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create multiple travel stops at once"
)
async def create_stops_bulk(
    segment_id: int,
    bulk_data: TravelStopBulkCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create multiple stops for a travel segment in one request."""
    # Verify segment exists
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    # Get current max order_index
    result = await db.execute(
        select(func.coalesce(func.max(TravelStop.order_index), -1))
        .where(TravelStop.travel_segment_id == segment_id)
    )
    current_max = result.scalar()

    created_stops = []
    for i, stop_data in enumerate(bulk_data.stops):
        stop = TravelStop(
            travel_segment_id=segment_id,
            name=stop_data.name,
            description=stop_data.description,
            latitude=stop_data.latitude,
            longitude=stop_data.longitude,
            address=stop_data.address,
            stop_date=stop_data.stop_date,
            duration_minutes=stop_data.duration_minutes,
            arrival_time=stop_data.arrival_time,
            order_index=current_max + 1 + i
        )
        db.add(stop)
        created_stops.append(stop)

    await db.commit()

    # Refresh all stops
    for stop in created_stops:
        await db.refresh(stop)

    # Recalculate route to include the new stops
    try:
        await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to recalculate route after adding stops: {e}")

    return created_stops


@router.put(
    "/stops/{stop_id}",
    response_model=TravelStopResponse,
    summary="Update a travel stop"
)
async def update_stop(
    stop_id: int,
    stop_data: TravelStopUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a travel stop's details."""
    stop = await db.get(TravelStop, stop_id)
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel stop with id {stop_id} not found"
        )

    # Update fields if provided
    update_data = stop_data.model_dump(exclude_unset=True)

    # Check if location changed (requires route recalculation)
    location_changed = ('latitude' in update_data or 'longitude' in update_data)
    segment_id = stop.travel_segment_id

    for field, value in update_data.items():
        setattr(stop, field, value)

    await db.commit()
    await db.refresh(stop)

    # Recalculate route if location changed
    if location_changed:
        try:
            await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)
            await db.commit()
        except Exception as e:
            logger.warning(f"Failed to recalculate route after updating stop: {e}")

    return stop


@router.delete(
    "/stops/{stop_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a travel stop"
)
async def delete_stop(
    stop_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a travel stop and reorder remaining stops."""
    stop = await db.get(TravelStop, stop_id)
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel stop with id {stop_id} not found"
        )

    segment_id = stop.travel_segment_id
    deleted_order = stop.order_index

    # Delete the stop
    await db.delete(stop)
    await db.flush()

    # Reorder remaining stops
    result = await db.execute(
        select(TravelStop)
        .where(TravelStop.travel_segment_id == segment_id)
        .where(TravelStop.order_index > deleted_order)
        .order_by(TravelStop.order_index)
    )
    for s in result.scalars().all():
        s.order_index -= 1

    await db.commit()

    # Recalculate route after removing the stop
    try:
        await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to recalculate route after deleting stop: {e}")

    return None


@router.post(
    "/travel-segments/{segment_id}/stops/reorder",
    response_model=list[TravelStopResponse],
    summary="Reorder stops within a segment"
)
async def reorder_stops(
    segment_id: int,
    reorder_data: TravelStopReorderRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reorder stops within a segment.
    Provide a list of stop IDs in the desired order.
    """
    # Verify segment exists
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    # Get all stops for this segment
    result = await db.execute(
        select(TravelStop)
        .where(TravelStop.travel_segment_id == segment_id)
    )
    stops_by_id = {s.id: s for s in result.scalars().all()}

    # Validate all stop IDs belong to this segment
    for stop_id in reorder_data.stop_ids:
        if stop_id not in stops_by_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stop {stop_id} not found or does not belong to segment {segment_id}"
            )

    # Update order indices
    for new_index, stop_id in enumerate(reorder_data.stop_ids):
        stops_by_id[stop_id].order_index = new_index

    await db.commit()

    # Recalculate route after reordering stops
    try:
        await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to recalculate route after reordering stops: {e}")

    # Fetch updated stops in order
    result = await db.execute(
        select(TravelStop)
        .where(TravelStop.travel_segment_id == segment_id)
        .order_by(TravelStop.order_index)
    )
    stops = list(result.scalars().all())

    return stops

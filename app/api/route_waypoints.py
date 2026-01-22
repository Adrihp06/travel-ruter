from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.route_waypoint import RouteWaypoint
from app.models.travel_segment import TravelSegment
from app.schemas.route_waypoint import (
    RouteWaypointCreate,
    RouteWaypointUpdate,
    RouteWaypointResponse,
    RouteWaypointReorderRequest,
    SegmentWaypointsResponse,
)
from app.services.travel_segment_service import TravelSegmentService

router = APIRouter()


@router.get(
    "/travel-segments/{segment_id}/waypoints",
    response_model=SegmentWaypointsResponse
)
async def get_segment_waypoints(
    segment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all waypoints for a travel segment, ordered by order_index."""
    # Verify segment exists
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    result = await db.execute(
        select(RouteWaypoint)
        .where(RouteWaypoint.travel_segment_id == segment_id)
        .order_by(RouteWaypoint.order_index)
    )
    waypoints = list(result.scalars().all())

    return SegmentWaypointsResponse(waypoints=waypoints)


@router.post(
    "/travel-segments/{segment_id}/waypoints",
    response_model=RouteWaypointResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_waypoint(
    segment_id: int,
    waypoint_data: RouteWaypointCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new waypoint for a travel segment.
    If order_index is not provided, appends to the end.
    After creation, the segment route is recalculated to include the new waypoint.
    """
    # Verify segment exists and load it
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    # Determine order_index
    if waypoint_data.order_index is None:
        # Get max order_index for this segment
        result = await db.execute(
            select(func.coalesce(func.max(RouteWaypoint.order_index), -1))
            .where(RouteWaypoint.travel_segment_id == segment_id)
        )
        max_order = result.scalar()
        order_index = max_order + 1
    else:
        order_index = waypoint_data.order_index
        # Shift existing waypoints if inserting
        result = await db.execute(
            select(RouteWaypoint)
            .where(RouteWaypoint.travel_segment_id == segment_id)
            .where(RouteWaypoint.order_index >= order_index)
            .order_by(RouteWaypoint.order_index.desc())
        )
        for wp in result.scalars().all():
            wp.order_index += 1

    # Create waypoint
    waypoint = RouteWaypoint(
        travel_segment_id=segment_id,
        name=waypoint_data.name,
        latitude=waypoint_data.latitude,
        longitude=waypoint_data.longitude,
        order_index=order_index
    )
    db.add(waypoint)
    await db.flush()

    # Recalculate route with waypoints
    await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)

    await db.commit()
    await db.refresh(waypoint)

    return waypoint


@router.put(
    "/waypoints/{waypoint_id}",
    response_model=RouteWaypointResponse
)
async def update_waypoint(
    waypoint_id: int,
    waypoint_data: RouteWaypointUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a waypoint's name or position.
    If position changes, the segment route is recalculated.
    """
    waypoint = await db.get(RouteWaypoint, waypoint_id)
    if not waypoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Waypoint with id {waypoint_id} not found"
        )

    # Track if position changed
    position_changed = False

    if waypoint_data.name is not None:
        waypoint.name = waypoint_data.name

    if waypoint_data.latitude is not None:
        if waypoint_data.latitude != waypoint.latitude:
            position_changed = True
        waypoint.latitude = waypoint_data.latitude

    if waypoint_data.longitude is not None:
        if waypoint_data.longitude != waypoint.longitude:
            position_changed = True
        waypoint.longitude = waypoint_data.longitude

    # Recalculate route if position changed
    if position_changed:
        await TravelSegmentService.recalculate_segment_with_waypoints(
            db, waypoint.travel_segment_id
        )

    await db.commit()
    await db.refresh(waypoint)

    return waypoint


@router.delete(
    "/waypoints/{waypoint_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_waypoint(
    waypoint_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a waypoint and recalculate the segment route.
    """
    waypoint = await db.get(RouteWaypoint, waypoint_id)
    if not waypoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Waypoint with id {waypoint_id} not found"
        )

    segment_id = waypoint.travel_segment_id
    deleted_order = waypoint.order_index

    # Delete the waypoint
    await db.delete(waypoint)
    await db.flush()

    # Reorder remaining waypoints
    result = await db.execute(
        select(RouteWaypoint)
        .where(RouteWaypoint.travel_segment_id == segment_id)
        .where(RouteWaypoint.order_index > deleted_order)
        .order_by(RouteWaypoint.order_index)
    )
    for wp in result.scalars().all():
        wp.order_index -= 1

    # Recalculate route
    await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)

    await db.commit()

    return None


@router.post(
    "/travel-segments/{segment_id}/waypoints/reorder",
    response_model=SegmentWaypointsResponse
)
async def reorder_waypoints(
    segment_id: int,
    reorder_data: RouteWaypointReorderRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reorder waypoints within a segment.
    Provide a list of waypoint IDs with their new order indices.
    After reordering, the segment route is recalculated.
    """
    # Verify segment exists
    segment = await db.get(TravelSegment, segment_id)
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Travel segment with id {segment_id} not found"
        )

    # Get all waypoints for this segment
    result = await db.execute(
        select(RouteWaypoint)
        .where(RouteWaypoint.travel_segment_id == segment_id)
    )
    waypoints_by_id = {wp.id: wp for wp in result.scalars().all()}

    # Validate all waypoint IDs belong to this segment
    for item in reorder_data.waypoints:
        if item.id not in waypoints_by_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Waypoint {item.id} not found or does not belong to segment {segment_id}"
            )

    # Update order indices
    for item in reorder_data.waypoints:
        waypoints_by_id[item.id].order_index = item.order_index

    await db.flush()

    # Recalculate route with new waypoint order
    await TravelSegmentService.recalculate_segment_with_waypoints(db, segment_id)

    await db.commit()

    # Fetch updated waypoints in order
    result = await db.execute(
        select(RouteWaypoint)
        .where(RouteWaypoint.travel_segment_id == segment_id)
        .order_by(RouteWaypoint.order_index)
    )
    waypoints = list(result.scalars().all())

    return SegmentWaypointsResponse(waypoints=waypoints)

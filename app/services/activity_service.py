from typing import Optional, Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.notification import Notification
from app.models.trip_member import TripMember


async def log_activity(
    db: AsyncSession,
    *,
    trip_id: int,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    entity_name: Optional[str] = None,
    details: Optional[dict] = None,
) -> ActivityLog:
    """Log an activity and create notifications for other trip members."""
    entry = ActivityLog(
        trip_id=trip_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        details=details,
    )
    db.add(entry)

    # Create notifications for other accepted members
    stmt = select(TripMember.user_id).where(
        TripMember.trip_id == trip_id,
        TripMember.status == "accepted",
        TripMember.user_id != user_id,
    )
    result = await db.execute(stmt)
    member_ids = result.scalars().all()

    for member_id in member_ids:
        notification = Notification(
            user_id=member_id,
            trip_id=trip_id,
            type="activity",
            title=f"{entity_type.capitalize()} {action}",
            message=f"{entity_name or entity_type} was {action}",
            data={"activity_id": None, "entity_type": entity_type, "entity_id": entity_id},
        )
        db.add(notification)

    await db.flush()
    await db.refresh(entry)
    return entry


async def get_activity_feed(
    db: AsyncSession,
    trip_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
    entity_type: Optional[str] = None,
) -> tuple[list[ActivityLog], int]:
    """Get paginated activity feed for a trip."""
    stmt = select(ActivityLog).where(ActivityLog.trip_id == trip_id)
    count_stmt = select(func.count(ActivityLog.id)).where(ActivityLog.trip_id == trip_id)

    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
        count_stmt = count_stmt.where(ActivityLog.entity_type == entity_type)

    stmt = stmt.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    activities = result.scalars().all()

    count_result = await db.execute(count_stmt)
    total = count_result.scalar()

    return list(activities), total

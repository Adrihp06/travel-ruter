from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.activity import ActivityLogResponse, ActivityList
from app.api.permissions import require_viewer

router = APIRouter(tags=["activity"])


@router.get("/trips/{trip_id}/activity", response_model=ActivityList)
async def get_trip_activity(
    trip_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    entity_type: Optional[str] = Query(None),
    user: User = Depends(require_viewer),
    db: AsyncSession = Depends(get_db),
):
    count_stmt = select(func.count(ActivityLog.id)).where(ActivityLog.trip_id == trip_id)
    if entity_type:
        count_stmt = count_stmt.where(ActivityLog.entity_type == entity_type)
    total = (await db.execute(count_stmt)).scalar()

    stmt = (
        select(ActivityLog, User.name.label("user_name"), User.avatar_url.label("user_avatar"))
        .outerjoin(User, ActivityLog.user_id == User.id)
        .where(ActivityLog.trip_id == trip_id)
    )
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    stmt = stmt.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)

    rows = (await db.execute(stmt)).all()

    return ActivityList(
        activities=[
            ActivityLogResponse(
                id=a.id,
                trip_id=a.trip_id,
                user_id=a.user_id,
                user_name=user_name,
                user_avatar=user_avatar,
                action=a.action,
                entity_type=a.entity_type,
                entity_id=a.entity_id,
                entity_name=a.entity_name,
                details=a.details,
                created_at=a.created_at,
            )
            for a, user_name, user_avatar in rows
        ],
        total=total,
    )

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.activity import ActivityLogResponse, ActivityList
from app.services.activity_service import get_activity_feed
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
    activities, total = await get_activity_feed(
        db, trip_id, limit=limit, offset=offset, entity_type=entity_type
    )
    return ActivityList(
        activities=[
            ActivityLogResponse(
                id=a.id,
                trip_id=a.trip_id,
                user_id=a.user_id,
                action=a.action,
                entity_type=a.entity_type,
                entity_id=a.entity_id,
                entity_name=a.entity_name,
                details=a.details,
                created_at=a.created_at,
            )
            for a in activities
        ],
        total=total,
    )

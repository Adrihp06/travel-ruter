from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.trip_member import TripMember
from app.api.deps import get_current_user

ROLE_HIERARCHY = {"viewer": 0, "editor": 1, "owner": 2}


class TripPermission:
    """Dependency that checks the user has at least `min_role` on a trip."""

    def __init__(self, min_role: str = "viewer"):
        self.min_level = ROLE_HIERARCHY[min_role]

    async def __call__(
        self,
        trip_id: int,
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        stmt = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.user_id == user.id,
            TripMember.status == "accepted",
        )
        result = await db.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this trip")

        user_level = ROLE_HIERARCHY.get(member.role, -1)
        if user_level < self.min_level:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        return user


require_viewer = TripPermission("viewer")
require_editor = TripPermission("editor")
require_owner = TripPermission("owner")

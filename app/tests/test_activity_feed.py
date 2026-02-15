import pytest
from app.models.trip_member import TripMember
from app.services.activity_service import log_activity, get_activity_feed


class TestActivityFeed:
    async def test_activity_logged_on_create(self, db, created_user, trip_with_owner):
        entry = await log_activity(
            db, trip_id=trip_with_owner.id, user_id=created_user.id,
            action="created", entity_type="poi", entity_name="Eiffel Tower",
        )
        assert entry.id is not None
        assert entry.action == "created"
        assert entry.entity_type == "poi"

    async def test_activity_feed_returns_paginated(self, db, created_user, trip_with_owner):
        for i in range(5):
            await log_activity(
                db, trip_id=trip_with_owner.id, user_id=created_user.id,
                action="created", entity_type="poi", entity_name=f"POI {i}",
            )
        activities, total = await get_activity_feed(db, trip_with_owner.id, limit=3)
        assert len(activities) == 3
        assert total == 5

    async def test_activity_feed_filtered_by_entity_type(self, db, created_user, trip_with_owner):
        await log_activity(db, trip_id=trip_with_owner.id, user_id=created_user.id,
                          action="created", entity_type="poi", entity_name="POI")
        await log_activity(db, trip_id=trip_with_owner.id, user_id=created_user.id,
                          action="created", entity_type="destination", entity_name="Dest")
        activities, total = await get_activity_feed(db, trip_with_owner.id, entity_type="poi")
        assert total == 1
        assert activities[0].entity_type == "poi"

    async def test_activity_creates_notification_for_other_members(self, db, created_user, second_user, trip_with_owner):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="accepted",
        )
        db.add(member)
        await db.flush()

        await log_activity(
            db, trip_id=trip_with_owner.id, user_id=created_user.id,
            action="created", entity_type="poi", entity_name="New POI",
        )

        from sqlalchemy import select
        from app.models.notification import Notification
        stmt = select(Notification).where(Notification.user_id == second_user.id)
        result = await db.execute(stmt)
        notifications = result.scalars().all()
        assert len(notifications) >= 1

    async def test_activity_feed_only_visible_to_trip_members(self, client, trip_with_owner, second_auth_headers):
        resp = await client.get(
            f"/api/v1/trips/{trip_with_owner.id}/activity",
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

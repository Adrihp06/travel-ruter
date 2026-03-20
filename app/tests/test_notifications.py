import pytest
from app.models.notification import Notification


class TestNotifications:
    async def test_create_notification_for_user(self, db, created_user):
        n = Notification(
            user_id=created_user.id, type="test", title="Test",
            message="Hello", is_read=False,
        )
        db.add(n)
        await db.flush()
        await db.refresh(n)
        assert n.id is not None

    async def test_list_notifications_paginated(self, db, client, created_user, auth_headers):
        for i in range(5):
            db.add(Notification(
                user_id=created_user.id, type="test",
                title=f"Notif {i}", is_read=False,
            ))
        await db.flush()
        resp = await client.get("/api/v1/notifications/?limit=3", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["notifications"]) == 3
        assert data["total"] == 5

    async def test_list_notifications_only_for_current_user(self, db, client, created_user, second_user, auth_headers):
        db.add(Notification(user_id=created_user.id, type="test", title="Mine", is_read=False))
        db.add(Notification(user_id=second_user.id, type="test", title="Theirs", is_read=False))
        await db.flush()
        resp = await client.get("/api/v1/notifications/", headers=auth_headers)
        assert resp.status_code == 200
        titles = [n["title"] for n in resp.json()["notifications"]]
        assert "Mine" in titles
        assert "Theirs" not in titles

    async def test_mark_notification_as_read(self, db, client, created_user, auth_headers):
        n = Notification(user_id=created_user.id, type="test", title="Unread", is_read=False)
        db.add(n)
        await db.flush()
        await db.refresh(n)
        resp = await client.patch(f"/api/v1/notifications/{n.id}/read", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    async def test_mark_all_as_read(self, db, client, created_user, auth_headers):
        for i in range(3):
            db.add(Notification(user_id=created_user.id, type="test", title=f"N{i}", is_read=False))
        await db.flush()
        resp = await client.post("/api/v1/notifications/read-all", headers=auth_headers)
        assert resp.status_code == 204
        unread_resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert unread_resp.status_code == 200
        assert unread_resp.json()["count"] == 0

    async def test_unread_count(self, db, client, created_user, auth_headers):
        db.add(Notification(user_id=created_user.id, type="test", title="A", is_read=False))
        db.add(Notification(user_id=created_user.id, type="test", title="B", is_read=True))
        await db.flush()
        resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["count"] == 1

    async def test_unread_count_excludes_read(self, db, client, created_user, auth_headers):
        db.add(Notification(user_id=created_user.id, type="test", title="Read", is_read=True))
        await db.flush()
        resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    async def test_mark_as_read_notification_gone_from_unread(self, db, client, created_user, auth_headers):
        """After marking one notification as read, it should persist as read
        and the unread count should decrease."""
        for i in range(3):
            db.add(Notification(
                user_id=created_user.id, type="test",
                title=f"Notif {i}", is_read=False,
            ))
        await db.flush()

        # Initial unread count is 3
        resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert resp.json()["count"] == 3

        # Get the first notification id
        list_resp = await client.get("/api/v1/notifications/", headers=auth_headers)
        notif_id = list_resp.json()["notifications"][0]["id"]

        # Mark it as read
        mark_resp = await client.patch(
            f"/api/v1/notifications/{notif_id}/read", headers=auth_headers
        )
        assert mark_resp.status_code == 200
        assert mark_resp.json()["is_read"] is True
        assert mark_resp.json()["read_at"] is not None

        # Re-fetch: unread count should now be 2
        count_resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert count_resp.json()["count"] == 2

        # The notification should appear as read in the list
        list_resp2 = await client.get("/api/v1/notifications/", headers=auth_headers)
        marked = next(n for n in list_resp2.json()["notifications"] if n["id"] == notif_id)
        assert marked["is_read"] is True

    async def test_mark_all_read_notifications_gone_from_unread(self, db, client, created_user, auth_headers):
        """After marking all as read, every notification must be read
        and the unread count must be zero."""
        for i in range(3):
            db.add(Notification(
                user_id=created_user.id, type="test",
                title=f"N{i}", is_read=False,
            ))
        await db.flush()

        # Mark all as read
        resp = await client.post("/api/v1/notifications/read-all", headers=auth_headers)
        assert resp.status_code == 204

        # Re-fetch: every notification should be read
        list_resp = await client.get("/api/v1/notifications/", headers=auth_headers)
        notifications = list_resp.json()["notifications"]
        assert all(n["is_read"] for n in notifications)
        assert all(n["read_at"] is not None for n in notifications)

        # Unread count must be 0
        count_resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
        assert count_resp.json()["count"] == 0

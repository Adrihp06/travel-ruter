import pytest
from datetime import datetime, timezone
from app.models.trip_member import TripMember
from app.models.user import User


class TestTripPermissions:
    async def test_owner_can_access_trip(self, client, trip_with_owner, auth_headers):
        resp = await client.get(f"/api/v1/trips/{trip_with_owner.id}/members", headers=auth_headers)
        assert resp.status_code == 200

    async def test_editor_can_access_trip(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.get(f"/api/v1/trips/{trip_with_owner.id}/members", headers=second_auth_headers)
        assert resp.status_code == 200

    async def test_viewer_can_access_trip(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.get(f"/api/v1/trips/{trip_with_owner.id}/members", headers=second_auth_headers)
        assert resp.status_code == 200

    async def test_non_member_gets_403(self, client, trip_with_owner, second_auth_headers):
        resp = await client.get(f"/api/v1/trips/{trip_with_owner.id}/members", headers=second_auth_headers)
        assert resp.status_code == 403

    async def test_viewer_cannot_edit(self, db, client, trip_with_owner, second_user, second_auth_headers):
        """Viewer can't set API keys (requires editor)."""
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "test-key"},
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

    async def test_editor_cannot_manage_members(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.post(
            f"/api/v1/trips/{trip_with_owner.id}/members",
            json={"email": "someone@test.com", "role": "viewer"},
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

    async def test_pending_member_cannot_access(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="pending",
        )
        db.add(member)
        await db.flush()
        resp = await client.get(f"/api/v1/trips/{trip_with_owner.id}/members", headers=second_auth_headers)
        assert resp.status_code == 403

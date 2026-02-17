import pytest
from app.models.trip_member import TripMember


class TestCollaboration:
    async def test_owner_can_invite_user(self, client, trip_with_owner, second_user, auth_headers):
        resp = await client.post(
            f"/api/v1/trips/{trip_with_owner.id}/members",
            json={"email": second_user.email, "role": "editor"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "editor"
        assert resp.json()["status"] == "pending"

    async def test_editor_cannot_invite_user(self, db, client, trip_with_owner, second_user, second_auth_headers):
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

    async def test_list_members(self, client, trip_with_owner, auth_headers):
        resp = await client.get(f"/api/v1/trips/{trip_with_owner.id}/members", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["role"] == "owner"

    async def test_accept_invitation(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="pending",
        )
        db.add(member)
        await db.flush()
        await db.refresh(member)
        resp = await client.post(f"/api/v1/invitations/{member.id}/accept", headers=second_auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

    async def test_reject_invitation(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="pending",
        )
        db.add(member)
        await db.flush()
        await db.refresh(member)
        resp = await client.post(f"/api/v1/invitations/{member.id}/reject", headers=second_auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    async def test_owner_can_change_role(self, db, client, trip_with_owner, second_user, auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.patch(
            f"/api/v1/trips/{trip_with_owner.id}/members/{second_user.id}",
            json={"role": "editor"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "editor"

    async def test_owner_can_remove_member(self, db, client, trip_with_owner, second_user, auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.delete(
            f"/api/v1/trips/{trip_with_owner.id}/members/{second_user.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_cannot_remove_self_as_owner(self, client, trip_with_owner, created_user, auth_headers):
        resp = await client.delete(
            f"/api/v1/trips/{trip_with_owner.id}/members/{created_user.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_duplicate_invitation_rejected(self, db, client, trip_with_owner, second_user, auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="pending",
        )
        db.add(member)
        await db.flush()
        resp = await client.post(
            f"/api/v1/trips/{trip_with_owner.id}/members",
            json={"email": second_user.email, "role": "editor"},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    async def test_get_pending_invitations(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="pending", invited_by=1,
        )
        db.add(member)
        await db.flush()
        resp = await client.get("/api/v1/invitations/pending", headers=second_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    async def test_accepted_member_can_access_trip(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.get(
            f"/api/v1/trips/{trip_with_owner.id}/activity",
            headers=second_auth_headers,
        )
        assert resp.status_code == 200

    async def test_pending_member_cannot_access_trip(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="pending",
        )
        db.add(member)
        await db.flush()
        resp = await client.get(
            f"/api/v1/trips/{trip_with_owner.id}/activity",
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

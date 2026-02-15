import pytest
from app.models.trip_member import TripMember
from app.models.comment import Comment


class TestComments:
    async def test_create_comment_on_poi(self, db, client, trip_with_owner, created_destination, created_poi, auth_headers):
        resp = await client.post(
            f"/api/v1/trips/{trip_with_owner.id}/comments",
            json={"entity_type": "poi", "entity_id": created_poi.id, "content": "Great spot!"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["content"] == "Great spot!"

    async def test_create_reply_to_comment(self, db, client, trip_with_owner, created_poi, created_user, auth_headers):
        parent = Comment(
            trip_id=trip_with_owner.id, entity_type="poi",
            entity_id=created_poi.id, user_id=created_user.id, content="Parent",
        )
        db.add(parent)
        await db.flush()
        await db.refresh(parent)

        resp = await client.post(
            f"/api/v1/trips/{trip_with_owner.id}/comments",
            json={"entity_type": "poi", "entity_id": created_poi.id, "content": "Reply", "parent_id": parent.id},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["parent_id"] == parent.id

    async def test_list_comments_for_entity(self, db, client, trip_with_owner, created_poi, created_user, auth_headers):
        for i in range(3):
            db.add(Comment(
                trip_id=trip_with_owner.id, entity_type="poi",
                entity_id=created_poi.id, user_id=created_user.id, content=f"Comment {i}",
            ))
        await db.flush()
        resp = await client.get(
            f"/api/v1/trips/{trip_with_owner.id}/comments?entity_type=poi&entity_id={created_poi.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    async def test_edit_own_comment(self, db, client, trip_with_owner, created_user, created_poi, auth_headers):
        comment = Comment(
            trip_id=trip_with_owner.id, entity_type="poi",
            entity_id=created_poi.id, user_id=created_user.id, content="Original",
        )
        db.add(comment)
        await db.flush()
        await db.refresh(comment)
        resp = await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/comments/{comment.id}",
            json={"content": "Edited"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Edited"

    async def test_cannot_edit_others_comment(self, db, client, trip_with_owner, created_user, second_user, created_poi, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="accepted",
        )
        db.add(member)
        comment = Comment(
            trip_id=trip_with_owner.id, entity_type="poi",
            entity_id=created_poi.id, user_id=created_user.id, content="Owner's comment",
        )
        db.add(comment)
        await db.flush()
        await db.refresh(comment)
        resp = await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/comments/{comment.id}",
            json={"content": "Hacked"},
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

    async def test_delete_own_comment(self, db, client, trip_with_owner, created_user, created_poi, auth_headers):
        comment = Comment(
            trip_id=trip_with_owner.id, entity_type="poi",
            entity_id=created_poi.id, user_id=created_user.id, content="Delete me",
        )
        db.add(comment)
        await db.flush()
        await db.refresh(comment)
        resp = await client.delete(
            f"/api/v1/trips/{trip_with_owner.id}/comments/{comment.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_owner_can_delete_any_comment(self, db, client, trip_with_owner, second_user, created_poi, auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="editor", status="accepted",
        )
        db.add(member)
        comment = Comment(
            trip_id=trip_with_owner.id, entity_type="poi",
            entity_id=created_poi.id, user_id=second_user.id, content="Others comment",
        )
        db.add(comment)
        await db.flush()
        await db.refresh(comment)
        resp = await client.delete(
            f"/api/v1/trips/{trip_with_owner.id}/comments/{comment.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_non_member_cannot_comment(self, client, trip_with_owner, created_poi, second_auth_headers):
        resp = await client.post(
            f"/api/v1/trips/{trip_with_owner.id}/comments",
            json={"entity_type": "poi", "entity_id": created_poi.id, "content": "Spam"},
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

import pytest
from app.models.trip_member import TripMember
from app.models.poi_vote import POIVote
from sqlalchemy import select


class TestPOIVoting:
    """Note: POI voting endpoint (POST /pois/{id}/vote) needs to exist.
    These tests verify the model layer works correctly."""

    async def test_user_can_like_poi(self, db, created_user, created_poi):
        vote = POIVote(poi_id=created_poi.id, user_id=created_user.id, vote_type="like")
        db.add(vote)
        await db.flush()
        await db.refresh(vote)
        assert vote.vote_type == "like"

    async def test_user_can_veto_poi(self, db, created_user, created_poi):
        vote = POIVote(poi_id=created_poi.id, user_id=created_user.id, vote_type="veto")
        db.add(vote)
        await db.flush()
        await db.refresh(vote)
        assert vote.vote_type == "veto"

    async def test_each_user_has_independent_vote(self, db, created_user, second_user, created_poi):
        v1 = POIVote(poi_id=created_poi.id, user_id=created_user.id, vote_type="like")
        v2 = POIVote(poi_id=created_poi.id, user_id=second_user.id, vote_type="veto")
        db.add_all([v1, v2])
        await db.flush()

        stmt = select(POIVote).where(POIVote.poi_id == created_poi.id)
        result = await db.execute(stmt)
        votes = result.scalars().all()
        assert len(votes) == 2
        types = {v.vote_type for v in votes}
        assert types == {"like", "veto"}

from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from app.models.base import BaseModel


class POIVote(BaseModel):
    __tablename__ = "poi_votes"

    poi_id = Column(Integer, ForeignKey("pois.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote_type = Column(String(10), nullable=False)  # like, veto

    __table_args__ = (
        UniqueConstraint("poi_id", "user_id", name="uq_poi_vote_user"),
    )

    def __repr__(self):
        return f"<POIVote(poi_id={self.poi_id}, user_id={self.user_id}, type='{self.vote_type}')>"

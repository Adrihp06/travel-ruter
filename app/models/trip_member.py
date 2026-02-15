from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Index, UniqueConstraint
from app.models.base import BaseModel


class TripMember(BaseModel):
    __tablename__ = "trip_members"

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")  # owner, editor, viewer
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, accepted, rejected
    accepted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("trip_id", "user_id", name="uq_trip_member"),
        Index("ix_trip_members_user_id", "user_id"),
        Index("ix_trip_members_trip_user", "trip_id", "user_id"),
        Index("ix_trip_members_user_status", "user_id", "status"),
    )

    def __repr__(self):
        return f"<TripMember(trip_id={self.trip_id}, user_id={self.user_id}, role='{self.role}')>"

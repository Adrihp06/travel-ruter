from sqlalchemy import Column, String, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSON
from app.models.base import BaseModel


class ActivityLog(BaseModel):
    __tablename__ = "activity_logs"

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)  # created, updated, deleted
    entity_type = Column(String(50), nullable=False)  # poi, destination, accommodation, trip
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_activity_logs_trip_created", "trip_id", "created_at"),
        Index("ix_activity_logs_trip_entity", "trip_id", "entity_type"),
    )

    def __repr__(self):
        return f"<ActivityLog(trip_id={self.trip_id}, action='{self.action}', entity='{self.entity_type}')>"

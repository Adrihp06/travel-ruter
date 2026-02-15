from sqlalchemy import Column, String, Integer, ForeignKey, Text, DateTime, UniqueConstraint
from app.models.base import BaseModel


class TripApiKey(BaseModel):
    __tablename__ = "trip_api_keys"

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    service_name = Column(String(100), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_used_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("trip_id", "service_name", name="uq_trip_api_key_service"),
    )

    def __repr__(self):
        return f"<TripApiKey(trip_id={self.trip_id}, service='{self.service_name}')>"

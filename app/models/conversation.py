from sqlalchemy import Column, String, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import BaseModel


class Conversation(BaseModel):
    __tablename__ = "conversations"

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trip_id = Column(
        Integer,
        ForeignKey("trips.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(100), nullable=False, default="New Conversation")
    model_id = Column(String(100), nullable=True)
    message_count = Column(Integer, nullable=False, default=0)

    # JSONB blobs
    messages = Column(JSONB, nullable=False, default=[])
    backend_history = Column(JSONB, nullable=True)
    trip_context = Column(JSONB, nullable=True)
    destination_context = Column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_conversations_user_updated", "user_id", "updated_at"),
        Index("ix_conversations_user_trip", "user_id", "trip_id"),
    )

    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, title='{self.title}')>"

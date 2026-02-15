from sqlalchemy import Column, String, Integer, ForeignKey, Text, Index
from app.models.base import BaseModel


class Comment(BaseModel):
    __tablename__ = "comments"

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(50), nullable=False)  # poi, accommodation, destination
    entity_id = Column(Integer, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)

    __table_args__ = (
        Index("ix_comments_entity", "entity_type", "entity_id"),
        Index("ix_comments_trip", "trip_id"),
        Index("ix_comments_parent", "parent_id"),
    )

    def __repr__(self):
        return f"<Comment(id={self.id}, trip_id={self.trip_id}, entity='{self.entity_type}:{self.entity_id}')>"

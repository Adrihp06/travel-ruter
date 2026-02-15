from sqlalchemy import Column, String, Boolean, Index
from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    oauth_provider = Column(String(50), nullable=False)
    oauth_id = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_users_oauth_provider_id", "oauth_provider", "oauth_id", unique=True),
    )

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', provider='{self.oauth_provider}')>"

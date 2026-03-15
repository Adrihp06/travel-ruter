"""
RevokedToken model for MCP token revocation system.

Stores JTIs (JWT IDs) of revoked tokens so the MCP server
can reject them even before they expire.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from app.models.base import BaseModel


class RevokedToken(BaseModel):
    __tablename__ = "revoked_tokens"

    jti = Column(String(36), unique=True, nullable=False, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_type = Column(String(50), nullable=False)  # "mcp_access", "access", "refresh"
    revoked_at = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)  # when the token would have expired
    reason = Column(String(255), nullable=True)

    def __repr__(self):
        return f"<RevokedToken(jti='{self.jti}', user_id={self.user_id}, type='{self.token_type}')>"

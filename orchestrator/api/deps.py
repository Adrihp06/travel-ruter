"""Shared dependencies for orchestrator API routes."""

from __future__ import annotations

from fastapi import HTTPException, Request
from jose import JWTError, jwt as jose_jwt
from pydantic_ai import Agent

from orchestrator.config import settings
from orchestrator.session import SessionManager


async def verify_token(request: Request) -> int:
    """Verify JWT from Authorization header. Returns user_id."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = auth.split(" ", 1)[1]
    try:
        payload = jose_jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM],
        )
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_agent(request: Request) -> Agent:
    """Retrieve the shared PydanticAI agent from app state."""
    return request.app.state.agent


def get_session_manager(request: Request) -> SessionManager:
    """Retrieve the shared SessionManager from app state."""
    return request.app.state.session_manager

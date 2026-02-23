"""In-memory session manager (same behaviour as the TypeScript version)."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic_ai.messages import ModelMessage

from orchestrator.config import settings, get_available_models

logger = logging.getLogger("orchestrator.session")


@dataclass
class Session:
    id: str
    model_id: str
    pydantic_ai_model: str
    message_history: list[ModelMessage] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: int | None = None
    trip_id: int | None = None
    trip_context: dict[str, Any] | None = None
    chat_mode: str | None = None  # 'new' | 'existing' | None
    cancel_event: asyncio.Event = field(default_factory=lambda: asyncio.Event())
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _resolved_api_key: str | None = field(default=None, repr=False)


class SessionManager:
    """Mirrors the TypeScript SessionManager behaviour."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._cleanup_task: asyncio.Task | None = None

    # -- lifecycle -----------------------------------------------------------

    def start_cleanup(self) -> None:
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    def stop_cleanup(self) -> None:
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()

    # -- CRUD ----------------------------------------------------------------

    async def create_session(
        self,
        model_id: str | None = None,
        trip_id: int | None = None,
        trip_context: dict[str, Any] | None = None,
        pydantic_ai_model: str | None = None,
        message_history: list[ModelMessage] | None = None,
        chat_mode: str | None = None,
    ) -> Session:
        from orchestrator.agent import resolve_model_name

        if not model_id:
            models = await get_available_models()
            default = next((m for m in models if m.is_default), None)
            model_id = default.id if default else (models[0].id if models else "claude-sonnet-4-5-20250929")

        pai_model = pydantic_ai_model or resolve_model_name(model_id)

        session = Session(
            id=str(uuid4()),
            model_id=model_id,
            pydantic_ai_model=pai_model,
            trip_id=trip_id,
            trip_context=trip_context,
            chat_mode=chat_mode,
        )
        if message_history:
            session.message_history = message_history
        self._sessions[session.id] = session
        logger.info("Created session %s with model %s trip_id=%s (restored_messages=%d)", session.id, model_id, trip_id, len(session.message_history))
        return session

    def update_context(self, session_id: str, trip_context: dict[str, Any]) -> Session | None:
        session = self._sessions.get(session_id)
        if not session:
            return None
        session.trip_context = trip_context
        session.last_activity = datetime.now(timezone.utc)
        logger.info("Updated context for session %s", session_id)
        return session

    def get_session(self, session_id: str) -> Session | None:
        session = self._sessions.get(session_id)
        if session:
            session.last_activity = datetime.now(timezone.utc)
        return session

    def delete_session(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        if session:
            session.cancel_event.set()
            del self._sessions[session_id]
            return True
        return False

    def list_sessions(self) -> list[dict]:
        return [
            {
                "id": s.id,
                "modelId": s.model_id,
                "messageCount": len(s.message_history),
                "createdAt": s.created_at.isoformat(),
            }
            for s in self._sessions.values()
        ]

    # -- history management --------------------------------------------------

    @staticmethod
    def truncate_history(session: Session) -> None:
        """Keep first 2 + last N messages (same as manager.ts lines 298-308)."""
        max_history = settings.max_session_history
        if len(session.message_history) > max_history:
            keep_start = 2
            keep_end = max_history - keep_start
            session.message_history = (
                session.message_history[:keep_start]
                + session.message_history[-keep_end:]
            )

    # -- cancellation --------------------------------------------------------

    def cancel_chat(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if session:
            session.cancel_event.set()

    # -- cleanup expired sessions every 60s ----------------------------------

    async def _cleanup_loop(self) -> None:
        """Remove sessions inactive for >60 minutes (same as manager.ts 310-321)."""
        while True:
            await asyncio.sleep(60)
            now = datetime.now(timezone.utc)
            timeout_s = settings.session_timeout * 60
            expired = [
                sid
                for sid, s in self._sessions.items()
                if (now - s.last_activity).total_seconds() > timeout_s
            ]
            for sid in expired:
                try:
                    logger.info("Cleaning up expired session %s", sid)
                    self.delete_session(sid)
                except Exception:
                    logger.exception("Failed to clean up session %s", sid)

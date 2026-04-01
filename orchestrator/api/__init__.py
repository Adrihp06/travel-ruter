"""Orchestrator API router aggregation."""

from __future__ import annotations

from fastapi import APIRouter

from orchestrator.api.chat import router as chat_router
from orchestrator.api.health import router as health_router
from orchestrator.api.providers import router as providers_router
from orchestrator.api.sessions import router as sessions_router
from orchestrator.api.voice import router as voice_router

router = APIRouter()
router.include_router(health_router)
router.include_router(chat_router)
router.include_router(providers_router)
router.include_router(sessions_router)
router.include_router(voice_router)

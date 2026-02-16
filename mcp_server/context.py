"""
Application context for MCP server.

Provides database sessions and service instances for tool implementations.
Uses the same patterns as the FastAPI backend but manages its own lifecycle.
"""

import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from mcp_server.config import mcp_settings

logger = logging.getLogger(__name__)


@dataclass
class AppContext:
    """Application context holding shared resources."""

    engine: any
    session_factory: async_sessionmaker
    _services_cache: dict = None

    def __post_init__(self):
        self._services_cache = {}


# Global context instance
_context: Optional[AppContext] = None


async def init_context() -> AppContext:
    """Initialize the application context with database connection."""
    global _context

    if _context is not None:
        return _context

    logger.info("Initializing MCP server context...")

    # Create async engine
    engine = create_async_engine(
        mcp_settings.DATABASE_URL,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

    # Create session factory
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    _context = AppContext(
        engine=engine,
        session_factory=session_factory,
    )

    logger.info("MCP server context initialized successfully")
    return _context


async def cleanup_context():
    """Cleanup the application context."""
    global _context

    if _context is not None:
        logger.info("Cleaning up MCP server context...")
        await _context.engine.dispose()
        _context = None
        logger.info("MCP server context cleaned up")


def get_context() -> AppContext:
    """Get the current application context."""
    if _context is None:
        raise RuntimeError("Application context not initialized. Call init_context() first.")
    return _context


@asynccontextmanager
async def get_db_session():
    """
    Async context manager for database sessions.

    Usage:
        async with get_db_session() as db:
            result = await db.execute(query)
    """
    ctx = get_context()
    async with ctx.session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Service getters - lazy initialization


def get_google_places_service():
    """Get or create GooglePlacesService instance."""
    from app.services.google_places_service import GooglePlacesService

    ctx = get_context()
    if "google_places" not in ctx._services_cache:
        ctx._services_cache["google_places"] = GooglePlacesService(
            api_key=mcp_settings.GOOGLE_MAPS_API_KEY
        )
    return ctx._services_cache["google_places"]


def get_ors_service():
    """Get or create OpenRouteService instance."""
    from app.services.openrouteservice import OpenRouteServiceService

    ctx = get_context()
    if "ors" not in ctx._services_cache:
        ctx._services_cache["ors"] = OpenRouteServiceService(
            api_key=mcp_settings.OPENROUTESERVICE_API_KEY
        )
    return ctx._services_cache["ors"]


def get_geocoding_service():
    """Get GeocodingService class (it uses class methods)."""
    from app.services.geocoding_service import GeocodingService

    return GeocodingService


def get_perplexity_service():
    """Get or create PerplexitySearchService instance."""
    from app.services.perplexity_service import PerplexitySearchService

    ctx = get_context()
    if "perplexity" not in ctx._services_cache:
        ctx._services_cache["perplexity"] = PerplexitySearchService(
            api_key=mcp_settings.PERPLEXITY_API_KEY or "",
            model=mcp_settings.PERPLEXITY_MODEL,
        )
    return ctx._services_cache["perplexity"]

"""
Configuration for the MCP server.

Inherits settings from the main app config and adds MCP-specific settings.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class MCPSettings(BaseSettings):
    """MCP server specific settings."""

    # Server identity
    MCP_SERVER_NAME: str = "travel-bridge"
    MCP_SERVER_VERSION: str = "1.0.0"

    # Backend API connection (uses Docker network hostname; overridable via env)
    BACKEND_URL: str = "http://backend:8000"
    BACKEND_API_PREFIX: str = "/api/v1"

    # Database (uses Docker network hostname; overridable via env)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/travel_ruter"

    # External APIs (inherited from main app)
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    OPENROUTESERVICE_API_KEY: Optional[str] = None
    MAPBOX_ACCESS_TOKEN: Optional[str] = None

    # OpenAI (for POI suggestions via web search)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_SEARCH_MODEL: str = "gpt-4o-search-preview"

    # MCP-specific settings
    ENABLE_CACHING: bool = True
    CACHE_TTL_SECONDS: int = 300  # 5 minutes default
    MAX_RESULTS_PER_TOOL: int = 50

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Singleton instance
mcp_settings = MCPSettings()

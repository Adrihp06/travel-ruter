"""
Travel Bridge MCP Server

A FastMCP server that exposes travel planning tools to AI models.
Integrates with the existing FastAPI backend services for:
- Destination search and geocoding
- POI suggestions and smart scheduling
- Route calculation and travel matrix
- Trip management
- Budget calculation
"""

import logging
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP

from mcp_server.config import mcp_settings
from mcp_server.context import init_context, cleanup_context

# Configure logging
logging.basicConfig(
    level=getattr(logging, mcp_settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(server: FastMCP):
    """
    Lifespan context manager for the MCP server.

    Initializes database connections and service instances on startup,
    and cleans them up on shutdown.
    """
    logger.info(f"Starting {mcp_settings.MCP_SERVER_NAME} v{mcp_settings.MCP_SERVER_VERSION}")

    # Initialize application context
    await init_context()

    try:
        yield
    finally:
        # Cleanup on shutdown
        await cleanup_context()
        logger.info("MCP server shutdown complete")


def create_server() -> FastMCP:
    """
    Create and configure the FastMCP server with all tools registered.

    Returns:
        Configured FastMCP server instance
    """
    server = FastMCP(
        name=mcp_settings.MCP_SERVER_NAME,
        lifespan=lifespan,
    )

    # Register all tools
    _register_tools(server)

    return server


def _register_tools(server: FastMCP):
    """Register all MCP tools with the server."""

    # Import tool modules - they register themselves when imported
    from mcp_server.tools import destinations
    from mcp_server.tools import pois
    from mcp_server.tools import routes
    from mcp_server.tools import trips
    from mcp_server.tools import budget
    from mcp_server.tools import scheduler
    from mcp_server.tools import accommodations

    # Register tools from each module
    destinations.register_tools(server)
    pois.register_tools(server)
    routes.register_tools(server)
    trips.register_tools(server)
    budget.register_tools(server)
    scheduler.register_tools(server)
    accommodations.register_tools(server)

    logger.info("All MCP tools registered successfully")


# For direct execution
if __name__ == "__main__":
    server = create_server()
    server.run()

"""
Travel Bridge MCP Server

A FastMCP server that exposes travel planning tools to AI models.
Integrates with the existing FastAPI backend services for:
- Destination search and geocoding
- POI suggestions and smart scheduling
- Route calculation and travel matrix
- Trip management
- Budget calculation

Supports dual transport:
- stdio (default): used by the orchestrator subprocess (all tools including web_search)
- streamable-http: used by remote AI clients (web_search excluded — clients use their own)
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


def create_server(
    transport: str = "stdio",
    host: str | None = None,
    port: int | None = None,
) -> FastMCP:
    """
    Create and configure the FastMCP server with all tools registered.

    Args:
        transport: "stdio" for orchestrator subprocess, "streamable-http" for remote access
        host: HTTP bind address (only used for streamable-http transport)
        port: HTTP listen port (only used for streamable-http transport)

    Returns:
        Configured FastMCP server instance
    """
    kwargs = {
        "name": mcp_settings.MCP_SERVER_NAME,
        "lifespan": lifespan,
    }

    if transport == "streamable-http":
        from pydantic import AnyHttpUrl
        from mcp_server.auth import TravelRuterTokenVerifier
        from mcp.server.auth.settings import AuthSettings

        kwargs["host"] = host or mcp_settings.MCP_HTTP_HOST
        kwargs["port"] = port or mcp_settings.MCP_HTTP_PORT
        kwargs["token_verifier"] = TravelRuterTokenVerifier()
        kwargs["auth"] = AuthSettings(
            issuer_url=AnyHttpUrl(mcp_settings.MCP_AUTH_ISSUER_URL),
            resource_server_url=AnyHttpUrl(mcp_settings.MCP_RESOURCE_SERVER_URL),
            required_scopes=["mcp"],
        )
        kwargs["json_response"] = True
        logger.info("Configured for HTTP transport with JWT authentication")

    server = FastMCP(**kwargs)

    # Inject rate limiting middleware for HTTP transport
    if transport == "streamable-http":
        _original_streamable_http_app = server.streamable_http_app

        def _patched_streamable_http_app():
            from mcp_server.rate_limit import RateLimitMiddleware

            app = _original_streamable_http_app()
            app.add_middleware(RateLimitMiddleware)
            return app

        server.streamable_http_app = _patched_streamable_http_app

    # Health endpoint for Docker health checks and debugging
    @server.custom_route("/health", methods=["GET"])
    async def health_check(request):
        from starlette.responses import JSONResponse

        return JSONResponse({"status": "ok", "service": mcp_settings.MCP_SERVER_NAME})

    # OAuth authorization server metadata (RFC 8414)
    # Required by MCP SDK clients to complete the auth discovery flow.
    # Since we use a custom TokenVerifier with pre-issued JWTs (not a real
    # OAuth server), this returns minimal metadata indicating Bearer token support.
    @server.custom_route("/.well-known/oauth-authorization-server", methods=["GET"])
    async def oauth_authorization_server_metadata(request):
        from starlette.responses import JSONResponse

        return JSONResponse({
            "issuer": mcp_settings.MCP_AUTH_ISSUER_URL,
            "token_endpoint": f"{mcp_settings.MCP_AUTH_ISSUER_URL}/oauth/token",
            "response_types_supported": ["token"],
            "grant_types_supported": ["client_credentials"],
            "token_endpoint_auth_methods_supported": ["none"],
            "scopes_supported": ["mcp"],
        })

    # Register all tools
    _register_tools(server, transport)

    return server


def _register_tools(server: FastMCP, transport: str = "stdio"):
    """Register MCP tools with the server.

    The ``web_search`` tool is only registered for the stdio transport
    (internal orchestrator).  Remote clients connecting over HTTP already
    have their own built-in web search (Claude, Codex, Gemini, Copilot),
    so exposing ours would just incur unnecessary API costs.
    """

    # Import tool modules - they register themselves when imported
    from mcp_server.tools import destinations
    from mcp_server.tools import pois
    from mcp_server.tools import routes
    from mcp_server.tools import trips
    from mcp_server.tools import budget
    from mcp_server.tools import scheduler
    from mcp_server.tools import accommodations
    from mcp_server.tools import notes

    # Register tools from each module
    destinations.register_tools(server)
    pois.register_tools(server)
    routes.register_tools(server)
    trips.register_tools(server)
    budget.register_tools(server)
    scheduler.register_tools(server)
    accommodations.register_tools(server)
    notes.register_tools(server)

    # Hotel search and trip export tools
    from mcp_server.tools import hotels_export
    hotels_export.register_tools(server)

    # Export document scaffolding (AI-driven document generation)
    from mcp_server.tools import export_scaffold
    export_scaffold.register_tools(server)

    # Only expose web_search to the internal orchestrator (stdio).
    # Remote clients should use their provider's built-in web search.
    if transport == "stdio":
        from mcp_server.tools import web_search
        web_search.register_tools(server)
        logger.info("web_search tool registered (stdio transport)")
    else:
        logger.info("web_search tool skipped (remote clients use their own)")

    logger.info("All MCP tools registered successfully")


# For direct execution
if __name__ == "__main__":
    server = create_server()
    server.run()

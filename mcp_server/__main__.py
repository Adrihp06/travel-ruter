"""
Entry point for running the MCP server.

Usage:
    python -m mcp_server                              # stdio (default, for orchestrator)
    python -m mcp_server --transport streamable-http   # HTTP (for remote Claude clients)
    mcp dev mcp_server                                 # MCP inspector (stdio)
"""

import argparse

from mcp_server.server import create_server
from mcp_server.config import mcp_settings


def main():
    """Main entry point for the MCP server."""
    parser = argparse.ArgumentParser(description="Travel Ruter MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http"],
        default="stdio",
        help="Transport mode: stdio (orchestrator) or streamable-http (remote clients)",
    )
    parser.add_argument(
        "--host",
        default=None,
        help=f"HTTP host (default: {mcp_settings.MCP_HTTP_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help=f"HTTP port (default: {mcp_settings.MCP_HTTP_PORT})",
    )
    args = parser.parse_args()

    server = create_server(
        transport=args.transport,
        host=args.host,
        port=args.port,
    )

    if args.transport == "streamable-http":
        _run_http_with_rate_limiting(server)
    else:
        server.run(transport=args.transport)


def _run_http_with_rate_limiting(server):
    """Run the HTTP server with rate limiting middleware injected."""
    import anyio
    import uvicorn
    from mcp_server.rate_limit import RateLimitMiddleware

    async def serve():
        # Get the Starlette app from FastMCP
        starlette_app = server.streamable_http_app()

        # Add rate limiting middleware
        starlette_app.add_middleware(RateLimitMiddleware)

        config = uvicorn.Config(
            starlette_app,
            host=server.settings.host,
            port=server.settings.port,
            log_level=server.settings.log_level.lower(),
        )
        uvi_server = uvicorn.Server(config)
        await uvi_server.serve()

    anyio.run(serve)


if __name__ == "__main__":
    main()

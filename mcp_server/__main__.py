"""
Entry point for running the MCP server.

Usage:
    python -m mcp_server                              # stdio (default, for orchestrator)
    python -m mcp_server --transport streamable-http   # HTTP (for remote Claude clients)
    mcp dev mcp_server                                 # MCP inspector (stdio)
"""

import argparse

import anyio

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

    server = create_server(transport=args.transport)

    if args.transport == "streamable-http":
        host = args.host or mcp_settings.MCP_HTTP_HOST
        port = args.port or mcp_settings.MCP_HTTP_PORT
        # Call run_streamable_http_async directly via anyio to avoid
        # older mcp SDK versions where run() doesn't forward **kwargs.
        anyio.run(
            lambda: server.run_streamable_http_async(host=host, port=port),
            backend="asyncio",
            backend_options={"use_uvloop": False},
        )
    else:
        server.run()


if __name__ == "__main__":
    main()

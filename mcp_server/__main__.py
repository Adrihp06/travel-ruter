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

    server.run(transport=args.transport)


if __name__ == "__main__":
    main()

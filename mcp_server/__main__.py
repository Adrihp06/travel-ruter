"""
Entry point for running the MCP server.

Usage:
    python -m mcp_server
    mcp dev mcp_server
"""

import asyncio
from mcp_server.server import create_server


def main():
    """Main entry point for the MCP server."""
    server = create_server()
    server.run()


if __name__ == "__main__":
    main()

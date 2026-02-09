"""FastAPI app, lifespan, CORS, uvicorn entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from orchestrator.agent import create_agent, create_mcp_server
from orchestrator.config import ensure_provider_env, settings
from orchestrator.routes import router
from orchestrator.session import SessionManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("orchestrator")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle (replaces ``index.ts`` + ``createServer()``)."""
    logger.info("Starting Travel Bridge Orchestrator...")
    logger.info("Version: %s", settings.version)
    logger.info("Port: %s", settings.port)

    # Populate env vars from credential files
    ensure_provider_env()

    # Create MCP server (spawns python subprocess)
    mcp = create_mcp_server()

    try:
        await mcp.__aenter__()
        logger.info("MCP server connected")
        # Log available tools for debugging
        tools = getattr(mcp, '_tools', None) or getattr(mcp, 'tools', None)
        if tools:
            tool_names = [t.name for t in tools] if hasattr(next(iter(tools), None), 'name') else tools
            logger.info("Available MCP tools: %s", tool_names)
    except Exception as exc:
        logger.warning("MCP server connection failed, tools will be unavailable: %s", exc)

    # Create PydanticAI agent
    agent = create_agent(mcp)

    # Session manager with periodic cleanup
    session_manager = SessionManager()
    session_manager.start_cleanup()

    # Store on app.state for access in routes
    app.state.mcp = mcp
    app.state.agent = agent
    app.state.session_manager = session_manager

    logger.info("Orchestrator running at http://localhost:%s", settings.port)
    logger.info("Available endpoints:")
    logger.info("  GET  /api/models      - List available AI models")
    logger.info("  POST /api/sessions    - Create a chat session")
    logger.info("  WS   /api/chat/stream - Streaming chat endpoint")
    logger.info("  GET  /health          - Health check")

    yield

    # Shutdown
    logger.info("Shutting down orchestrator...")
    session_manager.stop_cleanup()
    try:
        await mcp.__aexit__(None, None, None)
    except Exception:
        pass


app = FastAPI(title="Travel Bridge Orchestrator", lifespan=lifespan)

# CORS – allow all origins (same as Express ``cors()`` with defaults)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(
        "orchestrator.main:app",
        host="0.0.0.0",
        port=settings.port,
        log_level="info",
    )

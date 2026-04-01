"""Voice tool declarations and dispatch for the Gemini Live voice agent.

Hardcoded Gemini function declarations for MCP backend tools (since
MCPServerStdio does not expose tool schemas at runtime) plus frontend
tool declarations.  Also provides helpers to classify and execute tools.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("orchestrator.services.voice_tools")

# Backend base URL (same convention as chat_service.py)
_BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

# ---------------------------------------------------------------------------
# Backend tool declarations (Gemini format) -- hardcoded from MCP tool schemas
# ---------------------------------------------------------------------------

BACKEND_TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "search_destinations",
        "description": "Search for destinations/locations by name or address. Returns coordinates needed for other tools.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Location search query. Be specific: 'Barcelona, Spain' rather than just 'Barcelona'.",
                },
                "limit": {
                    "type": "INTEGER",
                    "description": "Maximum results (1-20, default 5).",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_poi_suggestions",
        "description": "Discover attractions, restaurants, and activities near a location. Use search_destinations first to get coordinates.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "latitude": {
                    "type": "NUMBER",
                    "description": "Latitude from search_destinations result.",
                },
                "longitude": {
                    "type": "NUMBER",
                    "description": "Longitude from search_destinations result.",
                },
                "category": {
                    "type": "STRING",
                    "description": "Category filter: Sights, Museums, Food, Nature, Entertainment, Shopping, Activity.",
                },
                "max_results": {
                    "type": "INTEGER",
                    "description": "How many suggestions (1-50, default 20).",
                },
                "min_rating": {
                    "type": "NUMBER",
                    "description": "Minimum rating filter (e.g. 4.0).",
                },
            },
            "required": ["latitude", "longitude"],
        },
    },
    {
        "name": "manage_trip",
        "description": "Full trip management: create, read, update, delete, or list trips.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "operation": {
                    "type": "STRING",
                    "description": "Operation: create, read, update, delete, list.",
                    "enum": ["create", "read", "update", "delete", "list"],
                },
                "trip_id": {
                    "type": "INTEGER",
                    "description": "Trip ID (required for read, update, delete).",
                },
                "name": {
                    "type": "STRING",
                    "description": "Trip name (required for create).",
                },
                "location": {
                    "type": "STRING",
                    "description": "Primary destination (e.g. 'Rome, Italy').",
                },
                "start_date": {
                    "type": "STRING",
                    "description": "Start date in YYYY-MM-DD format.",
                },
                "end_date": {
                    "type": "STRING",
                    "description": "End date in YYYY-MM-DD format.",
                },
                "total_budget": {
                    "type": "NUMBER",
                    "description": "Trip budget amount.",
                },
                "currency": {
                    "type": "STRING",
                    "description": "Currency code (EUR, USD, GBP, etc.).",
                },
                "confirmed": {
                    "type": "BOOLEAN",
                    "description": "Set to true after user confirms the action.",
                },
            },
            "required": ["operation"],
        },
    },
    {
        "name": "manage_poi",
        "description": "Full POI management: create, read, update, delete, or list Points of Interest.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "operation": {
                    "type": "STRING",
                    "description": "Operation: create, read, update, delete, list.",
                    "enum": ["create", "read", "update", "delete", "list"],
                },
                "poi_id": {
                    "type": "INTEGER",
                    "description": "POI ID (required for read, update, delete).",
                },
                "destination_id": {
                    "type": "INTEGER",
                    "description": "Destination ID (required for create, list).",
                },
                "name": {
                    "type": "STRING",
                    "description": "POI name (required for create).",
                },
                "category": {
                    "type": "STRING",
                    "description": "Category: Sights, Museums, Food, Nature, Entertainment, Shopping, Activity.",
                },
                "latitude": {
                    "type": "NUMBER",
                    "description": "POI latitude.",
                },
                "longitude": {
                    "type": "NUMBER",
                    "description": "POI longitude.",
                },
                "estimated_cost": {
                    "type": "NUMBER",
                    "description": "Estimated cost for this POI.",
                },
                "dwell_time": {
                    "type": "INTEGER",
                    "description": "Expected time at POI in minutes.",
                },
                "confirmed": {
                    "type": "BOOLEAN",
                    "description": "Set to true after user confirms the action.",
                },
            },
            "required": ["operation"],
        },
    },
    {
        "name": "calculate_route",
        "description": "Calculate a route between two points. Returns distance and travel time.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "origin_lat": {
                    "type": "NUMBER",
                    "description": "Starting point latitude.",
                },
                "origin_lon": {
                    "type": "NUMBER",
                    "description": "Starting point longitude.",
                },
                "destination_lat": {
                    "type": "NUMBER",
                    "description": "Ending point latitude.",
                },
                "destination_lon": {
                    "type": "NUMBER",
                    "description": "Ending point longitude.",
                },
                "profile": {
                    "type": "STRING",
                    "description": "Transport mode: foot-walking, cycling-regular, driving-car.",
                },
            },
            "required": ["origin_lat", "origin_lon", "destination_lat", "destination_lon"],
        },
    },
    {
        "name": "generate_smart_schedule",
        "description": "Generate a smart schedule distributing POIs across available trip days.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "pois": {
                    "type": "ARRAY",
                    "items": {"type": "OBJECT"},
                    "description": "List of POIs to schedule. Each needs: id, name, category, latitude, longitude.",
                },
                "days": {
                    "type": "ARRAY",
                    "items": {"type": "OBJECT"},
                    "description": "Available days. Each needs: date (YYYY-MM-DD), day_number.",
                },
                "max_hours_per_day": {
                    "type": "INTEGER",
                    "description": "Maximum activity hours per day (default 8).",
                },
            },
            "required": ["pois", "days"],
        },
    },
    {
        "name": "calculate_budget",
        "description": "Calculate budget summary and cost analysis for a trip.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "trip_id": {
                    "type": "INTEGER",
                    "description": "Trip ID to calculate budget for.",
                },
            },
            "required": ["trip_id"],
        },
    },
]

BACKEND_TOOL_NAMES: set[str] = {decl["name"] for decl in BACKEND_TOOL_DECLARATIONS}

# ---------------------------------------------------------------------------
# Frontend tool declarations (Gemini format)
# Names MUST match frontend/src/utils/voiceFrontendTools.js TOOL_HANDLERS keys
# ---------------------------------------------------------------------------

FRONTEND_TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "navigate_to",
        "description": "Navigate the user's browser to a specific page in the app.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "page": {
                    "type": "STRING",
                    "description": "Target route: '/trips', '/trips/123', '/settings', '/ai-settings'.",
                },
            },
            "required": ["page"],
        },
    },
    {
        "name": "show_on_map",
        "description": "Pan and zoom the map to show a specific location.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "latitude": {
                    "type": "NUMBER",
                    "description": "Center latitude.",
                },
                "longitude": {
                    "type": "NUMBER",
                    "description": "Center longitude.",
                },
                "zoom": {
                    "type": "NUMBER",
                    "description": "Map zoom level (1-20, default 14).",
                },
                "label": {
                    "type": "STRING",
                    "description": "Label for the map marker.",
                },
            },
            "required": ["latitude", "longitude"],
        },
    },
    {
        "name": "highlight_poi",
        "description": "Highlight a specific POI on the map and in the sidebar list.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "poi_id": {
                    "type": "NUMBER",
                    "description": "The POI ID to highlight.",
                },
            },
            "required": ["poi_id"],
        },
    },
    {
        "name": "open_modal",
        "description": "Open a modal dialog. Types: poi_detail, add_poi, trip_summary.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "type": {
                    "type": "STRING",
                    "description": "Modal type: 'poi_detail', 'add_poi', 'trip_summary'.",
                },
                "data": {
                    "type": "OBJECT",
                    "description": "Data to pass to the modal (e.g. {poiId: 123} or {tripId: 1}).",
                },
            },
            "required": ["type"],
        },
    },
    {
        "name": "scroll_to",
        "description": "Scroll the page to a specific element by its DOM id.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "element_id": {
                    "type": "STRING",
                    "description": "The DOM element id to scroll to (e.g. 'day-3', 'poi-list').",
                },
            },
            "required": ["element_id"],
        },
    },
    {
        "name": "show_notification",
        "description": "Show a toast notification to the user.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "message": {
                    "type": "STRING",
                    "description": "Notification message text.",
                },
                "type": {
                    "type": "STRING",
                    "description": "Notification type: 'info', 'success', 'warning', 'error'.",
                },
            },
            "required": ["message"],
        },
    },
]

FRONTEND_TOOL_NAMES: set[str] = {decl["name"] for decl in FRONTEND_TOOL_DECLARATIONS}


def classify_tool(name: str) -> str:
    """Classify a tool as 'backend', 'frontend', or 'unknown'.

    Returns:
        One of ``"backend"``, ``"frontend"``, or ``"unknown"``.
    """
    if name in BACKEND_TOOL_NAMES:
        return "backend"
    if name in FRONTEND_TOOL_NAMES:
        return "frontend"
    return "unknown"


# ---------------------------------------------------------------------------
# Get all tool declarations for Gemini
# ---------------------------------------------------------------------------

def get_all_tool_declarations(mcp) -> list[dict[str, Any]]:
    """Build the full list of Gemini tool declarations.

    Uses hardcoded backend declarations (MCP tools) plus frontend declarations.
    The ``mcp`` argument is accepted for API compatibility but not used.

    Returns:
        A list of Gemini ``tools`` objects, each containing ``functionDeclarations``.
    """
    declarations: list[dict[str, Any]] = []

    # 1) Hardcoded backend tool declarations
    declarations.extend(BACKEND_TOOL_DECLARATIONS)

    # 2) Frontend tool declarations
    declarations.extend(FRONTEND_TOOL_DECLARATIONS)

    logger.info(
        "Voice tool declarations ready: %d backend + %d frontend = %d total",
        len(BACKEND_TOOL_DECLARATIONS),
        len(FRONTEND_TOOL_DECLARATIONS),
        len(declarations),
    )

    # Gemini expects: [{"functionDeclarations": [...]}]
    return [{"functionDeclarations": declarations}]


# ---------------------------------------------------------------------------
# Backend tool execution via MCP client session
# ---------------------------------------------------------------------------

async def _execute_via_mcp_session(mcp, name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Try to execute a tool through the MCP client session.

    After ``mcp.__aenter__()``, ``MCPServerStdio`` stores the underlying
    MCP ``ClientSession``.  We try several known attribute paths across
    pydantic-ai versions.
    """
    # Try well-known attribute paths for the underlying ClientSession
    client = None
    for attr in ("_client", "client", "_session", "session"):
        client = getattr(mcp, attr, None)
        if client is not None and hasattr(client, "call_tool"):
            break
        client = None

    # Try nested server wrapper
    if client is None:
        for server_attr in ("_server", "server"):
            server = getattr(mcp, server_attr, None)
            if server:
                for attr in ("_client", "client", "session"):
                    client = getattr(server, attr, None)
                    if client is not None and hasattr(client, "call_tool"):
                        break
                    client = None
            if client:
                break

    if client is None:
        raise RuntimeError(f"Cannot find MCP client session on mcp object: {dir(mcp)}")

    # MCP ClientSession.call_tool(name, arguments) -> CallToolResult
    # Voice agent uses a tighter timeout than text chat to keep conversations responsive
    result = await asyncio.wait_for(client.call_tool(name, args), timeout=15.0)

    # Extract text content
    if hasattr(result, "content"):
        content = result.content
        if isinstance(content, list):
            parts = []
            for item in content:
                if hasattr(item, "text"):
                    parts.append(item.text)
                else:
                    parts.append(str(item))
            text = "\n".join(parts)
        elif isinstance(content, str):
            text = content
        else:
            text = str(content)
    else:
        text = str(result)

    is_error = getattr(result, "isError", False) or getattr(result, "is_error", False)
    return {"result": text, "isError": bool(is_error)}


async def _execute_via_http(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Fallback: execute a backend tool by calling the backend REST API directly.

    Maps MCP tool names to backend API endpoints.  This avoids relying on
    MCP internals and is more robust for the voice agent use case.
    """
    async with httpx.AsyncClient(base_url=_BACKEND_URL, timeout=30.0) as client:
        try:
            if name == "search_destinations":
                params = {"q": args.get("query", ""), "limit": args.get("limit", 5)}
                resp = await client.get("/api/v1/destinations/search", params=params)

            elif name == "get_poi_suggestions":
                params = {
                    "latitude": args.get("latitude"),
                    "longitude": args.get("longitude"),
                    "radius": args.get("radius", 5000),
                    "max_results": args.get("max_results", 20),
                }
                if args.get("category"):
                    params["category"] = args["category"]
                if args.get("min_rating"):
                    params["min_rating"] = args["min_rating"]
                resp = await client.get("/api/v1/pois/suggestions", params=params)

            elif name == "manage_trip":
                operation = args.get("operation", "list")
                trip_id = args.get("trip_id")
                if operation == "list":
                    resp = await client.get("/api/v1/trips")
                elif operation == "read" and trip_id:
                    resp = await client.get(f"/api/v1/trips/{trip_id}")
                elif operation == "create":
                    body = {k: v for k, v in args.items() if k != "operation" and v is not None}
                    resp = await client.post("/api/v1/trips", json=body)
                elif operation == "update" and trip_id:
                    body = {k: v for k, v in args.items() if k not in ("operation", "trip_id") and v is not None}
                    resp = await client.put(f"/api/v1/trips/{trip_id}", json=body)
                elif operation == "delete" and trip_id:
                    resp = await client.delete(f"/api/v1/trips/{trip_id}")
                else:
                    return {"result": f"Invalid manage_trip call: operation={operation}, trip_id={trip_id}", "isError": True}

            elif name == "manage_poi":
                operation = args.get("operation", "list")
                poi_id = args.get("poi_id")
                dest_id = args.get("destination_id")
                if operation == "list" and dest_id:
                    resp = await client.get(f"/api/v1/destinations/{dest_id}/pois")
                elif operation == "read" and poi_id:
                    resp = await client.get(f"/api/v1/pois/{poi_id}")
                elif operation == "create" and dest_id:
                    body = {k: v for k, v in args.items() if k not in ("operation", "destination_id") and v is not None}
                    resp = await client.post(f"/api/v1/destinations/{dest_id}/pois", json=body)
                elif operation == "update" and poi_id:
                    body = {k: v for k, v in args.items() if k not in ("operation", "poi_id") and v is not None}
                    resp = await client.put(f"/api/v1/pois/{poi_id}", json=body)
                elif operation == "delete" and poi_id:
                    resp = await client.delete(f"/api/v1/pois/{poi_id}")
                else:
                    return {"result": f"Invalid manage_poi call: operation={operation}", "isError": True}

            elif name == "calculate_route":
                body = {
                    "origin_lat": args.get("origin_lat"),
                    "origin_lon": args.get("origin_lon"),
                    "destination_lat": args.get("destination_lat"),
                    "destination_lon": args.get("destination_lon"),
                    "profile": args.get("profile", "foot-walking"),
                }
                resp = await client.post("/api/v1/routes/calculate", json=body)

            elif name == "calculate_budget":
                trip_id = args.get("trip_id")
                resp = await client.get(f"/api/v1/trips/{trip_id}/budget")

            elif name == "generate_smart_schedule":
                resp = await client.post("/api/v1/scheduler/generate", json=args)

            else:
                return {"result": f"No HTTP mapping for tool: {name}", "isError": True}

            resp.raise_for_status()
            return {"result": json.dumps(resp.json()), "isError": False}

        except httpx.HTTPStatusError as exc:
            error_text = exc.response.text[:500] if exc.response else str(exc)
            return {"result": f"HTTP {exc.response.status_code}: {error_text}", "isError": True}
        except Exception as exc:
            return {"result": f"HTTP request failed: {exc}", "isError": True}


async def execute_backend_tool(mcp, name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Execute a backend tool, trying MCP session first, then HTTP fallback.

    Args:
        mcp: The ``MCPServerStdio`` instance (may be None).
        name: Tool name.
        args: Tool arguments dict.

    Returns:
        A dict with ``result`` (str) and ``isError`` (bool) keys.
    """
    # 1) Try MCP client session if available (15s timeout for voice responsiveness)
    if mcp is not None:
        try:
            result = await _execute_via_mcp_session(mcp, name, args)
            logger.info("Backend tool %s executed via MCP session", name)
            return result
        except asyncio.TimeoutError:
            logger.warning("MCP tool %s timed out after 15s", name)
            return {"result": f"Tool '{name}' timed out. The operation may be taking too long.", "isError": True}
        except Exception as exc:
            logger.warning(
                "MCP session execution failed for %s, falling back to HTTP: %s",
                name, exc,
            )

    # 2) Fallback: direct HTTP call to backend API
    try:
        result = await _execute_via_http(name, args)
        logger.info("Backend tool %s executed via HTTP fallback", name)
        return result
    except Exception as exc:
        logger.exception("Backend tool execution failed: %s(%s)", name, args)
        return {"result": f"Tool execution error: {exc}", "isError": True}

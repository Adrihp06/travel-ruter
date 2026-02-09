"""
MCP Tools for Travel Bridge

Each module in this package implements one or more MCP tools
that integrate with the FastAPI backend services.

Tools:
- destinations: search_destinations (geocoding)
- pois: get_poi_suggestions
- routes: calculate_route, get_travel_matrix
- trips: manage_trip (CRUD operations)
- budget: calculate_budget
- scheduler: generate_smart_schedule
"""

from mcp_server.tools.destinations import register_tools as register_destination_tools
from mcp_server.tools.pois import register_tools as register_poi_tools
from mcp_server.tools.routes import register_tools as register_route_tools
from mcp_server.tools.trips import register_tools as register_trip_tools
from mcp_server.tools.budget import register_tools as register_budget_tools
from mcp_server.tools.scheduler import register_tools as register_scheduler_tools

__all__ = [
    "register_destination_tools",
    "register_poi_tools",
    "register_route_tools",
    "register_trip_tools",
    "register_budget_tools",
    "register_scheduler_tools",
]

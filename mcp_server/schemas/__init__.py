"""
Pydantic schemas for MCP tool inputs and outputs.

These schemas define the structure of data exchanged between
AI models and the travel planning tools.
"""

from mcp_server.schemas.destinations import (
    SearchDestinationsInput,
    DestinationResult,
    ManageDestinationOutput,
    ManagedDestinationResult,
)
from mcp_server.schemas.pois import (
    GetPOISuggestionsInput,
    POISuggestion,
    ManagePOIOutput,
    POIResult,
    SchedulePOIsOutput,
)
from mcp_server.schemas.routes import (
    CalculateRouteInput,
    GetTravelMatrixInput,
    RouteResult,
    TravelMatrixResult,
)
from mcp_server.schemas.trips import (
    ManageTripInput,
    TripResult,
)
from mcp_server.schemas.budget import (
    CalculateBudgetInput,
    BudgetResult,
)
from mcp_server.schemas.scheduler import (
    GenerateSmartScheduleInput,
    SmartScheduleResult,
)

__all__ = [
    "SearchDestinationsInput",
    "DestinationResult",
    "ManageDestinationOutput",
    "ManagedDestinationResult",
    "GetPOISuggestionsInput",
    "POISuggestion",
    "ManagePOIOutput",
    "POIResult",
    "SchedulePOIsOutput",
    "CalculateRouteInput",
    "GetTravelMatrixInput",
    "RouteResult",
    "TravelMatrixResult",
    "ManageTripInput",
    "TripResult",
    "CalculateBudgetInput",
    "BudgetResult",
    "GenerateSmartScheduleInput",
    "SmartScheduleResult",
]

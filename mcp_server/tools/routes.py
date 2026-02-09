"""
MCP Tools: calculate_route, get_travel_matrix

Provides route calculation and travel time matrix capabilities
using OpenRouteService API.
"""

import logging
from typing import List, Optional

from mcp.server.fastmcp import FastMCP

from mcp_server.context import get_ors_service
from mcp_server.schemas.routes import (
    CalculateRouteInput,
    GetTravelMatrixInput,
    RouteResult,
    RouteSegment,
    TravelMatrixResult,
    MatrixEntry,
    TransportProfile,
    Coordinate,
)

logger = logging.getLogger(__name__)


def _format_duration(seconds: float) -> str:
    """Format duration in seconds to human-readable string."""
    minutes = int(seconds / 60)
    if minutes < 60:
        return f"{minutes} min"
    hours = minutes // 60
    remaining_minutes = minutes % 60
    if remaining_minutes == 0:
        return f"{hours}h"
    return f"{hours}h {remaining_minutes}min"


def register_tools(server: FastMCP):
    """Register route-related tools with the MCP server."""

    @server.tool()
    async def calculate_route(
        origin_lat: float,
        origin_lon: float,
        destination_lat: float,
        destination_lon: float,
        waypoint_lats: Optional[List[float]] = None,
        waypoint_lons: Optional[List[float]] = None,
        profile: str = "foot-walking",
    ) -> dict:
        """
        Calculate a route between two points with optional waypoints.

        Use this tool to get directions and travel time between locations.
        Supports walking, cycling, and driving profiles.

        Args:
            origin_lat: Starting point latitude
            origin_lon: Starting point longitude
            destination_lat: Ending point latitude
            destination_lon: Ending point longitude
            waypoint_lats: Optional list of waypoint latitudes (must match waypoint_lons length)
            waypoint_lons: Optional list of waypoint longitudes
            profile: Transport mode - one of: foot-walking, foot-hiking, cycling-regular,
                     cycling-road, cycling-mountain, cycling-electric, driving-car, wheelchair

        Returns:
            Route with total distance, duration, and optional turn-by-turn segments.
            Use this for planning travel between POIs and accommodations.
        """
        logger.info(
            f"calculate_route called from ({origin_lat}, {origin_lon}) "
            f"to ({destination_lat}, {destination_lon}), profile={profile}"
        )

        # Build waypoints list
        waypoints = None
        if waypoint_lats and waypoint_lons:
            if len(waypoint_lats) != len(waypoint_lons):
                return {
                    "error": "waypoint_lats and waypoint_lons must have the same length",
                    "distance_meters": 0,
                    "duration_seconds": 0,
                }
            waypoints = [
                Coordinate(latitude=lat, longitude=lon)
                for lat, lon in zip(waypoint_lats, waypoint_lons)
            ]

        # Get ORS service
        ors_service = get_ors_service()

        if not ors_service.is_available():
            logger.warning("OpenRouteService API key not configured")
            return {
                "error": "OpenRouteService API key not configured. Please set OPENROUTESERVICE_API_KEY.",
                "distance_meters": 0,
                "duration_seconds": 0,
            }

        try:
            # Convert coordinates to (lon, lat) tuples for ORS
            origin = (origin_lon, origin_lat)
            destination = (destination_lon, destination_lat)
            ors_waypoints = None
            if waypoints:
                ors_waypoints = [(wp.longitude, wp.latitude) for wp in waypoints]

            # Get the routing profile enum
            try:
                routing_profile = TransportProfile(profile)
            except ValueError:
                routing_profile = TransportProfile.WALKING

            # Map to ORS profile enum
            from app.services.openrouteservice import ORSRoutingProfile
            ors_profile = ORSRoutingProfile(routing_profile.value)

            # Calculate route
            result = await ors_service.get_route(
                origin=origin,
                destination=destination,
                profile=ors_profile,
                waypoints=ors_waypoints,
            )

            # Transform segments
            segments = []
            for seg in result.segments:
                for step in seg.get("steps", []):
                    segments.append(
                        RouteSegment(
                            distance_meters=step.get("distance", 0),
                            duration_seconds=step.get("duration", 0),
                            instruction=step.get("instruction"),
                        )
                    )

            # Build output
            output = RouteResult(
                distance_meters=result.distance_meters,
                distance_km=round(result.distance_meters / 1000, 2),
                duration_seconds=result.duration_seconds,
                duration_minutes=round(result.duration_seconds / 60, 1),
                duration_display=_format_duration(result.duration_seconds),
                profile=profile,
                segments=segments[:20],  # Limit segments for readability
                geometry=result.geometry,
                bbox=result.bbox,
            )

            logger.info(
                f"calculate_route returned: {output.distance_km}km, "
                f"{output.duration_display}"
            )
            return output.model_dump()

        except Exception as e:
            logger.error(f"calculate_route failed: {e}")
            return {
                "error": str(e),
                "distance_meters": 0,
                "duration_seconds": 0,
            }

    @server.tool()
    async def get_travel_matrix(
        latitudes: List[float],
        longitudes: List[float],
        profile: str = "foot-walking",
    ) -> dict:
        """
        Calculate travel time matrix between multiple locations.

        Use this tool to efficiently get travel times between all pairs of locations.
        Essential for smart POI scheduling and day planning optimization.

        Args:
            latitudes: List of location latitudes (2-50 locations)
            longitudes: List of location longitudes (must match latitudes length)
            profile: Transport mode - one of: foot-walking, cycling-regular, driving-car

        Returns:
            Matrix of travel times and distances between all location pairs.
            Use this with generate_smart_schedule for optimal POI distribution.

        Note:
            Maximum 50 locations (2500 matrix entries) per request.
        """
        logger.info(
            f"get_travel_matrix called with {len(latitudes)} locations, "
            f"profile={profile}"
        )

        if len(latitudes) != len(longitudes):
            return {
                "error": "latitudes and longitudes must have the same length",
                "durations": [],
                "distances": [],
            }

        if len(latitudes) < 2:
            return {
                "error": "At least 2 locations required for matrix calculation",
                "durations": [],
                "distances": [],
            }

        if len(latitudes) > 50:
            return {
                "error": "Maximum 50 locations supported per matrix request",
                "durations": [],
                "distances": [],
            }

        # Get ORS service
        ors_service = get_ors_service()

        if not ors_service.is_available():
            logger.warning("OpenRouteService API key not configured")
            return {
                "error": "OpenRouteService API key not configured. Please set OPENROUTESERVICE_API_KEY.",
                "durations": [],
                "distances": [],
            }

        try:
            # Build locations list
            locations = list(zip(latitudes, longitudes))

            # Calculate matrix
            result = await ors_service.get_matrix(
                locations=locations,
                profile=profile,
            )

            # Build summary entries for easy reading
            summary = []
            for i in range(len(locations)):
                for j in range(len(locations)):
                    if i != j:
                        duration_seconds = result.durations[i][j]
                        distance_meters = result.distances[i][j]
                        summary.append(
                            MatrixEntry(
                                from_index=i,
                                to_index=j,
                                duration_seconds=duration_seconds,
                                duration_minutes=round(duration_seconds / 60, 1),
                                distance_meters=distance_meters,
                            )
                        )

            output = TravelMatrixResult(
                durations=result.durations,
                distances=result.distances,
                locations_count=len(locations),
                profile=profile,
                summary=summary,
            )

            logger.info(
                f"get_travel_matrix returned matrix for {output.locations_count} locations"
            )
            return output.model_dump()

        except Exception as e:
            logger.error(f"get_travel_matrix failed: {e}")
            return {
                "error": str(e),
                "durations": [],
                "distances": [],
            }

    logger.info("Registered route tools: calculate_route, get_travel_matrix")

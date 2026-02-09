"""
MCP Tool: manage_trip

Provides trip CRUD operations using TripService.
"""

import logging
from typing import Optional, List
from datetime import date
from decimal import Decimal

from mcp.server.fastmcp import FastMCP

from mcp_server.context import get_db_session
from mcp_server.schemas.trips import (
    ManageTripInput,
    ManageTripOutput,
    TripResult,
    TripOperation,
    TripStatus,
    DestinationSummary,
)

logger = logging.getLogger(__name__)


async def _trip_to_result(trip, db) -> TripResult:
    """Convert a Trip model to TripResult schema."""
    from app.services.trip_service import TripService

    # Get POI stats
    poi_stats = await TripService.get_poi_stats(db, trip.id)

    # Calculate duration
    duration_days = None
    if trip.start_date and trip.end_date:
        duration_days = (trip.end_date - trip.start_date).days + 1

    # Get destinations if loaded
    destinations = []
    if hasattr(trip, 'destinations') and trip.destinations:
        for dest in trip.destinations:
            destinations.append(
                DestinationSummary(
                    id=dest.id,
                    city_name=dest.city_name or dest.name or "Unknown",
                    country=dest.country,
                    arrival_date=dest.arrival_date,
                    departure_date=dest.departure_date,
                    poi_count=len(dest.pois) if hasattr(dest, 'pois') and dest.pois else 0,
                )
            )

    return TripResult(
        id=trip.id,
        name=trip.name,
        location=trip.location,
        latitude=trip.latitude,
        longitude=trip.longitude,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        total_budget=trip.total_budget,
        currency=trip.currency or "EUR",
        status=trip.status or "planning",
        tags=trip.tags or [],
        origin_name=trip.origin_name,
        return_name=trip.return_name,
        duration_days=duration_days,
        destinations=destinations,
        total_pois=poi_stats.get('total_pois', 0),
        scheduled_pois=poi_stats.get('scheduled_pois', 0),
    )


def register_tools(server: FastMCP):
    """Register trip management tools with the MCP server."""

    @server.tool()
    async def manage_trip(
        operation: str,
        trip_id: Optional[int] = None,
        name: Optional[str] = None,
        location: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        description: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        total_budget: Optional[float] = None,
        currency: Optional[str] = None,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None,
        origin_name: Optional[str] = None,
        origin_latitude: Optional[float] = None,
        origin_longitude: Optional[float] = None,
        return_name: Optional[str] = None,
        return_latitude: Optional[float] = None,
        return_longitude: Optional[float] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> dict:
        """
        Full trip management - create, read, update, delete, or list trips.

        This is your main tool for persisting trip data in the user's account.

        OPERATIONS:
            - "create": Make a new trip (requires: name)
            - "read": Get trip details (requires: trip_id)
            - "update": Modify trip (requires: trip_id + fields to change)
            - "delete": Remove trip (requires: trip_id) - CONFIRM WITH USER FIRST!
            - "list": Show all trips (optional: skip, limit)

        Args:
            operation: create | read | update | delete | list

            # For create/update:
            name: Trip name (required for create)
            location: Primary destination (e.g., "Rome, Italy")
            latitude, longitude: Coords from search_destinations
            start_date: "YYYY-MM-DD" format
            end_date: "YYYY-MM-DD" format
            total_budget: Number (e.g., 2000)
            currency: "EUR", "USD", "GBP", etc.
            status: "planning" | "ongoing" | "completed"
            tags: ["romantic", "foodie", "adventure"]
            origin_name: Where user departs from
            return_name: Where user returns to

            # For read/update/delete:
            trip_id: The trip's numeric ID

            # For list:
            skip: Pagination offset (default 0)
            limit: Max results (default 100)

        Returns:
            - create: New trip with ID
            - read: Full trip details with destinations and POI counts
            - update: Updated trip
            - delete: Success confirmation
            - list: Array of trips with summaries

        Example flow for new trip:
            1. search_destinations("Paris") -> get coords
            2. manage_trip(operation="create", name="Paris Adventure",
                          location="Paris", latitude=48.85, longitude=2.35,
                          start_date="2024-06-01", end_date="2024-06-07")
        """
        logger.info(f"manage_trip called with operation={operation}, trip_id={trip_id}")

        from app.services.trip_service import TripService
        from app.schemas.trip import TripCreate, TripUpdate

        try:
            op = TripOperation(operation.lower())
        except ValueError:
            return ManageTripOutput(
                operation=operation,
                success=False,
                message=f"Invalid operation: {operation}. Must be one of: create, read, update, delete, list",
            ).model_dump()

        # Parse dates if provided
        parsed_start_date = None
        parsed_end_date = None
        if start_date:
            try:
                parsed_start_date = date.fromisoformat(start_date)
            except ValueError:
                return ManageTripOutput(
                    operation=operation,
                    success=False,
                    message=f"Invalid start_date format: {start_date}. Use YYYY-MM-DD.",
                ).model_dump()
        if end_date:
            try:
                parsed_end_date = date.fromisoformat(end_date)
            except ValueError:
                return ManageTripOutput(
                    operation=operation,
                    success=False,
                    message=f"Invalid end_date format: {end_date}. Use YYYY-MM-DD.",
                ).model_dump()

        async with get_db_session() as db:
            try:
                if op == TripOperation.CREATE:
                    if not name:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message="name is required for create operation",
                        ).model_dump()

                    trip_data = TripCreate(
                        name=name,
                        location=location,
                        latitude=latitude,
                        longitude=longitude,
                        description=description,
                        start_date=parsed_start_date,
                        end_date=parsed_end_date,
                        total_budget=Decimal(str(total_budget)) if total_budget else None,
                        currency=currency or "EUR",
                        tags=tags,
                        origin_name=origin_name,
                        origin_latitude=origin_latitude,
                        origin_longitude=origin_longitude,
                        return_name=return_name,
                        return_latitude=return_latitude,
                        return_longitude=return_longitude,
                    )

                    trip = await TripService.create_trip(db, trip_data)
                    result = await _trip_to_result(trip, db)

                    return ManageTripOutput(
                        operation=operation,
                        success=True,
                        message=f"Trip '{trip.name}' created successfully with ID {trip.id}",
                        trip=result,
                    ).model_dump()

                elif op == TripOperation.READ:
                    if not trip_id:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message="trip_id is required for read operation",
                        ).model_dump()

                    trip = await TripService.get_trip_with_destinations(db, trip_id)
                    if not trip:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message=f"Trip with ID {trip_id} not found",
                        ).model_dump()

                    result = await _trip_to_result(trip, db)

                    return ManageTripOutput(
                        operation=operation,
                        success=True,
                        message=f"Trip '{trip.name}' retrieved successfully",
                        trip=result,
                    ).model_dump()

                elif op == TripOperation.UPDATE:
                    if not trip_id:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message="trip_id is required for update operation",
                        ).model_dump()

                    # Build update data with only provided fields
                    update_dict = {}
                    if name is not None:
                        update_dict['name'] = name
                    if location is not None:
                        update_dict['location'] = location
                    if latitude is not None:
                        update_dict['latitude'] = latitude
                    if longitude is not None:
                        update_dict['longitude'] = longitude
                    if description is not None:
                        update_dict['description'] = description
                    if parsed_start_date is not None:
                        update_dict['start_date'] = parsed_start_date
                    if parsed_end_date is not None:
                        update_dict['end_date'] = parsed_end_date
                    if total_budget is not None:
                        update_dict['total_budget'] = Decimal(str(total_budget))
                    if currency is not None:
                        update_dict['currency'] = currency
                    if status is not None:
                        update_dict['status'] = status
                    if tags is not None:
                        update_dict['tags'] = tags
                    if origin_name is not None:
                        update_dict['origin_name'] = origin_name
                    if origin_latitude is not None:
                        update_dict['origin_latitude'] = origin_latitude
                    if origin_longitude is not None:
                        update_dict['origin_longitude'] = origin_longitude
                    if return_name is not None:
                        update_dict['return_name'] = return_name
                    if return_latitude is not None:
                        update_dict['return_latitude'] = return_latitude
                    if return_longitude is not None:
                        update_dict['return_longitude'] = return_longitude

                    trip_update = TripUpdate(**update_dict)
                    trip = await TripService.update_trip(db, trip_id, trip_update)

                    if not trip:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message=f"Trip with ID {trip_id} not found",
                        ).model_dump()

                    result = await _trip_to_result(trip, db)

                    return ManageTripOutput(
                        operation=operation,
                        success=True,
                        message=f"Trip '{trip.name}' updated successfully",
                        trip=result,
                    ).model_dump()

                elif op == TripOperation.DELETE:
                    if not trip_id:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message="trip_id is required for delete operation",
                        ).model_dump()

                    # Get trip name before deletion
                    trip = await TripService.get_trip(db, trip_id)
                    if not trip:
                        return ManageTripOutput(
                            operation=operation,
                            success=False,
                            message=f"Trip with ID {trip_id} not found",
                        ).model_dump()

                    trip_name = trip.name
                    deleted = await TripService.delete_trip(db, trip_id)

                    return ManageTripOutput(
                        operation=operation,
                        success=deleted,
                        message=f"Trip '{trip_name}' deleted successfully" if deleted else "Deletion failed",
                    ).model_dump()

                elif op == TripOperation.LIST:
                    trips_data, total_count = await TripService.get_trips_with_summary(
                        db, skip=skip, limit=limit
                    )

                    trips = []
                    for item in trips_data:
                        trip = item['trip']
                        poi_stats = item['poi_stats']

                        duration_days = None
                        if trip.start_date and trip.end_date:
                            duration_days = (trip.end_date - trip.start_date).days + 1

                        destinations = []
                        for dest in item.get('destinations', []):
                            destinations.append(
                                DestinationSummary(
                                    id=dest.id,
                                    city_name=dest.city_name or dest.name or "Unknown",
                                    country=dest.country,
                                    arrival_date=dest.arrival_date,
                                    departure_date=dest.departure_date,
                                )
                            )

                        trips.append(TripResult(
                            id=trip.id,
                            name=trip.name,
                            location=trip.location,
                            latitude=trip.latitude,
                            longitude=trip.longitude,
                            description=trip.description,
                            start_date=trip.start_date,
                            end_date=trip.end_date,
                            total_budget=trip.total_budget,
                            currency=trip.currency or "EUR",
                            status=trip.status or "planning",
                            tags=trip.tags or [],
                            origin_name=trip.origin_name,
                            return_name=trip.return_name,
                            duration_days=duration_days,
                            destinations=destinations,
                            total_pois=poi_stats.get('total_pois', 0),
                            scheduled_pois=poi_stats.get('scheduled_pois', 0),
                        ))

                    return ManageTripOutput(
                        operation=operation,
                        success=True,
                        message=f"Retrieved {len(trips)} trips",
                        trips=trips,
                        total_count=total_count,
                    ).model_dump()

            except Exception as e:
                logger.error(f"manage_trip failed: {e}")
                return ManageTripOutput(
                    operation=operation,
                    success=False,
                    message=f"Operation failed: {str(e)}",
                ).model_dump()

    logger.info("Registered trip tools: manage_trip")

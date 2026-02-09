"""
MCP Tools: search_destinations, manage_destination

Provides location search/geocoding and destination CRUD operations.
"""

import logging
from typing import Optional, List
from datetime import date

from mcp.server.fastmcp import FastMCP

from mcp_server.context import get_geocoding_service, get_db_session
from mcp_server.schemas.destinations import (
    SearchDestinationsInput,
    DestinationResult,
    SearchDestinationsOutput,
    DestinationOperation,
    ManagedDestinationResult,
    ManageDestinationOutput,
)

logger = logging.getLogger(__name__)


async def _destination_to_result(dest, db) -> ManagedDestinationResult:
    """Convert a Destination model to ManagedDestinationResult schema."""
    from sqlalchemy import select, func
    from app.models import POI

    # Count POIs for this destination
    count_result = await db.execute(
        select(func.count()).select_from(POI).where(POI.destination_id == dest.id)
    )
    poi_count = count_result.scalar() or 0

    return ManagedDestinationResult(
        id=dest.id,
        trip_id=dest.trip_id,
        city_name=dest.city_name or dest.name or "Unknown",
        country=dest.country,
        arrival_date=dest.arrival_date,
        departure_date=dest.departure_date,
        latitude=dest.latitude,
        longitude=dest.longitude,
        notes=dest.notes,
        order_index=dest.order_index or 0,
        name=dest.name,
        description=dest.description,
        poi_count=poi_count,
    )


def register_tools(server: FastMCP):
    """Register destination-related tools with the MCP server."""

    @server.tool()
    async def search_destinations(
        query: str,
        limit: int = 5,
        language: str = "en",
    ) -> dict:
        """
        Search for destinations/locations by name or address.

        IMPORTANT: This should be the FIRST tool called when a user mentions
        a new location. It validates the location exists and returns coordinates
        needed by other tools like get_poi_suggestions and calculate_route.

        Args:
            query: Location search query. Be specific for better results:
                   - Good: "Barcelona, Spain" or "Eiffel Tower, Paris"
                   - Avoid: Just "Barcelona" (may match wrong city)
            limit: Maximum results to return (1-20, default 5)
            language: Results language - use 'en' for English names

        Returns:
            List of matching locations with:
            - display_name: Full location name
            - latitude, longitude: Coordinates (use these for other tools!)
            - type: Location type (city, attraction, etc.)
            - importance: Relevance score (0-1, higher is better match)

        Common patterns:
            1. Search -> select best match -> use coords for get_poi_suggestions
            2. Search origin + destination -> use coords for calculate_route
        """
        logger.info(f"search_destinations called with query='{query}'")

        # Validate input
        validated = SearchDestinationsInput(
            query=query,
            limit=limit,
            language=language,
        )

        # Get geocoding service
        GeocodingService = get_geocoding_service()

        try:
            # Search using the service
            results = await GeocodingService.search(
                query=validated.query,
                limit=validated.limit,
                lang=validated.language,
            )

            # Transform to output format
            destination_results = []
            for result in results:
                destination_results.append(
                    DestinationResult(
                        place_id=result.place_id,
                        display_name=result.display_name,
                        latitude=result.latitude,
                        longitude=result.longitude,
                        type=result.type,
                        importance=min(result.importance, 1.0),  # Cap at 1.0
                    )
                )

            output = SearchDestinationsOutput(
                results=destination_results,
                query=validated.query,
                count=len(destination_results),
            )

            logger.info(f"search_destinations returned {output.count} results for '{query}'")
            return output.model_dump()

        except Exception as e:
            logger.error(f"search_destinations failed: {e}")
            return {
                "results": [],
                "query": query,
                "count": 0,
                "error": str(e),
            }

    @server.tool()
    async def manage_destination(
        operation: str,
        destination_id: Optional[int] = None,
        trip_id: Optional[int] = None,
        city_name: Optional[str] = None,
        country: Optional[str] = None,
        arrival_date: Optional[str] = None,
        departure_date: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        notes: Optional[str] = None,
        order_index: Optional[int] = None,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict:
        """
        Full destination management - create, read, update, delete, or list destinations within a trip.

        OPERATIONS:
            - "create": Add a destination to a trip (requires: trip_id, city_name, arrival_date, departure_date)
            - "read": Get destination details (requires: destination_id)
            - "update": Modify destination (requires: destination_id + fields to change)
            - "delete": Remove destination (requires: destination_id) - CONFIRM WITH USER FIRST!
            - "list": Show all destinations for a trip (requires: trip_id)

        Args:
            operation: create | read | update | delete | list
            destination_id: Destination ID (required for read, update, delete)
            trip_id: Trip ID (required for create, list)
            city_name: City name (required for create)
            country: Country name
            arrival_date: "YYYY-MM-DD" format (required for create)
            departure_date: "YYYY-MM-DD" format (required for create)
            latitude: Latitude from search_destinations
            longitude: Longitude from search_destinations
            notes: Free-text notes
            order_index: Position in trip itinerary (0-based)
            name: Display name (if different from city_name)
            description: Description text

        Returns:
            - create: New destination with ID
            - read: Full destination details with POI count
            - update: Updated destination
            - delete: Success confirmation
            - list: Array of destinations for the trip

        Example flow:
            1. search_destinations("Hiroshima, Japan") -> get coords
            2. manage_destination(operation="create", trip_id=1,
                                  city_name="Hiroshima", country="Japan",
                                  arrival_date="2024-04-18", departure_date="2024-04-20",
                                  latitude=34.39, longitude=132.45)
        """
        logger.info(f"manage_destination called with operation={operation}, destination_id={destination_id}")

        from sqlalchemy import select, func, delete as sa_delete, or_
        from geoalchemy2.functions import ST_SetSRID, ST_MakePoint
        from app.models import Destination, Trip, TravelSegment

        try:
            op = DestinationOperation(operation.lower())
        except ValueError:
            return ManageDestinationOutput(
                operation=operation,
                success=False,
                message=f"Invalid operation: {operation}. Must be one of: create, read, update, delete, list",
            ).model_dump()

        # Parse dates if provided
        parsed_arrival = None
        parsed_departure = None
        if arrival_date:
            try:
                parsed_arrival = date.fromisoformat(arrival_date)
            except ValueError:
                return ManageDestinationOutput(
                    operation=operation,
                    success=False,
                    message=f"Invalid arrival_date format: {arrival_date}. Use YYYY-MM-DD.",
                ).model_dump()
        if departure_date:
            try:
                parsed_departure = date.fromisoformat(departure_date)
            except ValueError:
                return ManageDestinationOutput(
                    operation=operation,
                    success=False,
                    message=f"Invalid departure_date format: {departure_date}. Use YYYY-MM-DD.",
                ).model_dump()

        async with get_db_session() as db:
            try:
                if op == DestinationOperation.CREATE:
                    if not trip_id:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="trip_id is required for create operation",
                        ).model_dump()
                    if not city_name:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="city_name is required for create operation",
                        ).model_dump()
                    if not parsed_arrival or not parsed_departure:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="arrival_date and departure_date are required for create operation",
                        ).model_dump()

                    # Verify trip exists
                    trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
                    trip = trip_result.scalar_one_or_none()
                    if not trip:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message=f"Trip with ID {trip_id} not found",
                        ).model_dump()

                    # Determine order_index if not provided
                    if order_index is None:
                        count_result = await db.execute(
                            select(func.count()).select_from(Destination).where(Destination.trip_id == trip_id)
                        )
                        order_index = count_result.scalar() or 0

                    db_dest = Destination(
                        trip_id=trip_id,
                        city_name=city_name,
                        country=country,
                        arrival_date=parsed_arrival,
                        departure_date=parsed_departure,
                        notes=notes,
                        order_index=order_index,
                        name=name,
                        description=description,
                        latitude=latitude,
                        longitude=longitude,
                    )

                    # Set PostGIS coordinates
                    if latitude is not None and longitude is not None:
                        db_dest.coordinates = ST_SetSRID(
                            ST_MakePoint(longitude, latitude), 4326
                        )

                    db.add(db_dest)
                    await db.flush()
                    await db.refresh(db_dest)

                    result = await _destination_to_result(db_dest, db)
                    return ManageDestinationOutput(
                        operation=operation, success=True,
                        message=f"Destination '{city_name}' created with ID {db_dest.id}",
                        destination=result,
                    ).model_dump()

                elif op == DestinationOperation.READ:
                    if not destination_id:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="destination_id is required for read operation",
                        ).model_dump()

                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    dest = dest_result.scalar_one_or_none()
                    if not dest:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    result = await _destination_to_result(dest, db)
                    return ManageDestinationOutput(
                        operation=operation, success=True,
                        message=f"Destination '{dest.city_name}' retrieved",
                        destination=result,
                    ).model_dump()

                elif op == DestinationOperation.UPDATE:
                    if not destination_id:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="destination_id is required for update operation",
                        ).model_dump()

                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    db_dest = dest_result.scalar_one_or_none()
                    if not db_dest:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    # Update provided fields
                    if city_name is not None:
                        db_dest.city_name = city_name
                    if country is not None:
                        db_dest.country = country
                    if parsed_arrival is not None:
                        db_dest.arrival_date = parsed_arrival
                    if parsed_departure is not None:
                        db_dest.departure_date = parsed_departure
                    if notes is not None:
                        db_dest.notes = notes
                    if order_index is not None:
                        db_dest.order_index = order_index
                    if name is not None:
                        db_dest.name = name
                    if description is not None:
                        db_dest.description = description
                    if latitude is not None:
                        db_dest.latitude = latitude
                    if longitude is not None:
                        db_dest.longitude = longitude

                    # Update PostGIS coordinates if both provided
                    if latitude is not None and longitude is not None:
                        db_dest.coordinates = ST_SetSRID(
                            ST_MakePoint(longitude, latitude), 4326
                        )

                    await db.flush()
                    await db.refresh(db_dest)

                    result = await _destination_to_result(db_dest, db)
                    return ManageDestinationOutput(
                        operation=operation, success=True,
                        message=f"Destination '{db_dest.city_name}' updated",
                        destination=result,
                    ).model_dump()

                elif op == DestinationOperation.DELETE:
                    if not destination_id:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="destination_id is required for delete operation",
                        ).model_dump()

                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    db_dest = dest_result.scalar_one_or_none()
                    if not db_dest:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    dest_name = db_dest.city_name

                    # Delete related travel segments
                    await db.execute(
                        sa_delete(TravelSegment).where(
                            or_(
                                TravelSegment.from_destination_id == destination_id,
                                TravelSegment.to_destination_id == destination_id,
                            )
                        )
                    )

                    await db.delete(db_dest)
                    await db.flush()

                    return ManageDestinationOutput(
                        operation=operation, success=True,
                        message=f"Destination '{dest_name}' deleted successfully",
                    ).model_dump()

                elif op == DestinationOperation.LIST:
                    if not trip_id:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message="trip_id is required for list operation",
                        ).model_dump()

                    # Verify trip exists
                    trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
                    trip = trip_result.scalar_one_or_none()
                    if not trip:
                        return ManageDestinationOutput(
                            operation=operation, success=False,
                            message=f"Trip with ID {trip_id} not found",
                        ).model_dump()

                    result = await db.execute(
                        select(Destination)
                        .where(Destination.trip_id == trip_id)
                        .order_by(Destination.order_index.asc(), Destination.created_at.asc())
                    )
                    destinations = result.scalars().all()

                    dest_results = []
                    for dest in destinations:
                        dest_results.append(await _destination_to_result(dest, db))

                    return ManageDestinationOutput(
                        operation=operation, success=True,
                        message=f"Retrieved {len(dest_results)} destinations for trip {trip_id}",
                        destinations=dest_results,
                        total_count=len(dest_results),
                    ).model_dump()

            except Exception as e:
                logger.error(f"manage_destination failed: {e}")
                return ManageDestinationOutput(
                    operation=operation,
                    success=False,
                    message=f"Operation failed: {str(e)}",
                ).model_dump()

    logger.info("Registered destination tools: search_destinations, manage_destination")

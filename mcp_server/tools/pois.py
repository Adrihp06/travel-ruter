"""
MCP Tools: get_poi_suggestions, manage_poi, schedule_pois

Provides POI suggestions, CRUD operations, and bulk scheduling.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import date, time

from mcp.server.fastmcp import FastMCP

from mcp_server.context import get_google_places_service, get_db_session
from mcp_server.schemas.pois import (
    GetPOISuggestionsInput,
    POISuggestion,
    POIMetadata,
    GetPOISuggestionsOutput,
    POIOperation,
    POIResult,
    ManagePOIOutput,
    SchedulePOIsOutput,
)

logger = logging.getLogger(__name__)


async def _poi_to_result(poi, lat=None, lng=None) -> POIResult:
    """Convert a POI model to POIResult schema."""
    return POIResult(
        id=poi.id,
        destination_id=poi.destination_id,
        name=poi.name,
        category=poi.category,
        description=poi.description,
        address=poi.address,
        latitude=lat if lat is not None else poi.latitude,
        longitude=lng if lng is not None else poi.longitude,
        estimated_cost=float(poi.estimated_cost) if poi.estimated_cost else None,
        currency=poi.currency or "USD",
        dwell_time=poi.dwell_time,
        scheduled_date=str(poi.scheduled_date) if poi.scheduled_date else None,
        day_order=poi.day_order,
        is_anchored=poi.is_anchored or False,
        anchored_time=str(poi.anchored_time) if poi.anchored_time else None,
        external_id=poi.external_id,
        external_source=poi.external_source,
        metadata_json=poi.metadata_json,
        likes=poi.likes or 0,
        vetoes=poi.vetoes or 0,
        priority=poi.priority or 0,
    )


def _format_rating_display(rating: Optional[float], count: Optional[int]) -> Optional[str]:
    """Format rating for human-readable display."""
    if rating is None:
        return None
    if count is not None and count > 0:
        return f"{rating}/5 ({count:,} reviews)"
    return f"{rating}/5"


def _format_price_display(price_level: Optional[int]) -> Optional[str]:
    """Format price level for human-readable display."""
    if price_level is None:
        return None
    symbols = {0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}
    return symbols.get(price_level, f"Level {price_level}")


def register_tools(server: FastMCP):
    """Register POI-related tools with the MCP server."""

    @server.tool()
    async def get_poi_suggestions(
        latitude: float,
        longitude: float,
        radius: int = 5000,
        category: Optional[str] = None,
        trip_type: Optional[str] = None,
        max_results: int = 20,
        min_rating: Optional[float] = None,
    ) -> dict:
        """
        Discover attractions, restaurants, and activities near a location.

        PREREQUISITE: First use search_destinations to get coordinates!

        Args:
            latitude: From search_destinations result
            longitude: From search_destinations result
            radius: Search area in meters:
                    - 2000m (~1.2 miles) for walkable area
                    - 5000m (default) for city center
                    - 10000m+ for wider exploration
            category: Focus search on specific type:
                      - Sights: Landmarks, monuments, viewpoints
                      - Museums: Museums, galleries, cultural venues
                      - Food: Restaurants, cafes, bars
                      - Nature: Parks, gardens, beaches
                      - Entertainment: Shows, nightlife, events
                      - Shopping: Markets, malls, boutiques
                      - Activity: Sports, tours, experiences
            trip_type: Curate for travel style:
                       - romantic: Scenic spots, fine dining
                       - adventure: Outdoor activities, hiking
                       - family: Kid-friendly, educational
                       - cultural: Museums, history, local culture
                       - food: Culinary experiences, markets
            max_results: How many suggestions (1-50, default 20)
            min_rating: Only return highly-rated places (e.g., 4.0)

        Returns:
            POI list with: name, category, address, coordinates, rating_display,
            price_display, opening_hours. Present top picks to user for selection.

        Example workflow:
            1. get_poi_suggestions(lat, lon, category="Food", min_rating=4.0)
            2. Present top 5 restaurants to user
            3. User selects favorites -> add to trip via manage_trip
        """
        logger.info(
            f"get_poi_suggestions called at ({latitude}, {longitude}), "
            f"radius={radius}, category={category}, trip_type={trip_type}"
        )

        # Validate input
        validated = GetPOISuggestionsInput(
            latitude=latitude,
            longitude=longitude,
            radius=radius,
            category=category,
            trip_type=trip_type,
            max_results=max_results,
            min_rating=min_rating,
        )

        # Get Google Places service
        places_service = get_google_places_service()

        # Check if API key is available
        if not places_service._has_api_key:
            logger.warning("Google Places API key not configured")
            return {
                "suggestions": [],
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius,
                "count": 0,
                "filters_applied": {},
                "error": "Google Places API key not configured. Please set GOOGLE_MAPS_API_KEY.",
            }

        try:
            # Get suggestions using the service
            raw_suggestions = await places_service.get_suggestions_for_destination(
                latitude=validated.latitude,
                longitude=validated.longitude,
                radius=validated.radius,
                category_filter=validated.category,
                trip_type=validated.trip_type,
                max_results=validated.max_results,
            )

            # Apply min_rating filter if specified
            if validated.min_rating is not None:
                raw_suggestions = [
                    s for s in raw_suggestions
                    if (s.get("metadata_json", {}).get("rating") or 0) >= validated.min_rating
                ]

            # Transform to output format
            suggestions = []
            for raw in raw_suggestions:
                metadata_json = raw.get("metadata_json", {})

                metadata = POIMetadata(
                    rating=metadata_json.get("rating"),
                    user_ratings_total=metadata_json.get("user_ratings_total"),
                    price_level=metadata_json.get("price_level"),
                    types=metadata_json.get("types", []),
                    photos=metadata_json.get("photos", []),
                    business_status=metadata_json.get("business_status"),
                    opening_hours=metadata_json.get("opening_hours"),
                )

                suggestion = POISuggestion(
                    name=raw.get("name", "Unknown"),
                    category=raw.get("category", "Sights"),
                    address=raw.get("address"),
                    latitude=raw.get("latitude", 0),
                    longitude=raw.get("longitude", 0),
                    external_id=raw.get("external_id"),
                    external_source=raw.get("external_source", "google_places"),
                    metadata=metadata,
                    rating_display=_format_rating_display(
                        metadata_json.get("rating"),
                        metadata_json.get("user_ratings_total"),
                    ),
                    price_display=_format_price_display(
                        metadata_json.get("price_level")
                    ),
                )
                suggestions.append(suggestion)

            # Build filters applied dict
            filters_applied = {}
            if validated.category:
                filters_applied["category"] = validated.category
            if validated.trip_type:
                filters_applied["trip_type"] = validated.trip_type
            if validated.min_rating:
                filters_applied["min_rating"] = validated.min_rating

            output = GetPOISuggestionsOutput(
                suggestions=suggestions,
                center={"latitude": latitude, "longitude": longitude},
                radius=validated.radius,
                count=len(suggestions),
                filters_applied=filters_applied,
            )

            logger.info(
                f"get_poi_suggestions returned {output.count} suggestions "
                f"at ({latitude}, {longitude})"
            )
            return output.model_dump()

        except Exception as e:
            logger.error(f"get_poi_suggestions failed: {e}")
            return {
                "suggestions": [],
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius,
                "count": 0,
                "filters_applied": {},
                "error": str(e),
            }

    @server.tool()
    async def manage_poi(
        operation: str,
        poi_id: Optional[int] = None,
        destination_id: Optional[int] = None,
        name: Optional[str] = None,
        category: Optional[str] = None,
        description: Optional[str] = None,
        address: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        estimated_cost: Optional[float] = None,
        currency: Optional[str] = None,
        dwell_time: Optional[int] = None,
        scheduled_date: Optional[str] = None,
        day_order: Optional[int] = None,
        is_anchored: Optional[bool] = None,
        anchored_time: Optional[str] = None,
        external_id: Optional[str] = None,
        external_source: Optional[str] = None,
        metadata_json: Optional[dict] = None,
    ) -> dict:
        """
        Full POI management - create, read, update, delete, or list Points of Interest.

        OPERATIONS:
            - "create": Add a POI to a destination (requires: destination_id, name, category)
            - "read": Get POI details (requires: poi_id)
            - "update": Modify POI (requires: poi_id + fields to change)
            - "delete": Remove POI (requires: poi_id) - CONFIRM WITH USER FIRST!
            - "list": Show all POIs for a destination (requires: destination_id)

        Args:
            operation: create | read | update | delete | list
            poi_id: POI ID (required for read, update, delete)
            destination_id: Destination ID (required for create, list)
            name: POI name (required for create)
            category: Sights | Museums | Food | Nature | Entertainment | Shopping | Activity
            description: Description text
            address: Street address
            latitude: Latitude from search or POI suggestions
            longitude: Longitude from search or POI suggestions
            estimated_cost: Estimated cost in local currency
            currency: Currency code (default "USD")
            dwell_time: Estimated visit time in minutes
            scheduled_date: "YYYY-MM-DD" - which day to visit
            day_order: Order within the scheduled day (0-based)
            is_anchored: Whether this POI must be visited at a specific time
            anchored_time: "HH:MM" - required time (e.g., restaurant reservation)
            external_id: Google Place ID or other external reference
            external_source: Source of external_id (e.g., "google_places")
            metadata_json: Additional metadata dict (ratings, photos, etc.)

        Returns:
            - create: New POI with ID and coordinates
            - read: Full POI details
            - update: Updated POI
            - delete: Success confirmation
            - list: Array of POIs for the destination

        Example flow:
            1. get_poi_suggestions(lat, lon, category="Food") -> find restaurants
            2. manage_poi(operation="create", destination_id=5,
                         name="Ichiran Ramen", category="Food",
                         latitude=34.39, longitude=132.45,
                         estimated_cost=15, dwell_time=60)
            3. schedule_pois(destination_id=5, assignments=[...])
        """
        logger.info(f"manage_poi called with operation={operation}, poi_id={poi_id}")

        from sqlalchemy import select, func
        from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_X, ST_Y
        from app.models import POI, Destination

        try:
            op = POIOperation(operation.lower())
        except ValueError:
            return ManagePOIOutput(
                operation=operation,
                success=False,
                message=f"Invalid operation: {operation}. Must be one of: create, read, update, delete, list",
            ).model_dump()

        # Parse scheduled_date if provided
        parsed_scheduled_date = None
        if scheduled_date:
            try:
                parsed_scheduled_date = date.fromisoformat(scheduled_date)
            except ValueError:
                return ManagePOIOutput(
                    operation=operation, success=False,
                    message=f"Invalid scheduled_date format: {scheduled_date}. Use YYYY-MM-DD.",
                ).model_dump()

        # Parse anchored_time if provided
        parsed_anchored_time = None
        if anchored_time:
            try:
                parts = anchored_time.split(":")
                parsed_anchored_time = time(int(parts[0]), int(parts[1]))
            except (ValueError, IndexError):
                return ManagePOIOutput(
                    operation=operation, success=False,
                    message=f"Invalid anchored_time format: {anchored_time}. Use HH:MM.",
                ).model_dump()

        async with get_db_session() as db:
            try:
                if op == POIOperation.CREATE:
                    if not destination_id:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="destination_id is required for create operation",
                        ).model_dump()
                    if not name:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="name is required for create operation",
                        ).model_dump()
                    if not category:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="category is required for create operation",
                        ).model_dump()

                    # Verify destination exists
                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    dest = dest_result.scalar_one_or_none()
                    if not dest:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    db_poi = POI(
                        destination_id=destination_id,
                        name=name,
                        category=category,
                        description=description,
                        address=address,
                        estimated_cost=estimated_cost,
                        currency=currency or "USD",
                        dwell_time=dwell_time,
                        scheduled_date=parsed_scheduled_date,
                        day_order=day_order,
                        is_anchored=is_anchored or False,
                        anchored_time=parsed_anchored_time,
                        external_id=external_id,
                        external_source=external_source,
                        metadata_json=metadata_json,
                    )

                    # Set PostGIS coordinates
                    if latitude is not None and longitude is not None:
                        db_poi.coordinates = ST_SetSRID(
                            ST_MakePoint(longitude, latitude), 4326
                        )

                    db.add(db_poi)
                    await db.flush()

                    # Re-query to extract coordinates
                    result = await db.execute(
                        select(POI, ST_Y(POI.coordinates).label('lat'), ST_X(POI.coordinates).label('lng'))
                        .where(POI.id == db_poi.id)
                    )
                    row = result.one()
                    created_poi, lat, lng = row

                    poi_result = await _poi_to_result(created_poi, lat, lng)
                    return ManagePOIOutput(
                        operation=operation, success=True,
                        message=f"POI '{name}' created with ID {created_poi.id}",
                        poi=poi_result,
                    ).model_dump()

                elif op == POIOperation.READ:
                    if not poi_id:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="poi_id is required for read operation",
                        ).model_dump()

                    result = await db.execute(
                        select(POI, ST_Y(POI.coordinates).label('lat'), ST_X(POI.coordinates).label('lng'))
                        .where(POI.id == poi_id)
                    )
                    row = result.one_or_none()
                    if not row:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message=f"POI with ID {poi_id} not found",
                        ).model_dump()

                    poi, lat, lng = row
                    poi_result = await _poi_to_result(poi, lat, lng)
                    return ManagePOIOutput(
                        operation=operation, success=True,
                        message=f"POI '{poi.name}' retrieved",
                        poi=poi_result,
                    ).model_dump()

                elif op == POIOperation.UPDATE:
                    if not poi_id:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="poi_id is required for update operation",
                        ).model_dump()

                    result = await db.execute(select(POI).where(POI.id == poi_id))
                    db_poi = result.scalar_one_or_none()
                    if not db_poi:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message=f"POI with ID {poi_id} not found",
                        ).model_dump()

                    # Update provided fields
                    if name is not None:
                        db_poi.name = name
                    if category is not None:
                        db_poi.category = category
                    if description is not None:
                        db_poi.description = description
                    if address is not None:
                        db_poi.address = address
                    if estimated_cost is not None:
                        db_poi.estimated_cost = estimated_cost
                    if currency is not None:
                        db_poi.currency = currency
                    if dwell_time is not None:
                        db_poi.dwell_time = dwell_time
                    if parsed_scheduled_date is not None:
                        db_poi.scheduled_date = parsed_scheduled_date
                    if day_order is not None:
                        db_poi.day_order = day_order
                    if is_anchored is not None:
                        db_poi.is_anchored = is_anchored
                    if parsed_anchored_time is not None:
                        db_poi.anchored_time = parsed_anchored_time
                    if external_id is not None:
                        db_poi.external_id = external_id
                    if external_source is not None:
                        db_poi.external_source = external_source
                    if metadata_json is not None:
                        db_poi.metadata_json = metadata_json

                    # Update PostGIS coordinates if both provided
                    if latitude is not None and longitude is not None:
                        db_poi.coordinates = ST_SetSRID(
                            ST_MakePoint(longitude, latitude), 4326
                        )

                    await db.flush()

                    # Re-query to extract coordinates
                    result = await db.execute(
                        select(POI, ST_Y(POI.coordinates).label('lat'), ST_X(POI.coordinates).label('lng'))
                        .where(POI.id == poi_id)
                    )
                    row = result.one()
                    updated_poi, lat, lng = row

                    poi_result = await _poi_to_result(updated_poi, lat, lng)
                    return ManagePOIOutput(
                        operation=operation, success=True,
                        message=f"POI '{updated_poi.name}' updated",
                        poi=poi_result,
                    ).model_dump()

                elif op == POIOperation.DELETE:
                    if not poi_id:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="poi_id is required for delete operation",
                        ).model_dump()

                    result = await db.execute(select(POI).where(POI.id == poi_id))
                    db_poi = result.scalar_one_or_none()
                    if not db_poi:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message=f"POI with ID {poi_id} not found",
                        ).model_dump()

                    poi_name = db_poi.name
                    await db.delete(db_poi)
                    await db.flush()

                    return ManagePOIOutput(
                        operation=operation, success=True,
                        message=f"POI '{poi_name}' deleted successfully",
                    ).model_dump()

                elif op == POIOperation.LIST:
                    if not destination_id:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message="destination_id is required for list operation",
                        ).model_dump()

                    # Verify destination exists
                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    dest = dest_result.scalar_one_or_none()
                    if not dest:
                        return ManagePOIOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    result = await db.execute(
                        select(POI, ST_Y(POI.coordinates).label('lat'), ST_X(POI.coordinates).label('lng'))
                        .where(POI.destination_id == destination_id)
                        .order_by(POI.category.asc(), POI.priority.desc(), POI.created_at.asc())
                    )
                    rows = result.all()

                    poi_results = []
                    for row in rows:
                        poi, lat, lng = row
                        poi_results.append(await _poi_to_result(poi, lat, lng))

                    return ManagePOIOutput(
                        operation=operation, success=True,
                        message=f"Retrieved {len(poi_results)} POIs for destination {destination_id}",
                        pois=poi_results,
                        total_count=len(poi_results),
                    ).model_dump()

            except Exception as e:
                logger.error(f"manage_poi failed: {e}")
                return ManagePOIOutput(
                    operation=operation,
                    success=False,
                    message=f"Operation failed: {str(e)}",
                ).model_dump()

    @server.tool()
    async def schedule_pois(
        destination_id: int,
        assignments: List[Dict[str, Any]],
    ) -> dict:
        """
        Bulk-update POI schedules for a destination.

        This tool persists the output of generate_smart_schedule by assigning
        each POI to a specific date and order within that day.

        Args:
            destination_id: The destination these POIs belong to
            assignments: List of schedule assignments, each with:
                - poi_id: int - The POI to schedule
                - scheduled_date: str - "YYYY-MM-DD" date to assign
                - day_order: int - Position within the day (0-based)

        Returns:
            Updated POI list with new schedule assignments

        Example:
            schedule_pois(destination_id=5, assignments=[
                {"poi_id": 101, "scheduled_date": "2024-04-18", "day_order": 0},
                {"poi_id": 102, "scheduled_date": "2024-04-18", "day_order": 1},
                {"poi_id": 103, "scheduled_date": "2024-04-19", "day_order": 0},
            ])
        """
        logger.info(f"schedule_pois called for destination_id={destination_id}, {len(assignments)} assignments")

        from sqlalchemy import select
        from geoalchemy2.functions import ST_X, ST_Y
        from app.models import POI, Destination

        if not assignments:
            return SchedulePOIsOutput(
                success=False,
                message="No assignments provided",
                updated_count=0,
            ).model_dump()

        async with get_db_session() as db:
            try:
                # Verify destination exists
                dest_result = await db.execute(
                    select(Destination).where(Destination.id == destination_id)
                )
                dest = dest_result.scalar_one_or_none()
                if not dest:
                    return SchedulePOIsOutput(
                        success=False,
                        message=f"Destination with ID {destination_id} not found",
                        updated_count=0,
                    ).model_dump()

                updated_pois = []
                errors = []

                for assignment in assignments:
                    poi_id = assignment.get("poi_id")
                    sched_date_str = assignment.get("scheduled_date")
                    d_order = assignment.get("day_order")

                    if not poi_id or not sched_date_str:
                        errors.append(f"Invalid assignment: {assignment}")
                        continue

                    try:
                        sched_date = date.fromisoformat(sched_date_str)
                    except ValueError:
                        errors.append(f"Invalid date '{sched_date_str}' for POI {poi_id}")
                        continue

                    result = await db.execute(
                        select(POI).where(POI.id == poi_id, POI.destination_id == destination_id)
                    )
                    db_poi = result.scalar_one_or_none()
                    if not db_poi:
                        errors.append(f"POI {poi_id} not found in destination {destination_id}")
                        continue

                    db_poi.scheduled_date = sched_date
                    db_poi.day_order = d_order
                    updated_pois.append(db_poi)

                await db.flush()

                # Re-query updated POIs with coordinates
                poi_ids = [p.id for p in updated_pois]
                if poi_ids:
                    result = await db.execute(
                        select(POI, ST_Y(POI.coordinates).label('lat'), ST_X(POI.coordinates).label('lng'))
                        .where(POI.id.in_(poi_ids))
                        .order_by(POI.scheduled_date.nulls_last(), POI.day_order)
                    )
                    rows = result.all()

                    poi_results = []
                    for row in rows:
                        poi, lat, lng = row
                        poi_results.append(await _poi_to_result(poi, lat, lng))
                else:
                    poi_results = []

                message = f"Successfully scheduled {len(updated_pois)} POIs"
                if errors:
                    message += f" ({len(errors)} errors: {'; '.join(errors)})"

                return SchedulePOIsOutput(
                    success=True,
                    message=message,
                    updated_count=len(updated_pois),
                    assignments=poi_results,
                ).model_dump()

            except Exception as e:
                logger.error(f"schedule_pois failed: {e}")
                return SchedulePOIsOutput(
                    success=False,
                    message=f"Operation failed: {str(e)}",
                    updated_count=0,
                ).model_dump()

    logger.info("Registered POI tools: get_poi_suggestions, manage_poi, schedule_pois")

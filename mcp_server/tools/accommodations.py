"""
MCP Tools: manage_accommodation

Provides CRUD operations for accommodations (hotels, hostels, Airbnbs, etc.).
"""

import logging
from typing import Optional, List, Any
from datetime import date

from mcp.server.fastmcp import FastMCP

from mcp_server.context import get_db_session
from mcp_server.schemas.accommodations import (
    AccommodationOperation,
    AccommodationResult,
    ManageAccommodationOutput,
)

logger = logging.getLogger(__name__)


async def _accommodation_to_result(acc, lat=None, lng=None) -> AccommodationResult:
    """Convert an Accommodation model to AccommodationResult schema."""
    return AccommodationResult(
        id=acc.id,
        destination_id=acc.destination_id,
        name=acc.name,
        type=acc.type,
        address=acc.address,
        latitude=lat if lat is not None else acc.latitude,
        longitude=lng if lng is not None else acc.longitude,
        check_in_date=str(acc.check_in_date) if acc.check_in_date else None,
        check_out_date=str(acc.check_out_date) if acc.check_out_date else None,
        booking_reference=acc.booking_reference,
        booking_url=acc.booking_url,
        total_cost=float(acc.total_cost) if acc.total_cost is not None else None,
        currency=acc.currency or "USD",
        is_paid=acc.is_paid or False,
        description=acc.description,
        contact_info=acc.contact_info,
        amenities=acc.amenities,
        files=acc.files,
        rating=float(acc.rating) if acc.rating is not None else None,
        review=acc.review,
    )


def register_tools(server: FastMCP):
    """Register accommodation-related tools with the MCP server."""

    @server.tool()
    async def manage_accommodation(
        operation: str,
        accommodation_id: Optional[int] = None,
        destination_id: Optional[int] = None,
        name: Optional[str] = None,
        type: Optional[str] = None,
        address: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        check_in_date: Optional[str] = None,
        check_out_date: Optional[str] = None,
        booking_reference: Optional[str] = None,
        booking_url: Optional[str] = None,
        total_cost: Optional[float] = None,
        currency: Optional[str] = None,
        is_paid: Optional[bool] = None,
        description: Optional[str] = None,
        contact_info: Optional[dict] = None,
        amenities: Optional[List[str]] = None,
        rating: Optional[float] = None,
        review: Optional[str] = None,
    ) -> dict:
        """
        Full accommodation management - create, read, update, delete, or list accommodations.

        Use this tool for hotels, hostels, Airbnbs, ryokans, camping, or any lodging.
        Do NOT use manage_poi for accommodations — always use this tool instead.

        OPERATIONS:
            - "create": Add accommodation to a destination (requires: destination_id, name, type, check_in_date, check_out_date)
            - "read": Get accommodation details (requires: accommodation_id)
            - "update": Modify accommodation (requires: accommodation_id + fields to change)
            - "delete": Remove accommodation (requires: accommodation_id) - CONFIRM WITH USER FIRST!
            - "list": Show all accommodations for a destination (requires: destination_id)

        Args:
            operation: create | read | update | delete | list
            accommodation_id: Accommodation ID (required for read, update, delete)
            destination_id: Destination ID (required for create, list)
            name: Accommodation name (required for create)
            type: Type of accommodation: hotel, hostel, airbnb, ryokan, camping, etc. (required for create)
            address: Street address
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            check_in_date: "YYYY-MM-DD" check-in date (required for create)
            check_out_date: "YYYY-MM-DD" check-out date (required for create)
            booking_reference: Booking confirmation number
            booking_url: URL to the booking
            total_cost: Total cost of the stay
            currency: Currency code (default "USD")
            is_paid: Whether the booking has been paid
            description: Notes or description
            contact_info: Contact details dict (e.g., {"phone": "+81...", "email": "..."})
            amenities: List of amenities (e.g., ["wifi", "breakfast", "parking"])
            rating: Personal rating 0-5
            review: Personal review text

        Returns:
            - create: New accommodation with ID and coordinates
            - read: Full accommodation details
            - update: Updated accommodation
            - delete: Success confirmation
            - list: Array of accommodations for the destination

        Example flow:
            1. manage_accommodation(operation="create", destination_id=5,
                   name="Arigato Stay Kanazawa", type="hotel",
                   check_in_date="2025-04-18", check_out_date="2025-04-20",
                   latitude=36.5604, longitude=136.6515,
                   total_cost=120, currency="EUR")
        """
        logger.info(f"manage_accommodation called with operation={operation}, accommodation_id={accommodation_id}")

        from sqlalchemy import select, func
        from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_X, ST_Y
        from app.models import Accommodation, Destination

        try:
            op = AccommodationOperation(operation.lower())
        except ValueError:
            return ManageAccommodationOutput(
                operation=operation,
                success=False,
                message=f"Invalid operation: {operation}. Must be one of: create, read, update, delete, list",
            ).model_dump()

        # Parse dates if provided
        parsed_check_in = None
        if check_in_date:
            try:
                parsed_check_in = date.fromisoformat(check_in_date)
            except ValueError:
                return ManageAccommodationOutput(
                    operation=operation, success=False,
                    message=f"Invalid check_in_date format: {check_in_date}. Use YYYY-MM-DD.",
                ).model_dump()

        parsed_check_out = None
        if check_out_date:
            try:
                parsed_check_out = date.fromisoformat(check_out_date)
            except ValueError:
                return ManageAccommodationOutput(
                    operation=operation, success=False,
                    message=f"Invalid check_out_date format: {check_out_date}. Use YYYY-MM-DD.",
                ).model_dump()

        async with get_db_session() as db:
            try:
                if op == AccommodationOperation.CREATE:
                    if not destination_id:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="destination_id is required for create operation",
                        ).model_dump()
                    if not name:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="name is required for create operation",
                        ).model_dump()
                    if not type:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="type is required for create operation (hotel, hostel, airbnb, etc.)",
                        ).model_dump()
                    if not parsed_check_in or not parsed_check_out:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="check_in_date and check_out_date are required for create operation (YYYY-MM-DD)",
                        ).model_dump()
                    if parsed_check_out <= parsed_check_in:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="check_out_date must be after check_in_date",
                        ).model_dump()

                    # Verify destination exists
                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    dest = dest_result.scalar_one_or_none()
                    if not dest:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    db_acc = Accommodation(
                        destination_id=destination_id,
                        name=name,
                        type=type,
                        address=address,
                        check_in_date=parsed_check_in,
                        check_out_date=parsed_check_out,
                        booking_reference=booking_reference,
                        booking_url=booking_url,
                        total_cost=total_cost,
                        currency=currency or "USD",
                        is_paid=is_paid or False,
                        description=description,
                        contact_info=contact_info,
                        amenities=amenities,
                        rating=rating,
                        review=review,
                    )

                    # Set PostGIS coordinates
                    if latitude is not None and longitude is not None:
                        db_acc.coordinates = ST_SetSRID(
                            ST_MakePoint(longitude, latitude), 4326
                        )

                    db.add(db_acc)
                    await db.flush()

                    # Re-query to extract coordinates
                    result = await db.execute(
                        select(
                            Accommodation,
                            ST_Y(Accommodation.coordinates).label('lat'),
                            ST_X(Accommodation.coordinates).label('lng'),
                        ).where(Accommodation.id == db_acc.id)
                    )
                    row = result.one_or_none()
                    if not row:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Failed to retrieve created accommodation (ID {db_acc.id})",
                        ).model_dump()
                    created_acc, lat, lng = row

                    acc_result = await _accommodation_to_result(created_acc, lat, lng)
                    return ManageAccommodationOutput(
                        operation=operation, success=True,
                        message=f"Accommodation '{name}' created with ID {created_acc.id}",
                        accommodation=acc_result,
                    ).model_dump()

                elif op == AccommodationOperation.READ:
                    if not accommodation_id:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="accommodation_id is required for read operation",
                        ).model_dump()

                    result = await db.execute(
                        select(
                            Accommodation,
                            ST_Y(Accommodation.coordinates).label('lat'),
                            ST_X(Accommodation.coordinates).label('lng'),
                        ).where(Accommodation.id == accommodation_id)
                    )
                    row = result.one_or_none()
                    if not row:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Accommodation with ID {accommodation_id} not found",
                        ).model_dump()

                    acc, lat, lng = row
                    acc_result = await _accommodation_to_result(acc, lat, lng)
                    return ManageAccommodationOutput(
                        operation=operation, success=True,
                        message=f"Accommodation '{acc.name}' retrieved",
                        accommodation=acc_result,
                    ).model_dump()

                elif op == AccommodationOperation.UPDATE:
                    if not accommodation_id:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="accommodation_id is required for update operation",
                        ).model_dump()

                    result = await db.execute(
                        select(Accommodation).where(Accommodation.id == accommodation_id)
                    )
                    db_acc = result.scalar_one_or_none()
                    if not db_acc:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Accommodation with ID {accommodation_id} not found",
                        ).model_dump()

                    # Update provided fields
                    if name is not None:
                        db_acc.name = name
                    if type is not None:
                        db_acc.type = type
                    if address is not None:
                        db_acc.address = address
                    if parsed_check_in is not None:
                        db_acc.check_in_date = parsed_check_in
                    if parsed_check_out is not None:
                        db_acc.check_out_date = parsed_check_out
                    if booking_reference is not None:
                        db_acc.booking_reference = booking_reference
                    if booking_url is not None:
                        db_acc.booking_url = booking_url
                    if total_cost is not None:
                        db_acc.total_cost = total_cost
                    if currency is not None:
                        db_acc.currency = currency
                    if is_paid is not None:
                        db_acc.is_paid = is_paid
                    if description is not None:
                        db_acc.description = description
                    if contact_info is not None:
                        db_acc.contact_info = contact_info
                    if amenities is not None:
                        db_acc.amenities = amenities
                    if rating is not None:
                        db_acc.rating = rating
                    if review is not None:
                        db_acc.review = review

                    # Update PostGIS coordinates if both provided
                    if latitude is not None and longitude is not None:
                        db_acc.coordinates = ST_SetSRID(
                            ST_MakePoint(longitude, latitude), 4326
                        )

                    await db.flush()

                    # Re-query to extract coordinates
                    result = await db.execute(
                        select(
                            Accommodation,
                            ST_Y(Accommodation.coordinates).label('lat'),
                            ST_X(Accommodation.coordinates).label('lng'),
                        ).where(Accommodation.id == accommodation_id)
                    )
                    row = result.one_or_none()
                    if not row:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Failed to retrieve updated accommodation (ID {accommodation_id})",
                        ).model_dump()
                    updated_acc, lat, lng = row

                    acc_result = await _accommodation_to_result(updated_acc, lat, lng)
                    return ManageAccommodationOutput(
                        operation=operation, success=True,
                        message=f"Accommodation '{updated_acc.name}' updated",
                        accommodation=acc_result,
                    ).model_dump()

                elif op == AccommodationOperation.DELETE:
                    if not accommodation_id:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="accommodation_id is required for delete operation",
                        ).model_dump()

                    result = await db.execute(
                        select(Accommodation).where(Accommodation.id == accommodation_id)
                    )
                    db_acc = result.scalar_one_or_none()
                    if not db_acc:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Accommodation with ID {accommodation_id} not found",
                        ).model_dump()

                    acc_name = db_acc.name
                    await db.delete(db_acc)
                    await db.flush()

                    return ManageAccommodationOutput(
                        operation=operation, success=True,
                        message=f"Accommodation '{acc_name}' deleted successfully",
                    ).model_dump()

                elif op == AccommodationOperation.LIST:
                    if not destination_id:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message="destination_id is required for list operation",
                        ).model_dump()

                    # Verify destination exists
                    dest_result = await db.execute(
                        select(Destination).where(Destination.id == destination_id)
                    )
                    dest = dest_result.scalar_one_or_none()
                    if not dest:
                        return ManageAccommodationOutput(
                            operation=operation, success=False,
                            message=f"Destination with ID {destination_id} not found",
                        ).model_dump()

                    result = await db.execute(
                        select(
                            Accommodation,
                            ST_Y(Accommodation.coordinates).label('lat'),
                            ST_X(Accommodation.coordinates).label('lng'),
                        )
                        .where(Accommodation.destination_id == destination_id)
                        .order_by(Accommodation.check_in_date.asc(), Accommodation.created_at.asc())
                    )
                    rows = result.all()

                    acc_results = []
                    for row in rows:
                        acc, lat, lng = row
                        acc_results.append(await _accommodation_to_result(acc, lat, lng))

                    return ManageAccommodationOutput(
                        operation=operation, success=True,
                        message=f"Retrieved {len(acc_results)} accommodations for destination {destination_id}",
                        accommodations=acc_results,
                        total_count=len(acc_results),
                    ).model_dump()

            except Exception as e:
                logger.error(f"manage_accommodation failed: {e}")
                return ManageAccommodationOutput(
                    operation=operation,
                    success=False,
                    message=f"Operation failed: {str(e)}",
                ).model_dump()

    logger.info("Registered accommodation tools: manage_accommodation")

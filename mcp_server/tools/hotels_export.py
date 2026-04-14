"""
MCP Tools: search_hotels, export_trip

Hotel discovery via Google Places and trip export to markdown.
"""

import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP, Context

from mcp_server.context import get_db_session
from mcp_server.auth import get_user_id_from_context, verify_trip_access
from mcp_server.schemas.hotels import HotelSearchResult, HotelSearchOutput, TripExportOutput

logger = logging.getLogger(__name__)


def register_tools(server: FastMCP):
    """Register hotel search and trip export tools."""

    @server.tool()
    async def search_hotels(
        latitude: float,
        longitude: float,
        ctx: Context,
        radius: int = 5000,
        keyword: Optional[str] = None,
        max_results: int = 10,
    ) -> dict:
        """
        Search for hotels near a location using Google Places.

        Use this to find accommodation options near a destination.
        Returns hotel names, ratings, addresses, and Google Places IDs.
        Use the place_id to link to Google Maps or get more details.

        Args:
            latitude: Center latitude (-90 to 90)
            longitude: Center longitude (-180 to 180)
            radius: Search radius in meters (default 5000, max 50000)
            keyword: Optional keyword filter ("luxury", "budget", "boutique", "hostel")
            max_results: Maximum results to return (default 10, max 50)

        Returns:
            List of hotels with names, ratings, addresses, and place IDs.
        """
        logger.info(f"search_hotels called: lat={latitude}, lng={longitude}, radius={radius}")

        try:
            from app.services.google_places_service import GooglePlacesService

            places = await GooglePlacesService.search_nearby_places(
                latitude=latitude,
                longitude=longitude,
                radius=min(radius, 50000),
                place_type="lodging",
                keyword=keyword,
                max_results=min(max_results, 50),
            )

            hotel_results = []
            for r in places:
                loc = r.get("geometry", {}).get("location", {})
                hotel_results.append(HotelSearchResult(
                    place_id=r.get("place_id", ""),
                    name=r.get("name", "Unknown"),
                    address=r.get("vicinity") or r.get("formatted_address"),
                    latitude=loc.get("lat"),
                    longitude=loc.get("lng"),
                    rating=r.get("rating"),
                    user_ratings_total=r.get("user_ratings_total"),
                    types=r.get("types", []),
                ))

            output = HotelSearchOutput(
                results=hotel_results,
                total=len(hotel_results),
                message=f"Found {len(hotel_results)} hotels within {radius}m",
            )
            return output.model_dump()

        except ImportError:
            return HotelSearchOutput(
                message="Google Places service not available. Check GOOGLE_MAPS_API_KEY."
            ).model_dump()
        except Exception as e:
            logger.error(f"Hotel search failed: {e}")
            return HotelSearchOutput(
                message=f"Hotel search failed: {str(e)}"
            ).model_dump()

    @server.tool()
    async def export_trip(
        trip_id: int,
        ctx: Context,
        format: str = "markdown",
    ) -> dict:
        """
        Export a trip as a formatted document.

        Generates a complete, shareable trip itinerary including destinations,
        POIs, accommodations, travel segments, and budget summary.

        Args:
            trip_id: Trip ID to export
            format: Export format — currently supports "markdown" (default)

        Returns:
            The full trip document as text content.
        """
        logger.info(f"export_trip called: trip_id={trip_id}, format={format}")

        from app.models.trip import Trip
        from app.models.destination import Destination
        from app.models.poi import POI
        from app.models.accommodation import Accommodation
        from app.models.travel_segment import TravelSegment
        from app.services.trip_service import TripService
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        user_id = get_user_id_from_context(ctx)

        async with get_db_session() as db:
            try:
                trip = await verify_trip_access(db, trip_id, user_id)

                # Get destinations ordered
                dest_result = await db.execute(
                    select(Destination)
                    .where(Destination.trip_id == trip_id)
                    .order_by(Destination.order_index)
                )
                destinations = dest_result.scalars().all()

                lines = []
                lines.append(f"# {trip.name}")
                lines.append("")
                if trip.description:
                    lines.append(f"> {trip.description}")
                    lines.append("")
                lines.append(f"**Dates:** {trip.start_date} → {trip.end_date}")
                if trip.location:
                    lines.append(f"**Location:** {trip.location}")
                if trip.total_budget:
                    lines.append(f"**Budget:** {trip.total_budget} {trip.currency or 'USD'}")
                lines.append("")

                # Budget summary
                budget = await TripService.get_budget_summary(db, trip_id)
                if budget:
                    lines.append("## Budget Summary")
                    lines.append(f"- Estimated total: {budget.estimated_total} {budget.currency}")
                    lines.append(f"- POIs: {budget.poi_estimated} / Accommodation: {budget.accommodation_total}")
                    if budget.remaining_budget is not None:
                        lines.append(f"- Remaining: {budget.remaining_budget} ({budget.budget_percentage:.0f}% allocated)")
                    lines.append("")

                for dest in destinations:
                    lines.append(f"## {dest.city_name or dest.name}{', ' + dest.country if dest.country else ''}")
                    lines.append(f"**{dest.arrival_date} → {dest.departure_date}**")
                    lines.append("")

                    # Accommodations
                    acc_result = await db.execute(
                        select(Accommodation)
                        .where(Accommodation.destination_id == dest.id)
                        .order_by(Accommodation.check_in_date)
                    )
                    accommodations = acc_result.scalars().all()
                    for acc in accommodations:
                        cost = f" — {acc.total_cost} {acc.currency}" if acc.total_cost else ""
                        lines.append(f"**{acc.name}** ({acc.type}){cost}")
                        if acc.address:
                            lines.append(f"   {acc.address}")
                        lines.append(f"   Check-in: {acc.check_in_date} / Check-out: {acc.check_out_date}")
                        if acc.booking_reference:
                            lines.append(f"   Ref: {acc.booking_reference}")
                        lines.append("")

                    # POIs grouped by date
                    poi_result = await db.execute(
                        select(POI)
                        .where(POI.destination_id == dest.id)
                        .order_by(POI.scheduled_date, POI.day_order)
                    )
                    pois = poi_result.scalars().all()

                    if pois:
                        lines.append("### Activities")
                        current_date = None
                        for poi in pois:
                            date_str = str(poi.scheduled_date) if poi.scheduled_date else "Unscheduled"
                            if date_str != current_date:
                                current_date = date_str
                                lines.append(f"\n**{date_str}:**")
                            cost = f"€{poi.estimated_cost}" if poi.estimated_cost else "free"
                            time = f" ({poi.dwell_time}min)" if poi.dwell_time else ""
                            lines.append(f"- {poi.name} ({poi.category}) — {cost}{time}")
                        lines.append("")

                    # Travel segment from this destination
                    seg_result = await db.execute(
                        select(TravelSegment)
                        .where(TravelSegment.from_destination_id == dest.id)
                    )
                    segment = seg_result.scalars().first()
                    if segment:
                        hours = (segment.duration_minutes or 0) // 60
                        mins = (segment.duration_minutes or 0) % 60
                        dist = f"{segment.distance_km:.0f}km" if segment.distance_km else "?"
                        lines.append(f"**Travel:** {segment.travel_mode} -- {hours}h {mins}m, {dist}")
                        lines.append("")

                lines.append("---")
                lines.append(f"*Generated by Travel Ruter*")

                content = "\n".join(lines)

                return TripExportOutput(
                    trip_name=trip.name,
                    format=format,
                    content=content,
                    message=f"Trip exported as {format}",
                ).model_dump()

            except Exception as e:
                logger.error(f"Trip export failed: {e}")
                return TripExportOutput(
                    trip_name="",
                    format=format,
                    content="",
                    message=f"Export failed: {str(e)}",
                ).model_dump()

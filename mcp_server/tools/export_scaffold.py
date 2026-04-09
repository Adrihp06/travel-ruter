"""
MCP Tool: scaffold_export_documents

Generates structured markdown export documents for a trip, creating one
export_draft note per destination plus a trip overview. Mirrors the logic
of the frontend documentScaffold.js so the AI orchestrator can auto-generate
export documents via chat.
"""

import logging
from collections import defaultdict
from datetime import date as date_type
from typing import Optional

from mcp.server.fastmcp import FastMCP, Context

from mcp_server.context import get_db_session
from mcp_server.auth import get_user_id_from_context, verify_trip_access
from mcp_server.schemas.export_scaffold import (
    ScaffoldedDocument,
    ScaffoldExportOutput,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers — markdown generation (mirrors frontend documentScaffold.js)
# ---------------------------------------------------------------------------

def _format_date(d) -> str:
    """Format a date object or ISO string for display."""
    if d is None:
        return "—"
    if isinstance(d, date_type):
        return d.strftime("%a, %b %d")
    if isinstance(d, str):
        try:
            return date_type.fromisoformat(d).strftime("%a, %b %d")
        except ValueError:
            return d
    try:
        return str(d)
    except Exception:
        return "—"


def _nights_between(arrival, departure) -> Optional[int]:
    """Calculate nights between two dates."""
    if not arrival or not departure:
        return None
    try:
        if isinstance(arrival, str):
            arrival = date_type.fromisoformat(arrival)
        if isinstance(departure, str):
            departure = date_type.fromisoformat(departure)
        diff = (departure - arrival).days
        return diff if diff > 0 else None
    except Exception:
        return None


def _escape_cell(value) -> str:
    """Escape a markdown table cell value."""
    if value is None or value == "":
        return "—"
    return str(value).replace("|", "\\|").replace("\n", " ")


def _serialize_route_block(block_type: str, **kwargs) -> str:
    """
    Serialize a route block shortcode matching the frontend format:
    :::route
    type: day-route
    destinationId: 5
    date: 2024-06-15
    label: My Label
    :::
    """
    lines = [":::route"]
    lines.append(f"type: {block_type}")

    # Emit properties in the same stable order as the frontend
    key_order = ["tripId", "destinationId", "date", "mode", "label"]
    for key in key_order:
        val = kwargs.get(key)
        if val is not None and val != "":
            lines.append(f"{key}: {val}")

    lines.append(":::")
    return "\n".join(lines)


def _group_pois_by_date(pois: list) -> dict:
    """Group POIs by scheduled_date, sort by day_order within each group."""
    groups = defaultdict(list)
    for poi in pois:
        key = str(poi.scheduled_date) if poi.scheduled_date else "unscheduled"
        groups[key].append(poi)

    # Sort within each group by day_order
    for key in groups:
        groups[key].sort(key=lambda p: (p.day_order if p.day_order is not None else float("inf")))

    # Sort groups: real dates first (ascending), 'unscheduled' last
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (1, "") if k == "unscheduled" else (0, k),
    )
    return {k: groups[k] for k in sorted_keys}


# ---------------------------------------------------------------------------
# Document generators
# ---------------------------------------------------------------------------

def _generate_overview_markdown(trip, destinations: list) -> str:
    """Generate trip overview document markdown."""
    lines = []

    lines.append(f"# {trip.name or 'Trip Overview'}")
    lines.append("")

    start = _format_date(trip.start_date)
    end = _format_date(trip.end_date)
    lines.append(f"**Dates**: {start} → {end}")

    if trip.total_budget is not None:
        lines.append(f"**Budget**: {trip.total_budget} {trip.currency or 'USD'}")

    lines.append("")

    # Destinations table
    if destinations:
        lines.append("## Destinations")
        lines.append("")
        lines.append("| Destination | Dates | Duration |")
        lines.append("|---|---|---|")

        for dest in destinations:
            name = ", ".join(filter(None, [dest.city_name, dest.country]))
            arrival = _format_date(dest.arrival_date)
            departure = _format_date(dest.departure_date)
            nights = _nights_between(dest.arrival_date, dest.departure_date)
            duration = f"{nights} night{'s' if nights != 1 else ''}" if nights else "—"
            lines.append(f"| {_escape_cell(name)} | {arrival} → {departure} | {duration} |")

        lines.append("")

    # Trip overview route block
    if trip.id:
        lines.append("## Trip Route")
        lines.append("")
        block = _serialize_route_block(
            "trip-overview",
            tripId=trip.id,
            label=f"{trip.name or 'Trip'} Route Overview",
        )
        lines.append(block)
        lines.append("")

    return "\n".join(lines)


def _generate_destination_markdown(
    destination,
    pois: list,
    accommodations: list,
    notes: list,
    mode: Optional[str] = None,
) -> str:
    """Generate a destination document with daily itinerary, accommodations, and notes."""
    lines = []
    city_name = ", ".join(filter(None, [destination.city_name, destination.country]))

    lines.append(f"# {city_name or 'Destination'}")
    lines.append("")
    lines.append(
        f"**Dates**: {_format_date(destination.arrival_date)} → {_format_date(destination.departure_date)}"
    )
    lines.append("")

    # --- Accommodation section ---
    if accommodations:
        lines.append("## Accommodation")
        lines.append("")
        lines.append("| Name | Type | Dates | Cost |")
        lines.append("|---|---|---|---|")

        for acc in accommodations:
            check_in = _format_date(acc.check_in_date)
            check_out = _format_date(acc.check_out_date)
            cost = (
                f"{acc.total_cost} {acc.currency or 'USD'}"
                if acc.total_cost is not None
                else "—"
            )
            lines.append(
                f"| {_escape_cell(acc.name)} | {_escape_cell(acc.type)} "
                f"| {check_in} → {check_out} | {cost} |"
            )

            if acc.booking_reference:
                lines.append("")
                lines.append(f"> Booking ref: {acc.booking_reference}")

        lines.append("")

    # --- Daily Itinerary ---
    if pois:
        grouped = _group_pois_by_date(pois)

        lines.append("## Daily Itinerary")
        lines.append("")

        day_number = 1
        for date_key, day_pois in grouped.items():
            is_unscheduled = date_key == "unscheduled"
            if is_unscheduled:
                heading = "### Unscheduled"
            else:
                heading = f"### Day {day_number} — {_format_date(date_key)}"
            lines.append(heading)
            lines.append("")
            lines.append("| # | Place | Category | Time | Cost | Notes |")
            lines.append("|---|---|---|---|---|---|")

            for idx, poi in enumerate(day_pois, 1):
                duration = f"{poi.dwell_time}min" if poi.dwell_time else "—"
                cost = str(poi.estimated_cost) if poi.estimated_cost is not None else "—"
                poi_notes = _escape_cell(poi.description) if poi.description else "—"
                lines.append(
                    f"| {idx} | {_escape_cell(poi.name)} | {_escape_cell(poi.category)} "
                    f"| {duration} | {cost} | {poi_notes} |"
                )

            lines.append("")

            # Day route block (only for scheduled days)
            if not is_unscheduled and destination.id:
                day_label = f"{destination.city_name or 'Destination'} — {_format_date(date_key)} Route"
                block = _serialize_route_block(
                    "day-route",
                    destinationId=destination.id,
                    date=date_key,
                    mode=mode,
                    label=day_label,
                )
                lines.append(block)
                lines.append("")

            if not is_unscheduled:
                day_number += 1

    # --- Destination overview route ---
    if destination.id:
        lines.append("## Destination Overview Route")
        lines.append("")
        block = _serialize_route_block(
            "destination-overview",
            destinationId=destination.id,
            mode=mode,
            label=f"{destination.city_name or 'Destination'} Route Overview",
        )
        lines.append(block)
        lines.append("")

    # --- Notes section ---
    if notes:
        lines.append("## Notes")
        lines.append("")
        for note in notes:
            if note.title:
                lines.append(f"### {note.title}")
            if note.content:
                lines.append(note.content)
            lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

def register_tools(server: FastMCP):
    """Register export scaffolding tools with the MCP server."""

    @server.tool()
    async def scaffold_export_documents(
        trip_id: int,
        ctx: Context,
        destination_id: Optional[int] = None,
        overwrite: bool = False,
        mode: Optional[str] = None,
    ) -> dict:
        """
        Generate structured export documents for a trip.

        Creates one export_draft note per destination (with daily itinerary,
        accommodations, route maps, and notes) plus a trip overview document.
        These documents appear in the Export Writer UI and can be exported as PDF.

        Use this when the user asks to "generate export documents", "create travel
        documents", "scaffold the export", or similar requests.

        Args:
            trip_id: Trip ID to generate documents for.
            destination_id: Optional — generate only for this destination.
                           If omitted, generates for ALL destinations plus a trip overview.
            overwrite: If False (default), skip documents that already have content.
                      If True, regenerate and overwrite existing content.
            mode: Travel mode for route maps: "walking", "cycling", "driving", or "transit".
                 If omitted, the frontend will use its default (walking).

        Returns:
            Summary of created/updated/skipped documents with their note IDs.
        """
        logger.info(
            f"scaffold_export_documents called: trip_id={trip_id}, "
            f"destination_id={destination_id}, overwrite={overwrite}"
        )

        from sqlalchemy import select
        from app.models import Trip, Destination, POI, Accommodation, Note

        user_id = get_user_id_from_context(ctx)

        async with get_db_session() as db:
            try:
                # Verify access
                has_access = await verify_trip_access(db, trip_id, user_id)
                if not has_access:
                    return ScaffoldExportOutput(
                        success=False,
                        message=f"Access denied to trip {trip_id}",
                    ).model_dump()

                # Fetch trip
                trip = await db.get(Trip, trip_id)
                if not trip:
                    return ScaffoldExportOutput(
                        success=False,
                        message=f"Trip {trip_id} not found",
                    ).model_dump()

                # Fetch destinations
                dest_query = (
                    select(Destination)
                    .where(Destination.trip_id == trip_id)
                    .order_by(Destination.order_index)
                )
                if destination_id:
                    dest_query = dest_query.where(Destination.id == destination_id)

                dest_result = await db.execute(dest_query)
                destinations = dest_result.scalars().all()

                if destination_id and not destinations:
                    return ScaffoldExportOutput(
                        success=False,
                        message=f"Destination {destination_id} not found in trip {trip_id}",
                    ).model_dump()

                # Fetch all existing export_draft notes for this trip
                existing_notes_result = await db.execute(
                    select(Note)
                    .where(Note.trip_id == trip_id)
                    .where(Note.note_type == "export_draft")
                )
                existing_notes = existing_notes_result.scalars().all()

                # Index by destination_id (None key = overview)
                notes_by_dest = {}
                for note in existing_notes:
                    notes_by_dest[note.destination_id] = note

                results = []
                created = 0
                updated = 0
                skipped = 0

                # --- All destinations for reference (needed for overview) ---
                all_dests_result = await db.execute(
                    select(Destination)
                    .where(Destination.trip_id == trip_id)
                    .order_by(Destination.order_index)
                )
                all_destinations = all_dests_result.scalars().all()

                # --- Generate trip overview (only when scaffolding all destinations) ---
                if not destination_id:
                    overview_md = _generate_overview_markdown(trip, all_destinations)
                    overview_result = await _upsert_export_draft(
                        db=db,
                        notes_by_dest=notes_by_dest,
                        trip_id=trip_id,
                        destination_id=None,
                        title="Trip Overview",
                        content=overview_md,
                        overwrite=overwrite,
                    )
                    results.append(overview_result)
                    if overview_result.action == "created":
                        created += 1
                    elif overview_result.action == "updated":
                        updated += 1
                    else:
                        skipped += 1

                # --- Generate per-destination documents ---
                for dest in destinations:
                    # Fetch POIs
                    poi_result = await db.execute(
                        select(POI)
                        .where(POI.destination_id == dest.id)
                        .order_by(POI.scheduled_date, POI.day_order)
                    )
                    dest_pois = poi_result.scalars().all()

                    # Fetch accommodations
                    acc_result = await db.execute(
                        select(Accommodation)
                        .where(Accommodation.destination_id == dest.id)
                        .order_by(Accommodation.check_in_date)
                    )
                    dest_accs = acc_result.scalars().all()

                    # Fetch non-export_draft notes
                    note_result = await db.execute(
                        select(Note)
                        .where(Note.destination_id == dest.id)
                        .where(Note.trip_id == trip_id)
                        .where(Note.note_type != "export_draft")
                        .order_by(Note.is_pinned.desc(), Note.created_at.desc())
                    )
                    dest_notes = note_result.scalars().all()

                    # Generate markdown
                    dest_md = _generate_destination_markdown(
                        dest, dest_pois, dest_accs, dest_notes, mode=mode
                    )

                    # Create/update export_draft note
                    doc_result = await _upsert_export_draft(
                        db=db,
                        notes_by_dest=notes_by_dest,
                        trip_id=trip_id,
                        destination_id=dest.id,
                        title=dest.city_name or dest.name or "Destination",
                        content=dest_md,
                        overwrite=overwrite,
                    )
                    results.append(doc_result)
                    if doc_result.action == "created":
                        created += 1
                    elif doc_result.action == "updated":
                        updated += 1
                    else:
                        skipped += 1

                await db.flush()

                total = len(results)
                msg_parts = []
                if created:
                    msg_parts.append(f"{created} created")
                if updated:
                    msg_parts.append(f"{updated} updated")
                if skipped:
                    msg_parts.append(f"{skipped} skipped (had content)")
                summary = ", ".join(msg_parts) if msg_parts else "no changes"

                return ScaffoldExportOutput(
                    success=True,
                    message=f"Scaffolded {total} export documents for trip '{trip.name}': {summary}",
                    documents=results,
                    total_created=created,
                    total_updated=updated,
                    total_skipped=skipped,
                ).model_dump()

            except Exception as e:
                logger.error(f"scaffold_export_documents failed: {e}")
                return ScaffoldExportOutput(
                    success=False,
                    message=f"Failed to scaffold export documents: {str(e)}",
                ).model_dump()

    logger.info("Registered export scaffold tools: scaffold_export_documents")


async def _upsert_export_draft(
    db,
    notes_by_dest: dict,
    trip_id: int,
    destination_id: Optional[int],
    title: str,
    content: str,
    overwrite: bool,
) -> ScaffoldedDocument:
    """Create or update an export_draft note. Returns a ScaffoldedDocument."""
    from app.models import Note

    existing = notes_by_dest.get(destination_id)

    if existing:
        has_content = existing.content and len(existing.content.strip()) > 0
        if has_content and not overwrite:
            return ScaffoldedDocument(
                note_id=existing.id,
                title=existing.title,
                destination_id=destination_id,
                action="skipped",
                content_length=len(existing.content or ""),
            )

        # Update existing note
        existing.content = content
        existing.title = title
        await db.flush()
        await db.refresh(existing)

        return ScaffoldedDocument(
            note_id=existing.id,
            title=title,
            destination_id=destination_id,
            action="updated",
            content_length=len(content),
        )

    # Create new export_draft note
    new_note = Note(
        trip_id=trip_id,
        destination_id=destination_id,
        title=title,
        content=content,
        note_type="export_draft",
    )
    db.add(new_note)
    await db.flush()
    await db.refresh(new_note)

    # Track in lookup for subsequent calls
    notes_by_dest[destination_id] = new_note

    return ScaffoldedDocument(
        note_id=new_note.id,
        title=title,
        destination_id=destination_id,
        action="created",
        content_length=len(content),
    )

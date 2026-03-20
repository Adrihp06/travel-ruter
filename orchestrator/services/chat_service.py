"""Chat business logic: instruction building, API key resolution, MCP health, model settings."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import TYPE_CHECKING

import httpx
from pydantic_ai.models.anthropic import AnthropicModelSettings

from orchestrator.config import SYSTEM_PROMPT, settings

if TYPE_CHECKING:
    from orchestrator.session import Session

logger = logging.getLogger("orchestrator.chat_service")

# Backend URL for internal calls (same Docker network)
_BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

# TTL for per-trip API key cache (seconds)
_KEY_TTL = 300  # 5 minutes

_mcp_restart_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Model settings
# ---------------------------------------------------------------------------

def get_model_settings(pydantic_ai_model: str):
    """Return model settings with prompt caching enabled for Anthropic models."""
    if isinstance(pydantic_ai_model, str) and pydantic_ai_model.startswith("anthropic:"):
        return AnthropicModelSettings(
            max_tokens=settings.max_output_tokens,
            anthropic_cache_instructions=True,
            anthropic_cache_tool_definitions=True,
        )
    return {"max_tokens": settings.max_output_tokens}


# ---------------------------------------------------------------------------
# Trip-level API key resolution
# ---------------------------------------------------------------------------

async def resolve_trip_api_key(session: Session) -> str | None:
    """Fetch the AI provider API key for a session's model from the backend.

    Returns the key string or None (meaning fall back to env var).
    Uses a cached value on the session to avoid repeated lookups.
    """
    from orchestrator.agent import provider_from_model_id

    async with session._api_key_lock:
        if session._resolved_api_key is not None:
            if (time.monotonic() - session._resolved_api_key_at) < _KEY_TTL:
                return session._resolved_api_key
            session._resolved_api_key = None

        if not session.trip_id:
            return None

        provider = provider_from_model_id(session.model_id)
        if not provider:
            return None

        if not session.user_id:
            return None

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{_BACKEND_URL}/api/v1/trips/{session.trip_id}/api-keys/{provider}/value",
                    headers={
                        "X-Internal-Key": settings.INTERNAL_SERVICE_KEY,
                        "X-User-Id": str(session.user_id),
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    key = data.get("key")
                    if key:
                        session._resolved_api_key = key
                        session._resolved_api_key_at = time.monotonic()
                        logger.info("Resolved trip-level %s key for trip_id=%s", provider, session.trip_id)
                        return key
        except Exception as exc:
            logger.debug("Could not fetch trip-level key for %s: %s", provider, exc)

        return None


# ---------------------------------------------------------------------------
# MCP subprocess health check
# ---------------------------------------------------------------------------

async def ensure_mcp_alive(app) -> None:
    """Check if MCP subprocess is alive, restart if needed."""
    mcp = app.state.mcp
    proc = getattr(mcp, '_process', None) or getattr(mcp, 'process', None)
    if proc is None:
        return

    is_dead = False
    if hasattr(proc, 'poll') and proc.poll() is not None:
        is_dead = True
    elif hasattr(proc, 'returncode') and proc.returncode is not None:
        is_dead = True
    if not is_dead:
        return

    async with _mcp_restart_lock:
        proc = getattr(mcp, '_process', None) or getattr(mcp, 'process', None)
        if proc is not None:
            still_dead = False
            if hasattr(proc, 'poll') and proc.poll() is not None:
                still_dead = True
            elif hasattr(proc, 'returncode') and proc.returncode is not None:
                still_dead = True
            if not still_dead:
                return

        logger.warning("MCP subprocess died, restarting...")
        try:
            await mcp.__aexit__(None, None, None)
        except Exception:
            pass
        try:
            await mcp.__aenter__()
            app.state.mcp_connected = True
            from orchestrator.agent import create_agent
            app.state.agent = create_agent(mcp)
            logger.info("MCP subprocess restarted successfully, agent recreated")
        except Exception as exc:
            app.state.mcp_connected = False
            logger.error("MCP subprocess restart failed: %s", exc)


# ---------------------------------------------------------------------------
# Instruction builder
# ---------------------------------------------------------------------------

def build_instructions(
    trip_context: dict | None,
    chat_mode: str | None = None,
    custom_system_prompt: str | None = None,
) -> str:
    """Append trip context to the system prompt.

    Formats rich context (POIs, accommodations, itinerary) into a readable
    section so the AI can answer contextually without extra tool calls.
    """
    prompt = custom_system_prompt or SYSTEM_PROMPT

    if chat_mode == "new":
        prompt += """

## ⚠️ NEW TRIP MODE — STRICT CONSTRAINTS ⚠️

The user wants to create a BRAND NEW trip from scratch. You have NO active trip.

HARD RULES — violating these is a critical error:
1. Your VERY FIRST tool call MUST be `manage_trip(operation="create")`. No exceptions.
2. Use ONLY the `trip_id` returned by that create call for ALL subsequent `manage_destination` calls.
3. NEVER call `manage_trip(operation="list")` or `manage_trip(operation="read")` — doing so will expose existing trip IDs and you will accidentally use them.
4. NEVER use a trip_id from memory, context, or a previous conversation. Only use the id from the fresh create response.
5. If `manage_trip(operation="create")` fails, stop and tell the user. Do NOT fall back to any existing trip.

The user's existing trips (Japan, Rome, etc.) are completely off-limits. Do not touch them."""

    if not trip_context:
        return prompt

    prompt += "\n\n## Current Context\n"

    # Trip-level info
    tid = trip_context.get("tripId") or trip_context.get("trip_id") or trip_context.get("id")
    if tid:
        prompt += f"- Trip ID: {tid}\n"
    name = trip_context.get("name")
    if name:
        prompt += f"- Trip: {name}\n"
    start = trip_context.get("startDate") or trip_context.get("start_date")
    end = trip_context.get("endDate") or trip_context.get("end_date")
    if start and end:
        prompt += f"- Dates: {start} to {end}\n"
    budget = trip_context.get("budget")
    currency = trip_context.get("currency")
    if budget:
        prompt += f"- Budget: {budget} {currency or 'USD'}\n"

    prompt += _format_destinations(trip_context)
    prompt += _format_travel_segments(trip_context)
    prompt += _format_origin_return(trip_context)
    prompt += _format_active_destination(trip_context)
    prompt += _format_writer_context(trip_context)
    prompt += _format_legacy_fields(trip_context)

    return prompt


def _format_destinations(ctx: dict) -> str:
    """Format trip destinations overview."""
    dests = ctx.get("destinations")
    if not dests:
        return ""
    lines = [f"\n### Trip Itinerary ({len(dests)} destinations)\n"]
    for d in dests:
        did = d.get("id")
        dname = d.get("name", "Unknown")
        dcountry = d.get("country", "")
        darr = d.get("arrivalDate") or d.get("arrival_date", "")
        ddep = d.get("departureDate") or d.get("departure_date", "")
        dlat = d.get("lat") or d.get("latitude")
        dlng = d.get("lng") or d.get("longitude")
        coords = f" ({dlat}, {dlng})" if dlat and dlng else ""
        id_str = f" [destination_id={did}]" if did else ""
        lines.append(f"- {dname}, {dcountry}: {darr} → {ddep}{coords}{id_str}\n")
    return "".join(lines)


def _format_travel_segments(ctx: dict) -> str:
    """Format travel segments between destinations."""
    segments_data = ctx.get("travelSegments")
    dests = ctx.get("destinations")
    if not segments_data or not dests:
        return ""
    dest_names = {d.get("id"): d.get("name", f"dest#{d.get('id')}") for d in dests}
    lines = ["\n### How to Travel Between Destinations\n"]
    for seg in segments_data:
        from_name = dest_names.get(seg.get("fromId"), f"dest#{seg.get('fromId')}")
        to_name = dest_names.get(seg.get("toId"), f"dest#{seg.get('toId')}")
        mode = seg.get("mode", "unknown")
        dist = seg.get("distanceKm")
        dur = seg.get("durationMin")
        details = []
        if dist:
            details.append(f"{dist:.0f} km")
        if dur:
            h, m = divmod(int(dur), 60)
            details.append(f"{h}h{m:02d}min" if h else f"{m}min")
        details_str = f" ({', '.join(details)})" if details else ""
        lines.append(f"- {from_name} → {to_name}: {mode}{details_str}\n")
    return "".join(lines)


def _format_origin_return(ctx: dict) -> str:
    """Format origin and return journey segments."""
    origin_seg = ctx.get("originSegment")
    return_seg = ctx.get("returnSegment")
    if not origin_seg and not return_seg:
        return ""
    lines = ["\n### Journey Origin & Return\n"]
    for label, seg in [("Depart from", origin_seg), ("Return to", return_seg)]:
        if not seg:
            continue
        mode = seg.get("mode", "")
        dist = seg.get("distanceKm")
        dur = seg.get("durationMin")
        details = []
        if dist:
            details.append(f"{dist:.0f} km")
        if dur:
            h, m = divmod(int(dur), 60)
            details.append(f"{h}h{m:02d}min" if h else f"{m}min")
        details_str = f" ({', '.join(details)})" if details else ""
        lines.append(f"- {label}: {seg.get('fromName', '?')} → {seg.get('toName', '?')}: {mode}{details_str}\n")
    return "".join(lines)


def _format_active_destination(ctx: dict) -> str:
    """Format the currently viewed destination detail."""
    dest = ctx.get("destination")
    if not dest:
        return ""
    lines = []
    dest_id = dest.get("id")
    dest_name = dest.get('name', 'Unknown')
    lines.append(f"\n### Currently Viewing: {dest_name}")
    if dest.get("country"):
        lines.append(f", {dest['country']}")
    lines.append("\n")
    if dest_id:
        lines.append(f"- Destination ID: {dest_id}\n")
        lines.append(
            f"\n⚠️ ACTIVE DESTINATION: {dest_name} [destination_id={dest_id}]\n"
            f"ALL POI and accommodation operations MUST use destination_id={dest_id}.\n"
            f"Do NOT use destination IDs from previous messages or other destinations.\n\n"
        )
    if dest.get("latitude") and dest.get("longitude"):
        lines.append(f"- Coordinates: ({dest['latitude']}, {dest['longitude']})\n")
    if dest.get("arrivalDate") and dest.get("departureDate"):
        lines.append(f"- Dates: {dest['arrivalDate']} → {dest['departureDate']}\n")

    lines.append(_format_pois(dest))
    lines.append(_format_accommodations(dest))

    dest_notes = dest.get("notes")
    if dest_notes:
        lines.append(f"\n**Destination notes:**\n{dest_notes}\n")

    reference_notes = dest.get("referenceNotes") or dest.get("reference_notes") or []
    if reference_notes:
        lines.append(f"\n**Destination reference notes ({len(reference_notes)}):**\n")
        for note in reference_notes:
            title = note.get("title") or "Untitled"
            content = (note.get("content") or "").strip()
            lines.append(f"  - {title}")
            if content:
                lines.append(f": {content[:280]}")
                if len(content) > 280:
                    lines.append("...")
            lines.append("\n")

    return "".join(lines)


def _format_pois(dest: dict) -> str:
    """Format POIs for the active destination."""
    pois = dest.get("pois", [])
    if not pois:
        return ""
    lines = [f"\n**Planned Activities ({len(pois)} POIs):**\n"]
    scheduled: dict[str, list] = {}
    unscheduled: list = []
    for p in pois:
        sd = p.get("scheduledDate") or p.get("scheduled_date")
        if sd:
            scheduled.setdefault(sd, []).append(p)
        else:
            unscheduled.append(p)
    for date in sorted(scheduled.keys()):
        lines.append(f"  Day {date}:\n")
        for p in sorted(scheduled[date], key=lambda x: x.get("dayOrder", 0)):
            cost_str = f" (~{p.get('estimatedCost')} {p.get('currency', '')})" if p.get("estimatedCost") else ""
            time_str = f" [{p.get('dwellTime')}min]" if p.get("dwellTime") else ""
            pid_str = f" [poi_id={p['id']}]" if p.get("id") else ""
            lines.append(f"    - {p['name']} ({p.get('category', 'Other')}){time_str}{cost_str}{pid_str}\n")
    if unscheduled:
        lines.append("  Unscheduled:\n")
        for p in unscheduled:
            pid_str = f" [poi_id={p['id']}]" if p.get("id") else ""
            lines.append(f"    - {p['name']} ({p.get('category', 'Other')}){pid_str}\n")
    return "".join(lines)


def _format_accommodations(dest: dict) -> str:
    """Format accommodations for the active destination."""
    accs = dest.get("accommodations", [])
    if not accs:
        return ""
    lines = [f"\n**Accommodations ({len(accs)}):**\n"]
    for a in accs:
        aid_str = f" [accommodation_id={a['id']}]" if a.get("id") else ""
        line = f"  - {a['name']} ({a.get('type', 'hotel')}){aid_str}"
        if a.get("address"):
            line += f" at {a['address']}"
        if a.get("checkIn") and a.get("checkOut"):
            line += f" [{a['checkIn']} → {a['checkOut']}]"
        if a.get("lat") and a.get("lng"):
            line += f" ({a['lat']}, {a['lng']})"
        lines.append(line + "\n")
    return "".join(lines)


def _format_writer_context(ctx: dict) -> str:
    """Format writer context if present."""
    writer_context = ctx.get("writerContext") or ctx.get("writer_context")
    if not writer_context:
        return ""
    lines = ["\n### Writing Context\n"]
    current_title = writer_context.get("currentDocumentTitle") or writer_context.get("current_document_title")
    current_type = writer_context.get("currentDocumentType") or writer_context.get("current_document_type")
    if current_title:
        lines.append(f"- Current document: {current_title}\n")
    if current_type:
        lines.append(f"- Document type: {current_type}\n")

    current_excerpt = (
        writer_context.get("currentDocumentExcerpt")
        or writer_context.get("current_document_excerpt")
        or ""
    ).strip()
    if current_excerpt:
        lines.append(f"- Current excerpt: {current_excerpt}\n")

    trip_notes = writer_context.get("tripReferenceNotes") or writer_context.get("trip_reference_notes") or []
    if trip_notes:
        lines.append(f"- Trip reference notes: {len(trip_notes)} available\n")
        for note in trip_notes:
            title = note.get("title") or "Untitled"
            content = (note.get("content") or "").strip()
            lines.append(f"  - {title}")
            if content:
                lines.append(f": {content[:200]}")
                if len(content) > 200:
                    lines.append("...")
            lines.append("\n")
    return "".join(lines)


def _format_legacy_fields(ctx: dict) -> str:
    """Format legacy context fields."""
    lines = []
    if ctx.get("destinationId") or ctx.get("destination_id"):
        did = ctx.get("destinationId") or ctx.get("destination_id")
        lines.append(f"- Current destination ID: {did}\n")
    loc = ctx.get("currentLocation") or ctx.get("current_location")
    if loc:
        lines.append(f"- User location: ({loc.get('lat')}, {loc.get('lng')})\n")
    return "".join(lines)

"""PydanticAI Agent + MCPServerStdio setup."""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio

from orchestrator.config import SYSTEM_PROMPT, _MODEL_MAP, settings


def create_mcp_server() -> MCPServerStdio:
    """Create the MCP server that spawns ``python3 -m mcp_server``.

    Same behaviour as ``mcp/client.ts`` lines 24-31.
    """
    env = {**os.environ, "PYTHONPATH": os.environ.get("PYTHONPATH", "..")}
    if settings.database_url:
        env["DATABASE_URL"] = settings.database_url
    if settings.google_maps_api_key:
        env["GOOGLE_MAPS_API_KEY"] = settings.google_maps_api_key
    if settings.openrouteservice_api_key:
        env["OPENROUTESERVICE_API_KEY"] = settings.openrouteservice_api_key

    return MCPServerStdio(
        settings.mcp_python_path,
        args=["-m", "mcp_server"],
        env=env,
        timeout=30,
    )


def create_agent(mcp: MCPServerStdio) -> Agent:
    """Create a single PydanticAI Agent wired to the MCP toolset.

    The ``model`` is overridden at call-time via ``run(model=…)``,
    so the default here is just a sensible fallback.
    """
    return Agent(
        "anthropic:claude-sonnet-4-5-20250929",
        instructions=SYSTEM_PROMPT,
        toolsets=[mcp],
        retries=2,
        end_strategy='exhaustive',
    )


def resolve_model_name(frontend_model_id: str) -> str:
    """Map a frontend model ID to a PydanticAI model string.

    Examples:
        ``claude-sonnet-4-5-20250929``  →  ``anthropic:claude-sonnet-4-5-20250929``
        ``gpt-4.1``                     →  ``openai:gpt-4.1``
        ``llama3.2:latest``             →  ``ollama:llama3.2:latest``
    """
    info = _MODEL_MAP.get(frontend_model_id)
    if info:
        return info.pydantic_ai_name
    # Unknown model – assume Ollama local
    return f"ollama:{frontend_model_id}"


def build_instructions(trip_context: dict | None) -> str:
    """Append trip context to the system prompt.

    Formats rich context (POIs, accommodations, itinerary) into a readable
    section so the AI can answer contextually without extra tool calls.
    """
    prompt = SYSTEM_PROMPT

    if not trip_context:
        return prompt

    prompt += "\n\n## Current Context\n"

    # Trip-level info
    tid = trip_context.get("tripId") or trip_context.get("trip_id")
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

    # Trip destinations overview
    dests = trip_context.get("destinations")
    if dests:
        prompt += f"\n### Trip Itinerary ({len(dests)} destinations)\n"
        for d in dests:
            dname = d.get("name", "Unknown")
            dcountry = d.get("country", "")
            darr = d.get("arrivalDate") or d.get("arrival_date", "")
            ddep = d.get("departureDate") or d.get("departure_date", "")
            dlat = d.get("lat") or d.get("latitude")
            dlng = d.get("lng") or d.get("longitude")
            coords = f" ({dlat}, {dlng})" if dlat and dlng else ""
            prompt += f"- {dname}, {dcountry}: {darr} → {ddep}{coords}\n"

    # Active destination detail (when user is viewing a specific destination)
    dest = trip_context.get("destination")
    if dest:
        prompt += f"\n### Currently Viewing: {dest.get('name', 'Unknown')}"
        if dest.get("country"):
            prompt += f", {dest['country']}"
        prompt += "\n"
        if dest.get("latitude") and dest.get("longitude"):
            prompt += f"- Coordinates: ({dest['latitude']}, {dest['longitude']})\n"
        if dest.get("arrivalDate") and dest.get("departureDate"):
            prompt += f"- Dates: {dest['arrivalDate']} → {dest['departureDate']}\n"

        # POIs
        pois = dest.get("pois", [])
        if pois:
            prompt += f"\n**Planned Activities ({len(pois)} POIs):**\n"
            scheduled: dict[str, list] = {}
            unscheduled: list = []
            for p in pois:
                sd = p.get("scheduledDate") or p.get("scheduled_date")
                if sd:
                    scheduled.setdefault(sd, []).append(p)
                else:
                    unscheduled.append(p)
            for date in sorted(scheduled.keys()):
                prompt += f"  Day {date}:\n"
                for p in sorted(scheduled[date], key=lambda x: x.get("dayOrder", 0)):
                    cost_str = f" (~{p.get('estimatedCost')} {p.get('currency', '')})" if p.get("estimatedCost") else ""
                    time_str = f" [{p.get('dwellTime')}min]" if p.get("dwellTime") else ""
                    prompt += f"    - {p['name']} ({p.get('category', 'Other')}){time_str}{cost_str}\n"
            if unscheduled:
                prompt += "  Unscheduled:\n"
                for p in unscheduled:
                    prompt += f"    - {p['name']} ({p.get('category', 'Other')})\n"

        # Accommodations
        accs = dest.get("accommodations", [])
        if accs:
            prompt += f"\n**Accommodations ({len(accs)}):**\n"
            for a in accs:
                prompt += f"  - {a['name']} ({a.get('type', 'hotel')})"
                if a.get("address"):
                    prompt += f" at {a['address']}"
                if a.get("checkIn") and a.get("checkOut"):
                    prompt += f" [{a['checkIn']} → {a['checkOut']}]"
                if a.get("lat") and a.get("lng"):
                    prompt += f" ({a['lat']}, {a['lng']})"
                prompt += "\n"

    # Legacy fallback
    if trip_context.get("destinationId") or trip_context.get("destination_id"):
        did = trip_context.get("destinationId") or trip_context.get("destination_id")
        prompt += f"- Current destination ID: {did}\n"
    loc = trip_context.get("currentLocation") or trip_context.get("current_location")
    if loc:
        prompt += f"- User location: ({loc.get('lat')}, {loc.get('lng')})\n"

    return prompt

"""PydanticAI Agent + MCPServerStdio setup."""

from __future__ import annotations

import logging
import os

from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from orchestrator.config import SYSTEM_PROMPT, _MODEL_MAP, settings

logger = logging.getLogger("orchestrator.agent")


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
    if settings.perplexity_api_key:
        env["PERPLEXITY_API_KEY"] = settings.perplexity_api_key

    return MCPServerStdio(
        settings.mcp_python_path,
        args=["-m", "mcp_server"],
        env=env,
        timeout=60,
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
    # Check if it looks like an Ollama model (contains ":" like "llama3.2:latest")
    if ":" in frontend_model_id:
        return f"ollama:{frontend_model_id}"
    valid_ids = sorted(_MODEL_MAP.keys())
    raise ValueError(
        f"Unknown model ID '{frontend_model_id}'. "
        f"Valid model IDs: {valid_ids}. "
        f"For Ollama models, use the format 'model:tag' (e.g., 'llama3.2:latest')."
    )


def provider_from_model_id(model_id: str) -> str | None:
    """Derive the AI provider service name from a frontend model ID."""
    info = _MODEL_MAP.get(model_id)
    if info:
        prov = info.provider
        if prov == "claude":
            return "anthropic"
        if prov == "openai":
            return "openai"
        if prov == "gemini":
            return "google_ai"
        return None
    # Ollama models don't need external API keys
    return None


def resolve_model_with_key(pydantic_ai_model: str, api_key: str | None):
    """Return a model instance with an explicit API key, or the string name for env var fallback.

    When ``api_key`` is ``None``, returns the plain model string so pydantic-ai
    reads from environment variables as before.
    """
    if not api_key:
        return pydantic_ai_model

    # Parse provider prefix from pydantic_ai_model (e.g. "anthropic:claude-...")
    if pydantic_ai_model.startswith("anthropic:"):
        model_name = pydantic_ai_model.split(":", 1)[1]
        logger.info("Creating AnthropicModel with explicit key for %s", model_name)
        return AnthropicModel(model_name, api_key=api_key)
    if pydantic_ai_model.startswith("openai:"):
        model_name = pydantic_ai_model.split(":", 1)[1]
        logger.info("Creating OpenAIModel with explicit key for %s", model_name)
        return OpenAIModel(model_name, api_key=api_key)
    if pydantic_ai_model.startswith("google-vertex:"):
        # Vertex AI uses project credentials (ADC), not API keys.
        # Return string so PydanticAI resolves via GOOGLE_CLOUD_PROJECT + ADC.
        logger.info("Vertex AI model %s — ignoring trip-level key, using ADC", pydantic_ai_model)
        return pydantic_ai_model
    if pydantic_ai_model.startswith("google-gla:"):
        model_name = pydantic_ai_model.split(":", 1)[1]
        logger.info("Creating GoogleModel with explicit key for %s", model_name)
        return GoogleModel(model_name, provider=GoogleProvider(api_key=api_key))

    # Unknown provider — fall back to string (env var)
    return pydantic_ai_model


def build_instructions(trip_context: dict | None, chat_mode: str | None = None) -> str:
    """Append trip context to the system prompt.

    Formats rich context (POIs, accommodations, itinerary) into a readable
    section so the AI can answer contextually without extra tool calls.
    """
    prompt = SYSTEM_PROMPT

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

    # Trip-level info — check tripId, trip_id, and legacy "id" field
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

    # Trip destinations overview — include destination IDs so agent can reference them
    dests = trip_context.get("destinations")
    if dests:
        prompt += f"\n### Trip Itinerary ({len(dests)} destinations)\n"
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
            prompt += f"- {dname}, {dcountry}: {darr} → {ddep}{coords}{id_str}\n"

    # Active destination detail (when user is viewing a specific destination)
    dest = trip_context.get("destination")
    if dest:
        dest_id = dest.get("id")
        prompt += f"\n### Currently Viewing: {dest.get('name', 'Unknown')}"
        if dest.get("country"):
            prompt += f", {dest['country']}"
        prompt += "\n"
        if dest_id:
            prompt += f"- Destination ID: {dest_id}\n"
        if dest.get("latitude") and dest.get("longitude"):
            prompt += f"- Coordinates: ({dest['latitude']}, {dest['longitude']})\n"
        if dest.get("arrivalDate") and dest.get("departureDate"):
            prompt += f"- Dates: {dest['arrivalDate']} → {dest['departureDate']}\n"

        # POIs — include IDs so agent can update/delete specific ones
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
                    pid_str = f" [poi_id={p['id']}]" if p.get("id") else ""
                    prompt += f"    - {p['name']} ({p.get('category', 'Other')}){time_str}{cost_str}{pid_str}\n"
            if unscheduled:
                prompt += "  Unscheduled:\n"
                for p in unscheduled:
                    pid_str = f" [poi_id={p['id']}]" if p.get("id") else ""
                    prompt += f"    - {p['name']} ({p.get('category', 'Other')}){pid_str}\n"

        # Accommodations — include IDs
        accs = dest.get("accommodations", [])
        if accs:
            prompt += f"\n**Accommodations ({len(accs)}):**\n"
            for a in accs:
                aid_str = f" [accommodation_id={a['id']}]" if a.get("id") else ""
                prompt += f"  - {a['name']} ({a.get('type', 'hotel')}){aid_str}"
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

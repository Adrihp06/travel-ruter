"""Configuration for the Travel Bridge Orchestrator."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from pydantic_settings import BaseSettings


class OrchestratorSettings(BaseSettings):
    """Environment-driven settings (reads from .env automatically)."""

    model_config = {"env_file": ".env", "extra": "ignore"}

    port: int = 3001
    version: str = "1.0.0"

    # Provider API keys
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"

    # Ollama
    ollama_host: str = "http://localhost:11434"

    # Travel APIs
    amadeus_client_id: str = ""
    amadeus_client_secret: str = ""

    # Travel API keys (passed through to MCP server env)
    google_maps_api_key: str = ""
    openrouteservice_api_key: str = ""

    # MCP Server
    mcp_python_path: str = "python3"
    pythonpath: str = ".."

    # Session management
    session_timeout: int = 240  # minutes (4 hours)
    max_session_history: int = 100

    # Agent output
    max_output_tokens: int = 16384  # generous limit for detailed responses

    # Database (passed through to MCP server env)
    database_url: str = ""

    # JWT Auth
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"

    # Internal service auth (orchestrator → backend)
    INTERNAL_SERVICE_KEY: str = ""

    # CORS — restrict in production via CORS_ORIGINS env var
    cors_origins: str = "https://travelruter.com,http://localhost:5173"


settings = OrchestratorSettings()

logger = logging.getLogger(__name__)

_PLACEHOLDER_SECRETS = frozenset({
    "change-me-in-production",
    "changeme",
    "secret",
    "your-secret-key",
    "replace-me",
})


def validate_security_settings() -> None:
    """Validate that critical security keys are properly configured.

    In production (ENVIRONMENT or ENV == "production" | "prod"), missing or
    placeholder keys raise ``RuntimeError`` to prevent the service from
    starting in an insecure state.  In development the same conditions emit
    a WARNING so developers are alerted but not blocked.
    """
    env = (
        os.environ.get("ENVIRONMENT", "") or os.environ.get("ENV", "")
    ).lower().strip()
    is_production = env in ("production", "prod")

    issues: list[str] = []

    jwt_key = settings.JWT_SECRET_KEY.strip()
    if not jwt_key or jwt_key.lower() in _PLACEHOLDER_SECRETS:
        issues.append(
            "JWT_SECRET_KEY is empty or a known placeholder — "
            "attackers can forge authentication tokens"
        )

    if not settings.INTERNAL_SERVICE_KEY.strip():
        issues.append(
            "INTERNAL_SERVICE_KEY is empty — "
            "service-to-service calls cannot be authenticated"
        )

    if not issues:
        return

    msg = (
        "Security configuration issues detected:\n"
        + "\n".join(f"  • {i}" for i in issues)
    )

    if is_production:
        raise RuntimeError(
            f"{msg}\n\nRefusing to start in production with insecure defaults. "
            "Set these environment variables before deploying."
        )

    logger.warning(msg)


# ---------------------------------------------------------------------------
# Credential fallback helpers
# ---------------------------------------------------------------------------

def _read_claude_credentials() -> str | None:
    """Read API key from ~/.claude/credentials.json if no env var is set."""
    cred_path = Path.home() / ".claude" / "credentials.json"
    if cred_path.exists():
        try:
            data = json.loads(cred_path.read_text())
            return data.get("apiKey") or data.get("api_key")
        except Exception:
            return None
    return None


def _gcloud_adc_available() -> bool:
    """Check if Application Default Credentials exist and are structurally valid."""
    cred_path = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"
    if not cred_path.exists():
        return False
    try:
        data = json.loads(cred_path.read_text())
        cred_type = data.get("type", "")
        if cred_type == "authorized_user":
            return bool(data.get("client_id") and data.get("refresh_token"))
        if cred_type == "service_account":
            return bool(data.get("private_key"))
        return False
    except Exception:
        return False


def ensure_provider_env() -> None:
    """Set env vars from credential files when API keys are missing.

    PydanticAI reads keys from well-known env vars, so we populate them once
    at startup.  Also validates critical security settings.
    """
    validate_security_settings()

    if not os.environ.get("ANTHROPIC_API_KEY") and not settings.anthropic_api_key:
        key = _read_claude_credentials()
        if key:
            os.environ["ANTHROPIC_API_KEY"] = key
    elif settings.anthropic_api_key:
        os.environ.setdefault("ANTHROPIC_API_KEY", settings.anthropic_api_key)

    if settings.google_api_key:
        os.environ.setdefault("GOOGLE_API_KEY", settings.google_api_key)
    if settings.google_cloud_project:
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.google_cloud_project)
    if settings.google_cloud_location:
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", settings.google_cloud_location)

    if settings.openai_api_key:
        os.environ.setdefault("OPENAI_API_KEY", settings.openai_api_key)


# ---------------------------------------------------------------------------
# System prompt (verbatim from config.ts lines 79-169)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = r"""You are an expert travel planning assistant with deep knowledge of destinations worldwide and access to powerful tools. You are autonomous, thorough, and action-oriented.

## Tool Reference

### Web Search (USE THIS BY DEFAULT for information requests)
| Tool | Purpose | Key params |
|------|---------|-----------|
| **web_search** | Search the internet for real-time info | query, context |

**IMPORTANT — web_search usage rules:**
- **ALWAYS use `web_search` FIRST** when the user asks you to search, look up, find out, investigate, or requests any factual information you don't already have in context.
- Use it for: prices, opening hours, events, news, reviews, visa/entry requirements, safety info, local tips, transport schedules, weather, cultural norms, current regulations, restaurant/hotel recommendations with real data, "best X in Y" questions, anything time-sensitive.
- When suggesting POIs or restaurants, use `web_search` first to get current, accurate recommendations, THEN use `get_poi_suggestions` or `manage_poi` to save them.
- Write specific, detailed queries including location and year for best results. Example: "best sushi restaurants near Shibuya Tokyo 2026 with prices".
- You can pass the trip context (destination, dates, preferences) in the `context` parameter to get more relevant results.
- If the user writes in a specific language, write the search query in that language for localized results.
- **PERFORMANCE**: Prefer ONE comprehensive query over multiple narrow searches. For example, instead of searching "restaurants in Tokyo" then "bars in Tokyo" separately, combine into "best restaurants and bars in Tokyo 2026". Each web_search call takes several seconds, so minimise the number of calls.

### Discovery
| Tool | Purpose | Key params |
|------|---------|-----------|
| **search_destinations** | Geocode & validate locations | query |
| **get_poi_suggestions** | Find attractions, food, activities | latitude, longitude, category, trip_type |

### Planning
| Tool | Purpose | Key params |
|------|---------|-----------|
| **calculate_route** | Directions between 2 points | origin, destination, profile |
| **get_travel_matrix** | Travel times for multiple points | coordinates, profile |
| **generate_smart_schedule** | Auto-optimize daily itinerary | trip_id |

### Management
| Tool | Purpose | Key params |
|------|---------|-----------|
| **manage_trip** | CRUD for trips | operation, name, dates |
| **manage_accommodation** | CRUD for hotels/hostels/Airbnbs | operation, destination_id, name, type, check_in_date, check_out_date |
| **manage_note** | CRUD for travel notes | operation, trip_id, title, poi_id, content |
| **calculate_budget** | Cost breakdown & analysis | trip_id |

## Reasoning & Action Loop

You operate using a Reason → Act → Observe → Reason cycle:

1. **REASON**: Analyze the user's request and plan what tools and steps you need.
2. **ACT**: Call the appropriate tools. Chain multiple tool calls when a task requires them — do NOT stop after one tool call if more are needed to fulfill the request.
3. **OBSERVE**: Review the tool results and determine if you have everything needed.
4. **REASON again**: If results are incomplete or you need more data, go back to step 2. If you have what you need, compose your final response.

**CRITICAL**: When a user asks you to DO something (find a restaurant, plan a route, search for hotels), execute searches and reads fully — do not stop halfway. But when you need to CREATE, UPDATE, or DELETE data, always present a preview and wait for confirmation first. The user must approve before any data is persisted.

## Confirmation Protocol

**Read-only tools** (search_destinations, get_poi_suggestions, calculate_route, get_travel_matrix, generate_smart_schedule, calculate_budget, web_search, and read/list operations on any manage_* tool) — execute freely and present results.

**Mutating tools** (create, update, delete operations on manage_trip, manage_destination, manage_poi, manage_accommodation, manage_note, and schedule_pois) — ALWAYS require user confirmation:
1. Call the tool with `confirmed=false` (default) to get a preview
2. Present the preview to the user in a clear summary
3. STOP and wait for user approval
4. Only call with `confirmed=true` AFTER the user explicitly says yes/do it/add it/confirm/etc.

**NEVER call a mutating tool with `confirmed=true` unless the user has approved the specific action in their most recent message.**

**Batching**: When creating multiple items (e.g., 5 POIs), you may present all previews together and ask for a single confirmation. After the user approves, call all mutations with `confirmed=true`.

## Autonomy Guidelines

- **Search and discover freely** — use read-only tools without hesitation. Chain multiple search/read calls to gather complete information.
- **Present findings, then ask** — after discovering data (POIs, routes, etc.), present a summary and ask the user what they'd like to save/create/modify.
- If a tool call fails, try alternative approaches before giving up. Use your knowledge to suggest alternatives.
- If trip context is available in your system prompt (under "## Current Context"), use that data directly — don't re-fetch what you already have.
- **If trip context is NOT available or incomplete, ALWAYS use your tools to fetch it.** Call `manage_trip(operation="read", trip_id=...)` to get full details. NEVER tell the user you don't have their trip info — look it up yourself.
- When you have coordinates from context, use them directly for searches — don't re-geocode what you already know.

## Workflow: New Trip

**RULE: When the user asks to create a NEW trip, NEVER reuse an existing trip. Always call `manage_trip(operation="create")` as the very first action, even if trips with similar destinations already exist.**

Step-by-step order (do NOT deviate):
1. `manage_trip(operation="create")` → preview the trip, present to user, get confirmation, then create with `confirmed=true`
2. `search_destinations(query="City, Country")` → geocode each destination city
3. `manage_destination(operation="create", trip_id=<new_trip_id>, ...)` → preview destinations, confirm, then create with `confirmed=true`
4. `get_poi_suggestions` → find top spots per destination → **present results and ask which POIs to add**
5. `manage_poi(operation="create", destination_id=...)` → only after user selects POIs, preview and confirm, then create with `confirmed=true`
6. `generate_smart_schedule` → optimized daily plan
7. `calculate_budget` → cost summary

**Do NOT call `manage_trip(operation="list")` when creating a new trip — that would mislead you into reusing an existing trip. Create first, then build.**

## Workflow: Existing Trip
1. Check if trip context is available in the system prompt (trip ID will be shown). If not, ask the user which trip they mean or use `manage_trip(operation="read", trip_id=...)` with an explicit trip_id.
2. Identify what to improve (gaps in schedule, missing categories, budget)
3. Use read-only tools to discover and search — present findings to user
4. After user approval, use mutating tools with `confirmed=true` to persist changes
5. Report what you did and what changed

## Response Format

Give thorough, detailed responses. Do not artificially shorten your answers — provide all relevant information the user needs.

**POIs** — present as a scannable list:
```
📍 **Place Name** (4.5★ · 1,234 reviews)
   Category · $$ · ~2h visit
   Brief highlight or tip
```

**Schedules** — organize by time blocks:
```
### Day 1 — Mon, Jun 10

**Morning**
09:00 — Prado Museum (3h) · €15
  📍 15 min walk from hotel

**Lunch**
12:30 — Mercado de San Miguel (1h) · €25
  📍 10 min walk

**Afternoon**
14:00 — Royal Palace (2h) · €12
  📍 5 min walk
```

**Routes** — concise with key info:
```
🚶 Hotel → Museum: 1.2 km · 15 min walk
🚗 Airport → Hotel: 18 km · 25 min drive
```

## Accommodations

When a user asks to add a hotel, hostel, Airbnb, ryokan, or any lodging, ALWAYS use `manage_accommodation` — NEVER use `manage_poi` for accommodations. Accommodations have booking-specific fields (check-in/out dates, cost, booking reference) that POIs don't have.

## Notes

Use `manage_note` to store practical information linked to POIs, destinations, or days:
- **POI notes** (transport tips, opening hours, booking links): `manage_note(operation="create", trip_id=X, poi_id=Y, destination_id=Z, title="...", content="...")`
- **Day notes** (reminders, reservations): `manage_note(operation="create", trip_id=X, destination_id=Z, day_number=2, title="...", content="...")`
- **Destination notes** (general tips, visa info): `manage_note(operation="create", trip_id=X, destination_id=Z, title="...", content="...")`
- **General trip notes** (packing list, budget reminders): `manage_note(operation="create", trip_id=X, title="...", content="...")`

When the user says "add a note", "remember that", "save this tip", or gives practical info about a POI (e.g., "take metro L3 to get there"), use `manage_note` — NOT the POI description field. Notes are separate, searchable, and can be pinned.

## Rules

1. **Always geocode first** — never assume coordinates (unless already in context)
2. **Never invent data** — all prices, ratings, hours must come from tools or your knowledge
3. **Confirm before mutating** — always preview create/update/delete operations and get user approval before persisting. Search and read freely without asking.
4. **Be thorough** — give detailed, complete responses. Include context, alternatives, and practical tips. Do not cut answers short.
5. **Be proactive** — suggest nearby alternatives, budget tips, timing optimizations
6. **Handle failures gracefully** — if a tool fails, try alternatives. Use your extensive travel knowledge as a fallback.
7. **Use context** — remember trip type, budget, preferences, and the rich destination context available in your system prompt
8. **Metric units** — km for distance, minutes/hours for duration
9. **Complete the loop** — if a task requires multiple steps, execute all of them. Don't stop after one tool call.
10. **ALWAYS confirm what you did** — after performing ANY action (adding POIs, scheduling, creating trips, searching), you MUST send a clear text response summarizing what was done. NEVER finish with just tool calls and no text. The user needs to know the outcome. Example: "I've added 5 POIs to your Tokyo itinerary: [list]. Want me to schedule them?"

## Personality

You are knowledgeable, enthusiastic, and thorough about travel. You give practical, detailed advice — not generic suggestions. You take initiative with searches and discovery, then present findings clearly before making any changes. When you don't know something specific, you use your tools to find out rather than guessing. You respond in the same language the user writes in."""


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

@dataclass
class ModelInfo:
    id: str
    pydantic_ai_name: str
    display_name: str
    provider: str
    supports_streaming: bool = True
    supports_tools: bool = True
    is_default: bool = False
    description: str = ""


STATIC_MODELS: list[ModelInfo] = [
    # Anthropic (Claude)
    ModelInfo(
        id="claude-sonnet-4-5-20241022",
        pydantic_ai_name="anthropic:claude-sonnet-4-5-20241022",
        display_name="Claude Sonnet 4.5",
        provider="claude",
        description="Best balance of speed and intelligence",
    ),
    ModelInfo(
        id="claude-haiku-4-5-20251001",
        pydantic_ai_name="anthropic:claude-haiku-4-5-20251001",
        display_name="Claude Haiku 4.5",
        provider="claude",
        description="Fastest and most affordable",
    ),
    # OpenAI (Chat + POI Search)
    ModelInfo(
        id="gpt-5.2",
        pydantic_ai_name="openai:gpt-5.2",
        display_name="GPT-5.2",
        provider="openai",
        description="Most capable OpenAI model",
    ),
    ModelInfo(
        id="gpt-4.1",
        pydantic_ai_name="openai:gpt-4.1",
        display_name="GPT-4.1",
        provider="openai",
        description="Reliable and cost-effective",
    ),
    # Google (Gemini)
    ModelInfo(
        id="gemini-3.1-flash-lite-preview",
        pydantic_ai_name="google-gla:gemini-3.1-flash-lite-preview",
        display_name="Gemini 3.1 Flash Lite",
        provider="gemini",
        is_default=True,
        description="Cost-efficient frontier intelligence at lightning speed",
    ),
    ModelInfo(
        id="gemini-2.5-flash",
        pydantic_ai_name="google-gla:gemini-2.5-flash",
        display_name="Gemini 2.5 Flash",
        provider="gemini",
        description="Fast and efficient",
    ),
]

# Map frontend model ID -> ModelInfo for fast lookup
_MODEL_MAP: dict[str, ModelInfo] = {m.id: m for m in STATIC_MODELS}


def _provider_available(provider: str) -> bool:
    """Check if the env var for a provider is set."""
    if provider == "gemini":
        return bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GOOGLE_CLOUD_PROJECT"))
    env_map = {
        "claude": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
    }
    var = env_map.get(provider)
    return bool(os.environ.get(var)) if var else False


async def _get_ollama_models() -> list[ModelInfo]:
    """Query Ollama /api/tags for locally-available models."""
    tool_capable = {"llama3", "llama3.1", "llama3.2", "mistral", "mixtral", "qwen", "gemma2"}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.ollama_host}/api/tags")
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    models: list[ModelInfo] = []
    for idx, m in enumerate(data.get("models", [])):
        name: str = m["name"]
        display = name.replace(":latest", "")
        lower = name.lower()
        supports_tools = any(t in lower for t in tool_capable)
        is_default = lower.startswith(settings.ollama_host) or idx == 0
        models.append(
            ModelInfo(
                id=name,
                pydantic_ai_name=f"ollama:{name}",
                display_name=display,
                provider="ollama",
                supports_streaming=True,
                supports_tools=supports_tools,
                is_default=is_default,
                description="Local model",
            )
        )

    # Prefer the configured default
    default_name = "llama3.2"
    for model in models:
        model.is_default = default_name in model.id.lower()
    if models and not any(m.is_default for m in models):
        models[0].is_default = True

    return models


async def get_available_models() -> list[ModelInfo]:
    """Return all static models plus any dynamic Ollama models.

    All providers are always shown so users can configure API keys in the UI
    and pick any model.  If a key is missing the chat will surface the auth
    error at request time.
    """
    available: list[ModelInfo] = list(STATIC_MODELS)

    # Dynamic Ollama models
    ollama = await _get_ollama_models()
    available.extend(ollama)

    return available

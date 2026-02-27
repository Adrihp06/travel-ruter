"""
OpenAI Web Search service for POI suggestions.

Uses OpenAI Responses API with the web_search_preview tool to find
tourist points of interest. Returns both results and source URLs.
"""

import json
import logging
from typing import Any

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

OPENAI_SEARCH_SYSTEM_PROMPT = """You are a travel expert searching for tourist points of interest using live web data. Search for real places that exist. For each place return:
- name: exact name as it appears on Google Maps
- description: 1-2 sentence practical description
- category: one of [Sights, Museums, Food, Nature, Entertainment, Shopping, Viewpoints]
- latitude: as precise as possible
- longitude: as precise as possible
- estimated_cost_usd: approximate entry fee or meal cost (number or null)
- dwell_time_minutes: recommended visit duration in minutes
- why_visit: brief reason this place is worth visiting
- address: street address if known

Only return places you are confident exist. Prefer highly-rated, tourist-relevant venues. Respond ONLY with valid JSON matching this exact schema — no markdown, no preamble."""

POI_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "places": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["Sights", "Museums", "Food", "Nature", "Entertainment", "Shopping", "Viewpoints"],
                    },
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "estimated_cost_usd": {"type": ["number", "null"]},
                    "dwell_time_minutes": {"type": "integer"},
                    "why_visit": {"type": "string"},
                    "address": {"type": ["string", "null"]},
                },
                "required": ["name", "description", "category", "latitude", "longitude"],
            },
        }
    },
    "required": ["places"],
}


class OpenAISearchService:
    """POI search using OpenAI Responses API with web_search_preview."""

    def __init__(self, api_key: str = "", model: str = "gpt-4o-search-preview"):
        self.api_key = api_key
        self.model = model
        self._has_api_key = bool(api_key)
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def search_pois(
        self,
        latitude: float,
        longitude: float,
        location_name: str,
        category: str | None = None,
        trip_type: str | None = None,
        max_results: int = 10,
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """Search for POIs using OpenAI web search.

        Returns:
            Tuple of (places list, source URLs list).
        """
        if not self._has_api_key or not self._client:
            return [], []

        # Build search query
        parts = []
        if category:
            parts.append(f"Best {category} places")
        else:
            parts.append("Best tourist attractions and points of interest")
        parts.append(f"near {location_name} (coordinates: {latitude}, {longitude})")
        if trip_type:
            parts.append(f"for {trip_type} travelers")
        parts.append(f"Return up to {max_results} results as JSON.")
        query = " ".join(parts)

        response = await self._client.responses.create(
            model=self.model,
            instructions=OPENAI_SEARCH_SYSTEM_PROMPT,
            tools=[{"type": "web_search_preview"}],
            input=query,
        )

        # Extract text content and source URLs from output items
        text_content = ""
        source_urls: list[str] = []

        for item in response.output:
            if item.type == "message":
                for content_part in item.content:
                    if content_part.type == "output_text":
                        text_content = content_part.text
                        for annotation in getattr(content_part, "annotations", []):
                            if annotation.type == "url_citation":
                                url = getattr(annotation, "url", None)
                                if url and url not in source_urls:
                                    source_urls.append(url)

        if not text_content:
            logger.warning("Empty response from OpenAI search")
            return [], source_urls

        # Strip markdown code fences if the model wrapped the JSON
        stripped = text_content.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            stripped = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            logger.error("Failed to parse OpenAI search JSON response: %s", stripped[:200])
            return [], source_urls

        places = parsed.get("places", [])
        logger.info("OpenAI search returned %d POI suggestions, %d sources", len(places), len(source_urls))
        return places[:max_results], source_urls

"""
Perplexity AI service for POI suggestions.

Uses Perplexity's sonar model with structured JSON output to find
tourist points of interest. Serves as primary search before falling
back to Google Places.
"""

import json
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

PERPLEXITY_SYSTEM_PROMPT = """You are a travel expert searching for tourist points of interest. Search for real places that exist on Google Maps. For each place return:
- name: exact name as it appears on Google Maps
- description: 1-2 sentence practical description
- category: one of [Sights, Museums, Food, Nature, Entertainment, Shopping, Viewpoints]
- latitude: as precise as possible
- longitude: as precise as possible
- estimated_cost_usd: approximate entry fee or meal cost (number or null)
- dwell_time_minutes: recommended visit duration in minutes
- why_visit: brief reason this place is worth visiting
- address: street address if known

Only return places you are confident exist on Google Maps. Prefer highly-rated, tourist-relevant venues."""

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
                    "category": {"type": "string", "enum": ["Sights", "Museums", "Food", "Nature", "Entertainment", "Shopping", "Viewpoints"]},
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


class PerplexitySearchService:
    """POI search using Perplexity AI's sonar model."""

    API_URL = "https://api.perplexity.ai/chat/completions"

    def __init__(self, api_key: str = "", model: str = "sonar"):
        self.api_key = api_key
        self.model = model
        self._has_api_key = bool(api_key)

    async def search_pois(
        self,
        latitude: float,
        longitude: float,
        location_name: str,
        category: str | None = None,
        trip_type: str | None = None,
        max_results: int = 10,
    ) -> list[dict[str, Any]]:
        """Search for POIs using Perplexity AI.

        Args:
            latitude: Center latitude
            longitude: Center longitude
            location_name: Human-readable location name
            category: Optional category filter
            trip_type: Optional trip type for curation
            max_results: Maximum results to return

        Returns:
            List of POI dicts with name, category, lat, lng, etc.
        """
        if not self._has_api_key:
            return []

        # Build search query
        parts = []
        if category:
            parts.append(f"Best {category} places")
        else:
            parts.append("Best tourist attractions and points of interest")
        parts.append(f"near {location_name} (coordinates: {latitude}, {longitude})")
        if trip_type:
            parts.append(f"for {trip_type} travelers")
        parts.append(f"Return up to {max_results} results.")
        query = " ".join(parts)

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": PERPLEXITY_SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            "max_tokens": 4096,
            "temperature": 0.1,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "poi_results",
                    "schema": POI_JSON_SCHEMA,
                },
            },
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        # Extract content from response
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            logger.warning("Empty response from Perplexity")
            return []

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            logger.error("Failed to parse Perplexity JSON response: %s", content[:200])
            return []

        places = parsed.get("places", [])
        logger.info("Perplexity returned %d POI suggestions", len(places))
        return places[:max_results]

import httpx
from typing import List, Optional
from app.core.config import settings
from app.schemas.google_maps_places import (
    GooglePlacesAutocompleteResult,
    GooglePlacesDetailResult
)

class GooglePlacesService:
    """Service for interacting with Google Places API."""
    
    AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'GOOGLE_MAPS_API_KEY', None)
        self._has_api_key = bool(self.api_key)

    async def autocomplete(
        self,
        query: str,
        location: Optional[str] = None,
        radius: Optional[int] = None,
        types: Optional[str] = None
    ) -> List[GooglePlacesAutocompleteResult]:
        """
        Search for places using Google Places Autocomplete.
        """
        if not self._has_api_key:
            return []

        params = {
            "input": query,
            "key": self.api_key,
            "language": "en"
        }
        
        if location:
            params["location"] = location
        if radius:
            params["radius"] = radius
        if types:
            params["types"] = types

        async with httpx.AsyncClient() as client:
            response = await client.get(self.AUTOCOMPLETE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for prediction in data.get("predictions", []):
                results.append(GooglePlacesAutocompleteResult(
                    place_id=prediction["place_id"],
                    description=prediction["description"],
                    main_text=prediction["structured_formatting"]["main_text"],
                    secondary_text=prediction["structured_formatting"].get("secondary_text", ""),
                    types=prediction.get("types", [])
                ))
            return results

    async def get_details(self, place_id: str) -> Optional[GooglePlacesDetailResult]:
        """
        Get detailed information for a specific place.
        """
        if not self._has_api_key:
            return None

        params = {
            "place_id": place_id,
            "key": self.api_key,
            "fields": "name,formatted_address,geometry,rating,user_ratings_total,type,website,international_phone_number,price_level,business_status",
            "language": "en"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(self.DETAILS_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            result = data.get("result")
            if not result:
                return None
            
            location = result.get("geometry", {}).get("location", {})
            
            return GooglePlacesDetailResult(
                place_id=place_id,
                name=result.get("name"),
                formatted_address=result.get("formatted_address"),
                latitude=location.get("lat"),
                longitude=location.get("lng"),
                rating=result.get("rating"),
                user_ratings_total=result.get("user_ratings_total"),
                types=result.get("types", []),
                website=result.get("website"),
                phone_number=result.get("international_phone_number"),
                price_level=result.get("price_level"),
                business_status=result.get("business_status")
            )

# Singleton instance
google_places_service = GooglePlacesService()

"""
Google Places API service for POI suggestions and quick search.

This service integrates with Google Places API to fetch nearby attractions,
restaurants, and other points of interest based on destination coordinates,
as well as autocomplete search functionality.
"""

import logging
import httpx

logger = logging.getLogger(__name__)
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.schemas.google_maps_places import (
    GooglePlacesAutocompleteResult,
    GooglePlacesDetailResult
)


class GooglePlacesService:
    """Service for fetching POI suggestions and search from Google Places API"""

    PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"
    NEARBY_SEARCH_ENDPOINT = f"{PLACES_API_BASE}/nearbysearch/json"
    PLACE_DETAILS_ENDPOINT = f"{PLACES_API_BASE}/details/json"
    PHOTO_ENDPOINT = f"{PLACES_API_BASE}/photo"
    AUTOCOMPLETE_URL = f"{PLACES_API_BASE}/autocomplete/json"
    DETAILS_URL = f"{PLACES_API_BASE}/details/json"

    # Mapping Google place types to application categories
    CATEGORY_MAPPING = {
        # Sights & Landmarks
        "tourist_attraction": "Sights",
        "point_of_interest": "Sights",
        "church": "Sights",
        "hindu_temple": "Sights",
        "mosque": "Sights",
        "synagogue": "Sights",
        "landmark": "Sights",
        "place_of_worship": "Sights",

        # Museums & Culture
        "museum": "Museums",
        "art_gallery": "Museums",
        "library": "Museums",

        # Food & Dining
        "restaurant": "Food",
        "cafe": "Food",
        "bar": "Food",
        "food": "Food",
        "meal_takeaway": "Food",
        "bakery": "Food",

        # Nature & Outdoors
        "park": "Nature",
        "natural_feature": "Nature",
        "campground": "Nature",
        "rv_park": "Nature",

        # Entertainment
        "night_club": "Entertainment",
        "movie_theater": "Entertainment",
        "amusement_park": "Entertainment",
        "aquarium": "Entertainment",
        "zoo": "Entertainment",
        "bowling_alley": "Entertainment",

        # Shopping
        "shopping_mall": "Shopping",
        "store": "Shopping",
        "clothing_store": "Shopping",
        "jewelry_store": "Shopping",
        "book_store": "Shopping",

        # Viewpoints & Photography
        "observation_deck": "Viewpoints",

        # Accommodation
        "lodging": "Accommodation",
        "hotel": "Accommodation",

        # Activities
        "gym": "Activity",
        "spa": "Activity",
        "stadium": "Activity",
    }

    # Trip type to Google place types mapping
    TRIP_TYPE_FILTERS = {
        "romantic": ["restaurant", "bar", "spa", "park", "cafe"],
        "adventure": ["park", "natural_feature", "campground", "tourist_attraction"],
        "family": ["amusement_park", "zoo", "aquarium", "park", "museum"],
        "cultural": ["museum", "art_gallery", "church", "landmark", "library"],
        "food": ["restaurant", "cafe", "bar", "bakery"],
        "nature": ["park", "natural_feature", "campground"],
        "shopping": ["shopping_mall", "store", "market"],
    }

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'GOOGLE_MAPS_API_KEY', None)
        self._has_api_key = bool(self.api_key)

    # ==================== Quick Search / Autocomplete Methods ====================

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
        Get detailed information for a specific place (for autocomplete results).
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

    # ==================== POI Suggestions Methods (Static) ====================

    @staticmethod
    def get_category_from_types(google_types: List[str]) -> str:
        """
        Map Google place types to application category.
        Returns the first matching category or 'Sights' as default.
        """
        for place_type in google_types:
            if place_type in GooglePlacesService.CATEGORY_MAPPING:
                return GooglePlacesService.CATEGORY_MAPPING[place_type]
        return "Sights"  # Default category

    @staticmethod
    def get_place_types_for_trip_type(trip_type: Optional[str]) -> Optional[List[str]]:
        """Get Google place types for a specific trip type filter."""
        if not trip_type:
            return None
        return GooglePlacesService.TRIP_TYPE_FILTERS.get(trip_type.lower())

    @staticmethod
    async def search_nearby_places(
        latitude: float,
        longitude: float,
        radius: int = 5000,  # meters (default 5km)
        place_type: Optional[str] = None,
        keyword: Optional[str] = None,
        min_rating: Optional[float] = None,
        max_results: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for nearby places using Google Places API Nearby Search.

        Args:
            latitude: Center point latitude
            longitude: Center point longitude
            radius: Search radius in meters (max 50000)
            place_type: Google place type filter (e.g., 'restaurant', 'museum')
            keyword: Keyword filter for search
            min_rating: Minimum rating filter (0-5)
            max_results: Maximum number of results to return

        Returns:
            List of place dictionaries with POI data
        """
        if not settings.GOOGLE_MAPS_API_KEY:
            raise ValueError("Google Maps API key not configured")

        params = {
            "location": f"{latitude},{longitude}",
            "radius": min(radius, 50000),  # Google API max is 50km
            "key": settings.GOOGLE_MAPS_API_KEY,
        }

        if place_type:
            params["type"] = place_type

        if keyword:
            params["keyword"] = keyword

        # Make API request
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                GooglePlacesService.NEARBY_SEARCH_ENDPOINT,
                params=params
            )
            response.raise_for_status()
            data = response.json()

        if data.get("status") != "OK":
            error_msg = data.get("error_message", data.get("status"))
            raise Exception(f"Google Places API error: {error_msg}")

        results = data.get("results", [])

        # Filter by minimum rating if specified
        if min_rating is not None:
            results = [r for r in results if r.get("rating", 0) >= min_rating]

        # Limit results
        results = results[:max_results]

        # Transform to our POI format
        pois = []
        for place in results:
            geometry = place.get("geometry", {})
            location = geometry.get("location", {})

            poi_data = {
                "name": place.get("name"),
                "category": GooglePlacesService.get_category_from_types(
                    place.get("types", [])
                ),
                "address": place.get("vicinity"),
                "latitude": location.get("lat"),
                "longitude": location.get("lng"),
                "external_id": place.get("place_id"),
                "external_source": "google_places",
                "metadata_json": {
                    "rating": place.get("rating"),
                    "user_ratings_total": place.get("user_ratings_total"),
                    "price_level": place.get("price_level"),
                    "types": place.get("types", []),
                    "photos": [
                        {
                            "photo_reference": photo.get("photo_reference"),
                            "width": photo.get("width"),
                            "height": photo.get("height"),
                        }
                        for photo in place.get("photos", [])[:3]  # Limit to 3 photos
                    ] if place.get("photos") else [],
                    "business_status": place.get("business_status"),
                    "opening_hours": {
                        "open_now": place.get("opening_hours", {}).get("open_now")
                    } if place.get("opening_hours") else None,
                },
            }
            pois.append(poi_data)

        return pois

    @staticmethod
    async def get_place_details_for_poi(place_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific place for POI suggestions.

        Args:
            place_id: Google Place ID

        Returns:
            Dictionary with detailed place information
        """
        if not settings.GOOGLE_MAPS_API_KEY:
            raise ValueError("Google Maps API key not configured")

        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,geometry,rating,user_ratings_total,"
                     "price_level,website,formatted_phone_number,opening_hours,"
                     "photos,reviews,types,url",
            "key": settings.GOOGLE_MAPS_API_KEY,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                GooglePlacesService.PLACE_DETAILS_ENDPOINT,
                params=params
            )
            response.raise_for_status()
            data = response.json()

        if data.get("status") != "OK":
            error_msg = data.get("error_message", data.get("status"))
            raise Exception(f"Google Places API error: {error_msg}")

        return data.get("result", {})

    @staticmethod
    def get_photo_url(
        photo_reference: str,
        max_width: int = 400,
    ) -> str:
        """
        Generate a Google Places photo URL.

        Args:
            photo_reference: Photo reference from Places API
            max_width: Maximum width of the photo (max 1600)

        Returns:
            URL to fetch the photo
        """
        if not settings.GOOGLE_MAPS_API_KEY:
            raise ValueError("Google Maps API key not configured")

        params = {
            "photo_reference": photo_reference,
            "maxwidth": min(max_width, 1600),
            "key": settings.GOOGLE_MAPS_API_KEY,
        }

        # Return the URL (client will fetch the actual image)
        from urllib.parse import urlencode
        return f"{GooglePlacesService.PHOTO_ENDPOINT}?{urlencode(params)}"

    @staticmethod
    async def get_suggestions_for_destination(
        latitude: float,
        longitude: float,
        radius: int = 5000,
        category_filter: Optional[str] = None,
        trip_type: Optional[str] = None,
        max_results: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get POI suggestions for a destination.

        This is the main method to use for fetching suggestions.
        It handles category filtering and trip type filtering.

        Args:
            latitude: Destination latitude
            longitude: Destination longitude
            radius: Search radius in meters
            category_filter: Filter by app category (e.g., 'Food', 'Museums')
            trip_type: Filter by trip type (e.g., 'romantic', 'adventure')
            max_results: Maximum number of results

        Returns:
            List of suggested POIs
        """
        # If category filter is provided, use corresponding Google types
        place_types = None
        if category_filter:
            # Reverse lookup: find Google types for this category
            place_types = [
                ptype for ptype, cat in GooglePlacesService.CATEGORY_MAPPING.items()
                if cat == category_filter
            ]
        elif trip_type:
            # Use trip type filter
            place_types = GooglePlacesService.get_place_types_for_trip_type(trip_type)

        # If we have multiple types, we need to make multiple requests
        # and combine results (Google API only accepts one type at a time)
        all_suggestions = []
        seen_place_ids = set()

        if place_types:
            for place_type in place_types[:3]:  # Limit to 3 types to avoid too many requests
                try:
                    suggestions = await GooglePlacesService.search_nearby_places(
                        latitude=latitude,
                        longitude=longitude,
                        radius=radius,
                        place_type=place_type,
                        max_results=10,
                    )

                    # Deduplicate by place_id
                    for suggestion in suggestions:
                        place_id = suggestion.get("external_id")
                        if place_id and place_id not in seen_place_ids:
                            seen_place_ids.add(place_id)
                            all_suggestions.append(suggestion)
                except Exception as e:
                    # Log error but continue with other types
                    logger.warning(f"Error fetching suggestions for type {place_type}: {e}")
                    continue
        else:
            # No specific type, get general tourist attractions
            all_suggestions = await GooglePlacesService.search_nearby_places(
                latitude=latitude,
                longitude=longitude,
                radius=radius,
                place_type="tourist_attraction",
                max_results=max_results,
            )

        # Sort by rating (descending) and limit results
        all_suggestions.sort(
            key=lambda x: (
                x.get("metadata_json", {}).get("rating") or 0,
                x.get("metadata_json", {}).get("user_ratings_total") or 0
            ),
            reverse=True
        )

        return all_suggestions[:max_results]


# Singleton instance for autocomplete/quick search
google_places_service = GooglePlacesService()

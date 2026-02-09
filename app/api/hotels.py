"""
Hotels API - Hotel search and discovery endpoints.

Provides:
- GET /hotels/search - Search hotels by city code or coordinates (Amadeus)
- GET /hotels/{hotel_id}/offers - Get detailed offers for a hotel (Amadeus)
- GET /hotels/discover - Discover hotels near coordinates (Google Places)
- GET /hotels/discover/{place_id} - Get hotel details (Google Places)
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query

from app.services.amadeus_service import search_hotels, get_hotel_offers
from app.services.google_places_service import GooglePlacesService
from app.schemas.hotel_search import (
    HotelPhoto,
    HotelSearchResult,
    HotelSearchResponse,
    HotelReview,
    HotelDetailResult,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Google Places Discovery Endpoints ====================


@router.get("/hotels/discover", response_model=HotelSearchResponse)
async def discover_hotels(
    latitude: float = Query(..., description="Center latitude"),
    longitude: float = Query(..., description="Center longitude"),
    radius: int = Query(5000, ge=500, le=50000, description="Search radius in meters"),
    keyword: Optional[str] = Query(None, description="Keyword filter (e.g. 'luxury', 'ryokan')"),
    max_results: int = Query(20, ge=1, le=50),
):
    """Discover hotels near coordinates using Google Places API."""
    try:
        places = await GooglePlacesService.search_nearby_places(
            latitude=latitude,
            longitude=longitude,
            radius=radius,
            place_type="lodging",
            keyword=keyword,
            max_results=max_results,
        )

        results = []
        for place in places:
            metadata = place.get("metadata_json", {})

            # Resolve photo references to full URLs
            photos = []
            for photo in metadata.get("photos", []):
                ref = photo.get("photo_reference")
                if ref:
                    photos.append(HotelPhoto(
                        url=GooglePlacesService.get_photo_url(ref, max_width=400),
                        width=photo.get("width"),
                        height=photo.get("height"),
                    ))

            results.append(HotelSearchResult(
                place_id=place.get("external_id", ""),
                name=place.get("name", "Unknown"),
                address=place.get("address"),
                latitude=place.get("latitude"),
                longitude=place.get("longitude"),
                rating=metadata.get("rating"),
                user_ratings_total=metadata.get("user_ratings_total"),
                photos=photos,
                types=metadata.get("types", []),
            ))

        return HotelSearchResponse(results=results, total=len(results))

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Hotel discover error: {e}")
        raise HTTPException(status_code=502, detail=f"Hotel discovery error: {str(e)}")


@router.get("/hotels/discover/{place_id}", response_model=HotelDetailResult)
async def get_hotel_details(place_id: str):
    """Get detailed hotel information from Google Places API."""
    try:
        result = await GooglePlacesService.get_place_details_for_poi(place_id)

        if not result:
            raise HTTPException(status_code=404, detail="Hotel not found")

        location = result.get("geometry", {}).get("location", {})

        # Resolve photo references to full URLs (up to 10)
        photos = []
        for photo in result.get("photos", [])[:10]:
            ref = photo.get("photo_reference")
            if ref:
                photos.append(HotelPhoto(
                    url=GooglePlacesService.get_photo_url(ref, max_width=800),
                    width=photo.get("width"),
                    height=photo.get("height"),
                ))

        # Extract reviews
        reviews = []
        for review in result.get("reviews", []):
            reviews.append(HotelReview(
                author_name=review.get("author_name"),
                rating=review.get("rating"),
                text=review.get("text"),
                relative_time_description=review.get("relative_time_description"),
            ))

        # Extract opening hours
        opening_hours = None
        if result.get("opening_hours", {}).get("weekday_text"):
            opening_hours = result["opening_hours"]["weekday_text"]

        return HotelDetailResult(
            place_id=place_id,
            name=result.get("name", "Unknown"),
            address=result.get("vicinity") or result.get("formatted_address"),
            formatted_address=result.get("formatted_address"),
            latitude=location.get("lat"),
            longitude=location.get("lng"),
            rating=result.get("rating"),
            user_ratings_total=result.get("user_ratings_total"),
            photos=photos,
            types=result.get("types", []),
            website=result.get("website"),
            phone_number=result.get("formatted_phone_number"),
            google_maps_url=result.get("url"),
            reviews=reviews,
            opening_hours=opening_hours,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Hotel detail error: {e}")
        raise HTTPException(status_code=502, detail=f"Hotel detail error: {str(e)}")


# ==================== Amadeus Endpoints (legacy) ====================


@router.get("/hotels/search")
async def search_hotels_endpoint(
    checkInDate: str = Query(..., description="Check-in date (YYYY-MM-DD)"),
    checkOutDate: str = Query(..., description="Check-out date (YYYY-MM-DD)"),
    adults: int = Query(2, ge=1, le=9),
    roomQuantity: int = Query(1, ge=1, le=9),
    currency: str = Query("USD"),
    cityCode: Optional[str] = Query(None, description="IATA city code (e.g. PAR, LON, TYO)"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius: int = Query(30, ge=1, le=300),
    radiusUnit: str = Query("KM"),
    priceMin: Optional[float] = Query(None),
    priceMax: Optional[float] = Query(None),
    ratings: Optional[str] = Query(None, description="Comma-separated star ratings (e.g. 3,4,5)"),
):
    """Search hotels via Amadeus API by city code or coordinates."""
    if not cityCode and (latitude is None or longitude is None):
        raise HTTPException(
            status_code=400,
            detail="Either cityCode or both latitude and longitude are required",
        )

    try:
        results = await search_hotels(
            city_code=cityCode,
            latitude=latitude,
            longitude=longitude,
            radius=radius,
            radius_unit=radiusUnit,
            check_in_date=checkInDate,
            check_out_date=checkOutDate,
            adults=adults,
            room_quantity=roomQuantity,
            currency=currency,
            price_min=priceMin,
            price_max=priceMax,
            ratings=ratings,
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hotel search service error: {str(e)}")


@router.get("/hotels/{hotel_id}/offers")
async def get_hotel_offers_endpoint(
    hotel_id: str,
    checkInDate: str = Query(..., description="Check-in date (YYYY-MM-DD)"),
    checkOutDate: str = Query(..., description="Check-out date (YYYY-MM-DD)"),
    adults: int = Query(2, ge=1, le=9),
    roomQuantity: int = Query(1, ge=1, le=9),
):
    """Get detailed room offers for a specific hotel."""
    try:
        offers = await get_hotel_offers(
            hotel_id,
            check_in_date=checkInDate,
            check_out_date=checkOutDate,
            adults=adults,
            room_quantity=roomQuantity,
        )
        return offers
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hotel offers service error: {str(e)}")

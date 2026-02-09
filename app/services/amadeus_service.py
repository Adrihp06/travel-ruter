"""
Amadeus API Service - Hotel search integration.

Uses Amadeus Self-Service APIs:
- Hotel List API (v1) - Search hotels by city code or geo coordinates
- Hotel Search API (v3) - Get hotel offers with pricing

Docs: https://developers.amadeus.com/self-service/category/hotels
"""

import time
import logging
from typing import Optional
from app.core.config import settings
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

# Token cache
_token: Optional[str] = None
_token_expires_at: float = 0


async def _get_access_token() -> str:
    """Get or refresh Amadeus OAuth2 access token."""
    global _token, _token_expires_at

    if _token and time.time() < _token_expires_at - 60:
        return _token

    if not settings.AMADEUS_CLIENT_ID or not settings.AMADEUS_CLIENT_SECRET:
        raise ValueError(
            "Amadeus API credentials not configured. "
            "Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET environment variables."
        )

    client = await get_http_client()
    response = await client.post(
        f"{settings.AMADEUS_BASE_URL}/v1/security/oauth2/token",
        data={
            "grant_type": "client_credentials",
            "client_id": settings.AMADEUS_CLIENT_ID,
            "client_secret": settings.AMADEUS_CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    if response.status_code != 200:
        logger.error("Amadeus auth failed: %s %s", response.status_code, response.text)
        raise ValueError(f"Amadeus authentication failed: {response.status_code}")

    data = response.json()
    _token = data["access_token"]
    _token_expires_at = time.time() + data.get("expires_in", 1799)
    return _token


async def search_hotels(
    *,
    city_code: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: int = 30,
    radius_unit: str = "KM",
    check_in_date: str,
    check_out_date: str,
    adults: int = 2,
    room_quantity: int = 1,
    currency: str = "USD",
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    ratings: Optional[str] = None,
) -> list[dict]:
    """
    Search hotels using Amadeus Hotel List + Hotel Search APIs.

    Step 1: Get hotel IDs by city code or coordinates (Hotel List API v1)
    Step 2: Get offers for those hotels (Hotel Search API v3)
    """
    token = await _get_access_token()
    client = await get_http_client()
    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: Get hotel IDs
    list_params = {}
    if city_code:
        list_params["cityCode"] = city_code
    elif latitude is not None and longitude is not None:
        list_params["latitude"] = latitude
        list_params["longitude"] = longitude
        list_params["radius"] = radius
        list_params["radiusUnit"] = radius_unit
    else:
        raise ValueError("Either cityCode or latitude/longitude is required")

    if ratings:
        list_params["ratings"] = ratings

    list_response = await client.get(
        f"{settings.AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-city"
        if city_code
        else f"{settings.AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-geocode",
        params=list_params,
        headers=headers,
    )

    if list_response.status_code != 200:
        logger.error("Amadeus hotel list failed: %s %s", list_response.status_code, list_response.text)
        error_detail = "Failed to search hotels"
        try:
            err_data = list_response.json()
            if "errors" in err_data:
                error_detail = err_data["errors"][0].get("detail", error_detail)
        except Exception:
            pass
        raise ValueError(error_detail)

    hotels_data = list_response.json().get("data", [])
    if not hotels_data:
        return []

    # Take first 20 hotel IDs for offers search (API limit)
    hotel_ids = [h["hotelId"] for h in hotels_data[:20]]

    # Step 2: Get offers for those hotels
    offer_params = {
        "hotelIds": ",".join(hotel_ids),
        "checkInDate": check_in_date,
        "checkOutDate": check_out_date,
        "adults": adults,
        "roomQuantity": room_quantity,
        "currency": currency,
    }

    if price_min is not None:
        offer_params["priceRange"] = f"{int(price_min)}-{int(price_max or 10000)}"

    offers_response = await client.get(
        f"{settings.AMADEUS_BASE_URL}/v3/shopping/hotel-offers",
        params=offer_params,
        headers=headers,
    )

    if offers_response.status_code != 200:
        logger.warning("Amadeus hotel offers failed: %s", offers_response.status_code)
        # Return hotels without offers rather than failing entirely
        return [_format_hotel(h) for h in hotels_data[:20]]

    offers_data = offers_response.json().get("data", [])

    # Merge hotel info with offers
    hotel_info_map = {h["hotelId"]: h for h in hotels_data}
    results = []
    for offer in offers_data:
        hotel_id = offer.get("hotel", {}).get("hotelId", "")
        hotel_info = hotel_info_map.get(hotel_id, {})
        results.append(_format_hotel_with_offer(hotel_info, offer))

    return results


async def get_hotel_offers(
    hotel_id: str,
    *,
    check_in_date: str,
    check_out_date: str,
    adults: int = 2,
    room_quantity: int = 1,
) -> list[dict]:
    """Get detailed offers for a specific hotel."""
    token = await _get_access_token()
    client = await get_http_client()

    response = await client.get(
        f"{settings.AMADEUS_BASE_URL}/v3/shopping/hotel-offers",
        params={
            "hotelIds": hotel_id,
            "checkInDate": check_in_date,
            "checkOutDate": check_out_date,
            "adults": adults,
            "roomQuantity": room_quantity,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    if response.status_code != 200:
        logger.error("Amadeus hotel offers failed: %s %s", response.status_code, response.text)
        raise ValueError("Failed to get hotel offers")

    data = response.json().get("data", [])
    if not data:
        return []

    # Return offers from the first matching hotel
    hotel_data = data[0]
    return [
        {
            "id": offer.get("id"),
            "roomType": offer.get("room", {}).get("type"),
            "roomDescription": offer.get("room", {}).get("description", {}).get("text"),
            "bedType": offer.get("room", {}).get("typeEstimated", {}).get("bedType"),
            "beds": offer.get("room", {}).get("typeEstimated", {}).get("beds"),
            "price": offer.get("price", {}),
            "checkInDate": offer.get("checkInDate"),
            "checkOutDate": offer.get("checkOutDate"),
            "cancellation": offer.get("policies", {}).get("cancellations", [{}])[0] if offer.get("policies", {}).get("cancellations") else None,
            "boardType": offer.get("boardType"),
        }
        for offer in hotel_data.get("offers", [])
    ]


def _format_hotel(hotel: dict) -> dict:
    """Format hotel list data into a consistent response."""
    geo = hotel.get("geoCode", {})
    return {
        "hotelId": hotel.get("hotelId"),
        "name": hotel.get("name", "Unknown Hotel"),
        "latitude": geo.get("latitude"),
        "longitude": geo.get("longitude"),
        "address": hotel.get("address", {}),
        "distance": hotel.get("distance", {}),
        "rating": hotel.get("rating"),
        "amenities": hotel.get("amenities", []),
        "offers": [],
        "minPrice": None,
    }


def _format_hotel_with_offer(hotel_info: dict, offer_data: dict) -> dict:
    """Format hotel with offer data into a consistent response."""
    hotel = offer_data.get("hotel", {})
    offers = offer_data.get("offers", [])
    geo = hotel_info.get("geoCode", {}) or {}

    min_price = None
    if offers:
        prices = [float(o.get("price", {}).get("total", 0)) for o in offers if o.get("price", {}).get("total")]
        min_price = min(prices) if prices else None

    return {
        "hotelId": hotel.get("hotelId"),
        "name": hotel.get("name", hotel_info.get("name", "Unknown Hotel")),
        "hotelRating": hotel.get("rating"),
        "latitude": hotel.get("latitude") or geo.get("latitude"),
        "longitude": hotel.get("longitude") or geo.get("longitude"),
        "address": hotel_info.get("address", {}),
        "amenities": hotel_info.get("amenities", []),
        "offers": [
            {
                "id": o.get("id"),
                "price": o.get("price", {}),
                "room": o.get("room", {}),
                "boardType": o.get("boardType"),
            }
            for o in offers
        ],
        "minPrice": min_price,
    }

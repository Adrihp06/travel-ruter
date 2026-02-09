"""
Schemas for hotel discovery via Google Places API.
"""

from typing import List, Optional
from pydantic import BaseModel


class HotelPhoto(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None


class HotelSearchResult(BaseModel):
    place_id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    photos: List[HotelPhoto] = []
    types: List[str] = []


class HotelSearchResponse(BaseModel):
    results: List[HotelSearchResult]
    total: int


class HotelReview(BaseModel):
    author_name: Optional[str] = None
    rating: Optional[float] = None
    text: Optional[str] = None
    relative_time_description: Optional[str] = None


class HotelDetailResult(BaseModel):
    place_id: str
    name: str
    address: Optional[str] = None
    formatted_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    photos: List[HotelPhoto] = []
    types: List[str] = []
    website: Optional[str] = None
    phone_number: Optional[str] = None
    google_maps_url: Optional[str] = None
    reviews: List[HotelReview] = []
    opening_hours: Optional[List[str]] = None

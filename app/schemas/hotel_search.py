"""
Schemas for hotel discovery via Google Places API.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class HotelPhoto(BaseModel):
    url: str = Field(..., max_length=2000)
    width: Optional[int] = None
    height: Optional[int] = None


class HotelSearchResult(BaseModel):
    place_id: str
    name: str = Field(..., max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    photos: List[HotelPhoto] = []
    types: List[str] = []


class HotelSearchResponse(BaseModel):
    results: List[HotelSearchResult]
    total: int


class HotelReview(BaseModel):
    author_name: Optional[str] = Field(None, max_length=255)
    rating: Optional[float] = None
    text: Optional[str] = Field(None, max_length=10000)
    relative_time_description: Optional[str] = None


class HotelDetailResult(BaseModel):
    place_id: str
    name: str = Field(..., max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    formatted_address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    photos: List[HotelPhoto] = []
    types: List[str] = []
    website: Optional[str] = Field(None, max_length=2000)
    phone_number: Optional[str] = None
    google_maps_url: Optional[str] = Field(None, max_length=2000)
    reviews: List[HotelReview] = []
    opening_hours: Optional[List[str]] = None

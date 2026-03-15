from typing import List, Optional
from pydantic import BaseModel, Field

class GooglePlacesAutocompleteResult(BaseModel):
    place_id: str
    description: str = Field(..., max_length=10000)
    main_text: str = Field(..., max_length=255)
    secondary_text: str = Field(..., max_length=500)
    types: List[str]

class GooglePlacesDetailResult(BaseModel):
    place_id: str
    name: str = Field(..., max_length=255)
    formatted_address: Optional[str] = Field(None, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    types: List[str]
    website: Optional[str] = Field(None, max_length=2000)
    phone_number: Optional[str] = None
    price_level: Optional[int] = None
    business_status: Optional[str] = None

class GooglePlacesPhotoUrlResponse(BaseModel):
    url: str = Field(..., max_length=2000)
    photo_reference: str

class GooglePlacesPhotosResponse(BaseModel):
    photos: List[GooglePlacesPhotoUrlResponse]
    place_id: str

class GooglePlacesSearchResponse(BaseModel):
    results: List[GooglePlacesAutocompleteResult]

from typing import List, Optional
from pydantic import BaseModel, Field

class GooglePlacesAutocompleteResult(BaseModel):
    place_id: str
    description: str
    main_text: str
    secondary_text: str
    types: List[str]

class GooglePlacesDetailResult(BaseModel):
    place_id: str
    name: str
    formatted_address: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    types: List[str]
    website: Optional[str] = None
    phone_number: Optional[str] = None
    price_level: Optional[int] = None
    business_status: Optional[str] = None

class GooglePlacesPhotoUrlResponse(BaseModel):
    url: str
    photo_reference: str

class GooglePlacesPhotosResponse(BaseModel):
    photos: List[GooglePlacesPhotoUrlResponse]
    place_id: str

class GooglePlacesSearchResponse(BaseModel):
    results: List[GooglePlacesAutocompleteResult]

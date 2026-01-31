"""
Schema for geocoding provider preferences.
"""

from enum import Enum


class GeocodingProvider(str, Enum):
    """Available geocoding providers"""
    NOMINATIM = "nominatim"  # Default, free, slower (~400-600ms)
    MAPBOX = "mapbox"        # Fast (~50-150ms), uses existing token

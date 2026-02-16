import os

from pydantic_settings import BaseSettings
from typing import Optional


def _parse_cors_origins() -> list[str]:
    """Merge CORS_ORIGINS env var with built-in defaults.

    In production set CORS_ORIGINS=https://travelruter.com to restrict access.
    When the env var is set, *only* those origins are allowed (no localhost).
    """
    env_val = os.environ.get("CORS_ORIGINS", "").strip()
    if env_val:
        return [o.strip() for o in env_val.split(",") if o.strip()]
    # Development defaults
    return [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:8000",
        "https://travelruter.com",
        "http://travelruter.com",
    ]


class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Travel Ruter API"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/travel_ruter"

    # CORS — populated from CORS_ORIGINS env var (see _parse_cors_origins)
    BACKEND_CORS_ORIGINS: list[str] = _parse_cors_origins()

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    FRONTEND_URL: str = "http://localhost"
    # Public base URL for OAuth callbacks (e.g. http://localhost for nginx, https://travelruter.com for prod)
    PUBLIC_URL: Optional[str] = None

    # Cloudflare Access (Zero Trust)
    CF_ACCESS_ENABLED: bool = False
    CF_ACCESS_DOMAIN: Optional[str] = None  # e.g. "travelruter.com"
    CF_ACCESS_AUD: Optional[str] = None

    # Encryption (for per-trip API keys)
    FERNET_KEY: Optional[str] = None

    # Document Storage (The Vault)
    DOCUMENTS_UPLOAD_PATH: str = "/app/documents"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_FILE_TYPES: list[str] = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"]

    # Mapbox API
    MAPBOX_ACCESS_TOKEN: Optional[str] = None

    # OpenRouteService API (for transit/public transport routing)
    # Get free API key at: https://openrouteservice.org/dev/#/signup
    OPENROUTESERVICE_API_KEY: Optional[str] = None

    # Google Maps API (for Routes API with real transit routing)
    # Get API key at: https://console.cloud.google.com/apis/credentials
    # Enable "Routes API" in Google Cloud Console
    GOOGLE_MAPS_API_KEY: Optional[str] = None

    # Amadeus API (Hotels & Flights)
    AMADEUS_CLIENT_ID: Optional[str] = None
    AMADEUS_CLIENT_SECRET: Optional[str] = None
    AMADEUS_BASE_URL: str = "https://test.api.amadeus.com"

    # Geocoding Cache
    GEOCODING_CACHE_TTL_HOURS: int = 24
    GEOCODING_CACHE_MAX_SIZE: int = 1000

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

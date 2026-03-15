import logging
import os

from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import Optional

logger = logging.getLogger(__name__)


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

    # Authentication
    AUTH_ENABLED: bool = True  # Secure by default; set to False explicitly for local dev

    # JWT
    SECRET_KEY: str = ""
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

    # NAVITIME API (for Japan transit routing via RapidAPI)
    # Get free tier (500 req/month) at: https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi
    NAVITIME_RAPIDAPI_KEY: Optional[str] = None

    # Amadeus API (Hotels & Flights)
    AMADEUS_CLIENT_ID: Optional[str] = None
    AMADEUS_CLIENT_SECRET: Optional[str] = None
    AMADEUS_BASE_URL: str = "https://test.api.amadeus.com"

    # Geocoding Cache
    GEOCODING_CACHE_TTL_HOURS: int = 24
    GEOCODING_CACHE_MAX_SIZE: int = 1000

    # Inter-service authentication
    INTERNAL_SERVICE_KEY: Optional[str] = None

    @model_validator(mode="after")
    def _validate_security_settings(self) -> "Settings":
        # CR-2: Reject empty/weak SECRET_KEY when auth is on
        if self.AUTH_ENABLED:
            key = self.SECRET_KEY
            if not key or len(key) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters when AUTH_ENABLED=True. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
            if key.startswith("your-"):
                raise ValueError(
                    "SECRET_KEY appears to be a placeholder (starts with 'your-'). "
                    "Set a real secret key for production."
                )

        # CR-9: Warn if FERNET_KEY is empty (encryption silently disabled)
        if not self.FERNET_KEY:
            logger.warning(
                "FERNET_KEY is not set — per-trip API key encryption is disabled. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )

        # S14: Warn if INTERNAL_SERVICE_KEY is empty when auth is on
        if self.AUTH_ENABLED and not self.INTERNAL_SERVICE_KEY:
            logger.warning(
                "INTERNAL_SERVICE_KEY is not set while AUTH_ENABLED=True — "
                "inter-service authentication is disabled."
            )

        return self

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

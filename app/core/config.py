from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Travel Ruter API"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/travel_ruter"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:8000"
    ]

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Document Storage (The Vault)
    DOCUMENTS_UPLOAD_PATH: str = "/app/documents"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_FILE_TYPES: list[str] = ["application/pdf", "image/jpeg", "image/jpg"]

    # Mapbox API
    MAPBOX_ACCESS_TOKEN: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

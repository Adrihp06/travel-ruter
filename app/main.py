import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.http_client import close_http_client
from app.core.exceptions import (
    TravelRuterException,
    ExternalAPIError,
    ValidationError,
)
from app.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if getattr(settings, 'DEBUG', False) else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    yield
    # Shutdown
    await close_http_client()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add gzip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Travel Ruter API",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Global exception handlers
@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    """Handle validation errors with 400 status."""
    logger.warning(f"Validation error: {exc.message}", extra={"details": exc.details})
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "type": "validation_error"},
    )


@app.exception_handler(ExternalAPIError)
async def external_api_error_handler(request: Request, exc: ExternalAPIError):
    """Handle external API errors with 502 status."""
    logger.error(f"External API error: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=502,
        content={
            "detail": exc.message,
            "type": "external_api_error",
            "service": exc.service,
        },
    )


@app.exception_handler(TravelRuterException)
async def travel_ruter_exception_handler(request: Request, exc: TravelRuterException):
    """Handle application-specific errors with 500 status."""
    logger.error(f"Application error: {exc.message}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": exc.message, "type": "application_error"},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions with 500 status and logging."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred", "type": "internal_error"},
    )

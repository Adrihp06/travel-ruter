try:
    from app.services.geospatial_service import GeospatialService
except ImportError:
    GeospatialService = None  # type: ignore[assignment,misc]

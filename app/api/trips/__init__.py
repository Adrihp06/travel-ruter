from fastapi import APIRouter

from app.api.trips.trips import router as trips_router
from app.api.trips.destinations import router as destinations_router
from app.api.trips.pois import router as pois_router
from app.api.trips.routes import router as routes_router
from app.api.trips.route_waypoints import router as route_waypoints_router
from app.api.trips.travel_segments import router as travel_segments_router
from app.api.trips.travel_stops import router as travel_stops_router

router = APIRouter()
router.include_router(trips_router, prefix="/trips", tags=["trips"])
router.include_router(destinations_router, tags=["destinations"])
router.include_router(pois_router, tags=["pois"])
router.include_router(routes_router, tags=["routes"])
router.include_router(route_waypoints_router, tags=["route-waypoints"])
router.include_router(travel_segments_router, tags=["travel-segments"])
router.include_router(travel_stops_router, tags=["travel-stops"])

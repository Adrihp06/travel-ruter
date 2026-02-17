import pytest
from app.schemas.route import RouteRequest, RoutePoint
from app.services.route_service import RouteService

def test_calculate_intra_city_route_walking():
    # Define points (approximate coords in Paris)
    # Eiffel Tower: 48.8584, 2.2945
    # Louvre Museum: 48.8606, 2.3376
    # Approx distance: ~3.5 km straight line
    
    p1 = RoutePoint(latitude=48.8584, longitude=2.2945, dwell_time=60, name="Eiffel Tower")
    p2 = RoutePoint(latitude=48.8606, longitude=2.3376, dwell_time=120, name="Louvre")
    
    request = RouteRequest(mode="walking", points=[p1, p2])
    
    response = RouteService.calculate_intra_city_route(request)
    
    assert response.mode == "walking"
    assert len(response.legs) == 1
    assert response.legs[0].start_point == p1
    assert response.legs[0].end_point == p2
    
    # Check distance (Haversine distance is about 3.17 km)
    assert 3.0 < response.total_distance_km < 3.5
    
    # Walking speed 5km/h. 3.17km -> ~0.63h -> ~38 mins
    assert 35 < response.total_travel_time_minutes < 45
    
    # Total dwell time = 60 + 120 = 180
    assert response.total_dwell_time_minutes == 180
    
    # Total duration = travel + dwell
    assert response.total_duration_minutes == response.total_travel_time_minutes + 180

def test_calculate_intra_city_route_cycling():
    # Same points
    p1 = RoutePoint(latitude=48.8584, longitude=2.2945, dwell_time=0)
    p2 = RoutePoint(latitude=48.8606, longitude=2.3376, dwell_time=0)
    
    request = RouteRequest(mode="cycling", points=[p1, p2])
    
    response = RouteService.calculate_intra_city_route(request)
    
    # Cycling speed 15km/h. 3.17km -> ~0.21h -> ~12.7 mins
    assert 10 < response.total_travel_time_minutes < 15

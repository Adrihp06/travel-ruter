from fastapi.testclient import TestClient
from app.main import app
from app.schemas.routing import TravelMode

client = TestClient(app)

def test_inter_city_routing_driving():
    payload = {
        "origin": {"lat": 40.7128, "lon": -74.0060}, # NYC
        "destination": {"lat": 34.0522, "lon": -118.2437}, # LA
        "mode": "driving"
    }
    response = client.post("/api/v1/routes/inter-city", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "driving"
    assert data["distance_km"] > 0
    assert data["duration_min"] > 0
    # NYC to LA is approx 3900km straight line. Driving is ~4500km?
    # My logic: straight * 1.3
    assert data["distance_km"] > 4000 
    assert data["geometry"]["type"] == "LineString"

def test_inter_city_routing_flight():
    payload = {
        "origin": {"lat": 40.7128, "lon": -74.0060}, # NYC
        "destination": {"lat": 51.5074, "lon": -0.1278}, # London
        "mode": "flight"
    }
    response = client.post("/api/v1/routes/inter-city", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "flight"
    # NYC to London ~5500km
    assert 5000 < data["distance_km"] < 6000
    assert data["geometry"]["type"] == "LineString"

def test_inter_city_routing_validation():
    payload = {
        "origin": {"lat": 200, "lon": -74.0060}, # Invalid Lat
        "destination": {"lat": 34.0522, "lon": -118.2437},
        "mode": "driving"
    }
    response = client.post("/api/v1/routes/inter-city", json=payload)
    assert response.status_code == 422

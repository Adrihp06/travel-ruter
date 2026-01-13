import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models import POI

# Setup Mock Data
mock_poi = POI(
    id=1,
    name="Test POI",
    category="Test Category",
    likes=5,
    vetoes=2,
    destination_id=1,
    priority=0,
    created_at=datetime.now(),
    updated_at=datetime.now(),
    currency="USD"
)

# Mock DB Session
mock_session = AsyncMock()
mock_result = MagicMock()
mock_result.scalar_one_or_none.return_value = mock_poi
mock_session.execute.return_value = mock_result
mock_session.flush = AsyncMock()
mock_session.refresh = AsyncMock()

async def override_get_db():
    yield mock_session

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_vote_like():
    # Reset values
    mock_poi.likes = 5
    mock_poi.vetoes = 2
    
    response = client.post("/api/v1/pois/1/vote", json={"type": "like"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["likes"] == 6
    assert data["vetoes"] == 2

def test_vote_veto():
    # Reset values
    mock_poi.likes = 5
    mock_poi.vetoes = 2
    
    response = client.post("/api/v1/pois/1/vote", json={"type": "veto"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["likes"] == 5
    assert data["vetoes"] == 3

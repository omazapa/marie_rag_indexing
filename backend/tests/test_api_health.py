"""Tests for API health and basic endpoints."""


def test_root_endpoint(client):
    """Test the root endpoint returns correct response."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_api_v1_stats(client):
    """Test stats endpoint returns correct structure."""
    response = client.get("/api/v1/stats")
    assert response.status_code == 200
    data = response.json()
    # Stats endpoint returns different structure with active_sources, etc
    assert isinstance(data, dict)
    assert len(data) > 0

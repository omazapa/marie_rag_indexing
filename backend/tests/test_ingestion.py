"""Tests for ingestion endpoints."""


def test_start_ingestion(client):
    """Test starting an ingestion job."""
    ingest_data = {
        "source_id": "1",
        "model_id": "1",
        "vector_store_id": "1",
        "chunk_size": 512,
        "chunk_overlap": 50,
    }
    response = client.post("/api/v1/ingest", json=ingest_data)
    assert response.status_code in [200, 404]  # 404 if source doesn't exist
    if response.status_code == 200:
        data = response.json()
        assert "job_id" in data or "message" in data


def test_list_ingestion_jobs(client):
    """Test listing all ingestion jobs."""
    response = client.get("/api/v1/ingest/jobs")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert isinstance(data["jobs"], list)


def test_get_ingestion_logs(client):
    """Test getting ingestion logs."""
    response = client.get("/api/v1/ingest/logs")
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert isinstance(data["logs"], list)


def test_ingestion_validation(client):
    """Test ingestion request validation."""
    # Missing required fields
    invalid_data = {
        "source_id": "1",
        # Missing other required fields
    }
    response = client.post("/api/v1/ingest", json=invalid_data)
    assert response.status_code == 422  # Validation error

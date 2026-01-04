"""Tests for model endpoints."""


def test_list_models(client):
    """Test listing all models."""
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert isinstance(data["models"], list)


def test_create_model(client):
    """Test creating a new model."""
    model_data = {
        "name": "Test Model",
        "provider": "huggingface",
        "model": "all-MiniLM-L6-v2",
        "config": {},
    }
    response = client.post("/api/v1/models", json=model_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == model_data["name"]
    assert data["provider"] == model_data["provider"]
    assert "id" in data


def test_get_model_by_id(client):
    """Test getting a specific model by ID."""
    # First create a model
    model_data = {
        "name": "Test Model",
        "provider": "huggingface",
        "model": "all-MiniLM-L6-v2",
        "config": {},
    }
    create_response = client.post("/api/v1/models", json=model_data)
    model_id = create_response.json()["id"]

    # Now get it
    response = client.get(f"/api/v1/models/{model_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == model_id
    assert data["name"] == model_data["name"]


def test_delete_model(client):
    """Test deleting a model."""
    # First create a model
    model_data = {
        "name": "Test Model",
        "provider": "huggingface",
        "model": "all-MiniLM-L6-v2",
        "config": {},
    }
    create_response = client.post("/api/v1/models", json=model_data)
    model_id = create_response.json()["id"]

    # Now delete it
    response = client.delete(f"/api/v1/models/{model_id}")
    assert response.status_code == 200

    # Verify it's gone
    get_response = client.get(f"/api/v1/models/{model_id}")
    assert get_response.status_code == 404

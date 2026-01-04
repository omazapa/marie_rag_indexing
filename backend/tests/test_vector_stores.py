"""Tests for vector store endpoints."""


def test_list_vector_stores(client):
    """Test listing all vector stores."""
    response = client.get("/api/v1/vector-stores")
    assert response.status_code == 200
    data = response.json()
    assert "vector_stores" in data
    assert isinstance(data["vector_stores"], list)


def test_create_vector_store(client):
    """Test creating a new vector store."""
    store_data = {
        "name": "Test Vector Store",
        "type": "opensearch",
        "config": {
            "url": "http://localhost:9200",
            "index_name": "test_index",
        },
    }
    response = client.post("/api/v1/vector-stores", json=store_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == store_data["name"]
    assert data["type"] == store_data["type"]
    assert "id" in data


def test_get_vector_store_by_id(client):
    """Test getting a specific vector store by ID."""
    # First create a vector store
    store_data = {
        "name": "Test Vector Store",
        "type": "opensearch",
        "config": {
            "url": "http://localhost:9200",
            "index_name": "test_index",
        },
    }
    create_response = client.post("/api/v1/vector-stores", json=store_data)
    store_id = create_response.json()["id"]

    # Now get it
    response = client.get(f"/api/v1/vector-stores/{store_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == store_id
    assert data["name"] == store_data["name"]


def test_delete_vector_store(client):
    """Test deleting a vector store."""
    # First create a vector store
    store_data = {
        "name": "Test Vector Store",
        "type": "opensearch",
        "config": {
            "url": "http://localhost:9200",
            "index_name": "test_index",
        },
    }
    create_response = client.post("/api/v1/vector-stores", json=store_data)
    store_id = create_response.json()["id"]

    # Now delete it
    response = client.delete(f"/api/v1/vector-stores/{store_id}")
    assert response.status_code == 200

    # Verify it's gone
    get_response = client.get(f"/api/v1/vector-stores/{store_id}")
    assert get_response.status_code == 404

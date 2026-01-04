"""Tests for data source endpoints."""


def test_list_sources(client):
    """Test listing all sources."""
    response = client.get("/api/v1/sources")
    assert response.status_code == 200
    data = response.json()
    assert "sources" in data
    assert isinstance(data["sources"], list)


def test_create_source(client):
    """Test creating a new source."""
    source_data = {
        "name": "Test Source",
        "type": "local_file",
        "config": {"path": "./test_docs"},
    }
    response = client.post("/api/v1/sources", json=source_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == source_data["name"]
    assert data["type"] == source_data["type"]
    assert "id" in data


def test_get_source_by_id(client):
    """Test getting a specific source by ID."""
    # First create a source
    source_data = {
        "name": "Test Source",
        "type": "local_file",
        "config": {"path": "./test_docs"},
    }
    create_response = client.post("/api/v1/sources", json=source_data)
    source_id = create_response.json()["id"]

    # Now get it
    response = client.get(f"/api/v1/sources/{source_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == source_id
    assert data["name"] == source_data["name"]


def test_update_source(client):
    """Test updating a source."""
    # First create a source
    source_data = {
        "name": "Test Source",
        "type": "local_file",
        "config": {"path": "./test_docs"},
    }
    create_response = client.post("/api/v1/sources", json=source_data)
    source_id = create_response.json()["id"]

    # Now update it
    update_data = {
        "name": "Updated Test Source",
        "type": "local_file",
        "config": {"path": "./updated_docs"},
    }
    response = client.put(f"/api/v1/sources/{source_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == update_data["name"]


def test_delete_source(client):
    """Test deleting a source."""
    # First create a source
    source_data = {
        "name": "Test Source",
        "type": "local_file",
        "config": {"path": "./test_docs"},
    }
    create_response = client.post("/api/v1/sources", json=source_data)
    source_id = create_response.json()["id"]

    # Now delete it
    response = client.delete(f"/api/v1/sources/{source_id}")
    assert response.status_code == 200

    # Verify it's gone
    get_response = client.get(f"/api/v1/sources/{source_id}")
    assert get_response.status_code == 404

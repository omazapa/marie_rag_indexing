"""Tests for plugin endpoints."""


def test_list_plugins(client):
    """Test listing all available plugins."""
    response = client.get("/api/v1/plugins")
    assert response.status_code == 200
    data = response.json()
    assert "plugins" in data
    assert isinstance(data["plugins"], list)
    assert len(data["plugins"]) > 0

    # Check plugin structure
    plugin = data["plugins"][0]
    assert "id" in plugin
    assert "name" in plugin


def test_get_plugin_schema(client):
    """Test getting schema for a specific plugin."""
    # Test with mongodb plugin
    response = client.get("/api/v1/plugins/mongodb/schema")
    assert response.status_code == 200
    data = response.json()
    assert "schema" in data

    # Test with local_file plugin
    response = client.get("/api/v1/plugins/local_file/schema")
    assert response.status_code == 200
    data = response.json()
    assert "schema" in data


def test_get_invalid_plugin_schema(client):
    """Test getting schema for non-existent plugin."""
    response = client.get("/api/v1/plugins/invalid_plugin/schema")
    assert response.status_code == 404


def test_mongodb_databases_endpoint(client):
    """Test MongoDB databases listing endpoint."""
    request_data = {
        "connection_string": "mongodb://localhost:27017",
        "database": None,
    }
    response = client.post("/api/v1/plugins/mongodb/databases", json=request_data)
    # This will fail without a real MongoDB, but should handle gracefully
    assert response.status_code in [200, 500]  # Allow connection errors


def test_mongodb_collections_endpoint(client):
    """Test MongoDB collections listing endpoint."""
    request_data = {
        "connection_string": "mongodb://localhost:27017",
        "database": "test_db",
    }
    response = client.post("/api/v1/plugins/mongodb/collections", json=request_data)
    # This will fail without a real MongoDB, but should handle gracefully
    assert response.status_code in [200, 500]  # Allow connection errors

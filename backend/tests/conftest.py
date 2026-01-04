"""Pytest configuration and fixtures."""

import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture
def mock_mongodb_connection(monkeypatch):
    """Mock MongoDB connection for testing."""
    from unittest.mock import MagicMock

    mock_client = MagicMock()
    mock_db = MagicMock()
    mock_collection = MagicMock()

    mock_client.__getitem__.return_value = mock_db
    mock_db.__getitem__.return_value = mock_collection
    mock_db.list_collection_names.return_value = ["test_collection"]

    def mock_mongo_client(*args, **kwargs):
        return mock_client

    monkeypatch.setattr("pymongo.MongoClient", mock_mongo_client)
    return mock_collection

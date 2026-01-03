"""Data source management endpoints."""

from typing import Any

from flask import Blueprint, jsonify, request

from ...infrastructure.adapters.data_sources.google_drive import GoogleDriveAdapter
from ...infrastructure.adapters.data_sources.local_file import LocalFileAdapter
from ...infrastructure.adapters.data_sources.mongodb import MongoDBAdapter
from ...infrastructure.adapters.data_sources.s3 import S3Adapter
from ...infrastructure.adapters.data_sources.sql import SQLAdapter
from ...infrastructure.adapters.data_sources.web_scraper import WebScraperAdapter

sources_bp = Blueprint("sources", __name__)

DATA_SOURCE_PLUGINS = {
    "local_file": LocalFileAdapter,
    "mongodb": MongoDBAdapter,
    "s3": S3Adapter,
    "sql": SQLAdapter,
    "web_scraper": WebScraperAdapter,
    "google_drive": GoogleDriveAdapter,
}

# In-memory storage for demo purposes
# TODO: Replace with database persistence
data_sources: list[dict[str, Any]] = [
    {
        "id": "1",
        "name": "Local Docs",
        "type": "local_file",
        "status": "active",
        "lastRun": "2025-12-23 10:00",
        "config": {"path": "./docs"},
    },
]


@sources_bp.route("/sources", methods=["GET"])
def get_sources():
    """Get all configured data sources."""
    return jsonify({"sources": data_sources}), 200


@sources_bp.route("/sources", methods=["POST"])
def add_source():
    """Add a new data source configuration."""
    data = request.json
    new_source = {
        "id": str(len(data_sources) + 1),
        "name": data.get("name"),
        "type": data.get("type"),
        "status": "inactive",
        "lastRun": "N/A",
        "config": data.get("config", {}),
    }
    data_sources.append(new_source)
    return jsonify(new_source), 201


@sources_bp.route("/sources/test-connection", methods=["POST"])
def test_source_connection():
    """Test connection to a data source without saving it."""
    data = request.json
    if not data or "type" not in data or "config" not in data:
        return jsonify({"error": "Missing type or config"}), 400

    plugin_id = data["type"]
    config = data["config"]

    plugin_class = DATA_SOURCE_PLUGINS.get(plugin_id)
    if not plugin_class:
        return jsonify({"error": "Plugin not found"}), 404

    try:
        adapter = plugin_class(config)
        success = adapter.test_connection()
        return jsonify({"success": success}), 200
    except Exception as e:
        error_msg = str(e)
        conn_str = config.get("connection_string", "")
        if "localhost" in conn_str or "127.0.0.1" in conn_str:
            error_msg += " | TIP: Use 'host.docker.internal' instead of 'localhost' in Docker."
        return jsonify({"success": False, "error": error_msg}), 200

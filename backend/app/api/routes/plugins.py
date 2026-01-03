"""Data source plugin endpoints."""

from typing import Any

from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

from ...infrastructure.adapters.data_sources.google_drive import GoogleDriveAdapter
from ...infrastructure.adapters.data_sources.local_file import LocalFileAdapter
from ...infrastructure.adapters.data_sources.mongodb import MongoDBAdapter
from ...infrastructure.adapters.data_sources.s3 import S3Adapter
from ...infrastructure.adapters.data_sources.sql import SQLAdapter
from ...infrastructure.adapters.data_sources.web_scraper import WebScraperAdapter

plugins_bp = Blueprint("plugins", __name__)

DATA_SOURCE_PLUGINS = {
    "local_file": LocalFileAdapter,
    "mongodb": MongoDBAdapter,
    "s3": S3Adapter,
    "sql": SQLAdapter,
    "web_scraper": WebScraperAdapter,
    "google_drive": GoogleDriveAdapter,
}


@plugins_bp.route("/plugins", methods=["GET"])
def list_plugins():
    """List all available data source plugins."""
    return jsonify(
        {
            "plugins": [
                {"id": "local_file", "name": "Local File System"},
                {"id": "s3", "name": "S3 / MinIO"},
                {"id": "mongodb", "name": "MongoDB"},
                {"id": "sql", "name": "SQL Database"},
                {"id": "web_scraper", "name": "Web Scraper"},
                {"id": "google_drive", "name": "Google Drive"},
            ]
        }
    ), 200


@plugins_bp.route("/plugins/<plugin_id>/schema", methods=["GET"])
def get_plugin_schema(plugin_id):
    """Get configuration schema for a specific plugin."""
    plugin_class = DATA_SOURCE_PLUGINS.get(plugin_id)
    if not plugin_class:
        return jsonify({"error": "Plugin not found"}), 404
    try:
        return jsonify(plugin_class.get_config_schema()), 200
    except NotImplementedError:
        return jsonify({"error": "Schema not implemented for this plugin"}), 501


@plugins_bp.route("/plugins/mongodb/databases", methods=["POST"])
def list_mongodb_databases():
    """List all databases in a MongoDB instance."""
    data = request.json
    if not data or "connection_string" not in data:
        return jsonify({"error": "Missing connection_string"}), 400

    conn_str = data["connection_string"]
    try:
        client: MongoClient[Any] = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
        databases = client.list_database_names()
        return jsonify({"databases": databases}), 200
    except ServerSelectionTimeoutError:
        error_msg = "Connection Timeout. MongoDB is not reachable."
        error_msg += " Ensure MongoDB is running on your host and allows connections on port 27017."
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@plugins_bp.route("/plugins/mongodb/collections", methods=["POST"])
def list_mongodb_collections():
    """List all collections in a MongoDB database."""
    data = request.json
    if not data or "connection_string" not in data or "database" not in data:
        return jsonify({"error": "Missing connection_string or database"}), 400

    conn_str = data["connection_string"]
    try:
        client: MongoClient[Any] = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
        db = client[data["database"]]
        collections = db.list_collection_names()
        return jsonify({"collections": collections}), 200
    except ServerSelectionTimeoutError:
        error_msg = "Connection Timeout. MongoDB is not reachable."
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@plugins_bp.route("/mongodb/schema", methods=["GET"])
def get_mongodb_schema():
    """Get schema from a MongoDB collection based on a sample document."""
    conn_str = request.args.get("connection_string")
    db_name = request.args.get("database")
    coll_name = request.args.get("collection")
    if not conn_str or not db_name or not coll_name:
        return jsonify({"error": "Missing parameters"}), 400
    try:
        client: MongoClient[Any] = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        collection = db[coll_name]
        sample = collection.find_one()
        if not sample:
            return jsonify({"schema": [], "message": "Collection is empty"}), 200

        def flatten_schema(doc, prefix=""):
            paths = []
            for key, value in doc.items():
                full_path = f"{prefix}{key}"
                paths.append(full_path)
                if isinstance(value, dict):
                    paths.extend(flatten_schema(value, f"{full_path}."))
                elif isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                    paths.extend(flatten_schema(value[0], f"{full_path}."))
            return paths

        schema = flatten_schema(sample)
        return jsonify({"schema": schema, "sample": str(sample)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    """Analyze schema from a MongoDB collection using aggregation pipeline."""
    conn_str = request.args.get("connection_string")
    db_name = request.args.get("database")
    coll_name = request.args.get("collection")

    if not conn_str or not db_name or not coll_name:
        return jsonify({"error": "Missing parameters"}), 400

    try:
        client: MongoClient[Any] = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        collection = db[coll_name]

        # Get collection stats
        stats = db.command("collStats", coll_name)
        doc_count = stats.get("count", 0)

        if doc_count == 0:
            return jsonify(
                {"schema": {}, "totalDocuments": 0, "message": "Collection is empty"}
            ), 200

        # Sample size: up to 100 documents or all if less
        sample_size = min(100, doc_count)

        # Use aggregation pipeline to analyze schema
        pipeline = [{"$sample": {"size": sample_size}}, {"$project": {"document": "$$ROOT"}}]

        # Analyze field types and presence
        field_analysis: dict[str, Any] = {}

        for doc in collection.aggregate(pipeline):
            analyze_document(doc["document"], field_analysis, sample_size)

        # Build schema result
        schema_result = build_schema_result(field_analysis, sample_size)

        # Get one sample document for preview
        sample_doc = collection.find_one()

        return jsonify(
            {
                "schema": schema_result,
                "totalDocuments": doc_count,
                "sampledDocuments": sample_size,
                "sampleDocument": sample_doc,
            }
        ), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_value_type(value: Any) -> str:
    """Determine the type of a value."""
    type_map = {
        type(None): "null",
        bool: "bool",
        int: "int",
        float: "double",
        str: "string",
        dict: "object",
        list: "array",
    }
    return type_map.get(type(value), type(value).__name__)


def analyze_document(
    doc: dict[str, Any], field_analysis: dict[str, Any], total_samples: int, prefix: str = ""
) -> None:
    """Recursively analyze document structure and field types."""
    for key, value in doc.items():
        if key == "_id" and not prefix:
            continue

        full_path = f"{prefix}{key}" if prefix else key

        if full_path not in field_analysis:
            field_analysis[full_path] = {
                "types": {},
                "count": 0,
                "nested": isinstance(value, dict),
                "array": isinstance(value, list),
            }

        field_analysis[full_path]["count"] += 1
        value_type = get_value_type(value)

        # Handle nested structures
        if isinstance(value, dict):
            analyze_document(value, field_analysis, total_samples, f"{full_path}.")
        elif isinstance(value, list) and len(value) > 0:
            first_elem = value[0]
            if isinstance(first_elem, dict):
                analyze_document(first_elem, field_analysis, total_samples, f"{full_path}.")
            else:
                field_analysis[full_path]["array_of"] = type(first_elem).__name__

        # Increment type counter
        if value_type in field_analysis[full_path]["types"]:
            field_analysis[full_path]["types"][value_type] += 1
        else:
            field_analysis[full_path]["types"][value_type] = 1


def build_schema_result(field_analysis: dict[str, Any], total_samples: int) -> dict[str, Any]:
    """Build final schema result with field information."""
    result = {}

    for field_path, info in field_analysis.items():
        # Calculate percentage present
        percentage = (info["count"] / total_samples) * 100

        # Get primary type (most common)
        primary_type = (
            max(info["types"].items(), key=lambda x: x[1])[0] if info["types"] else "unknown"
        )

        # Get all types if multiple
        all_types = list(info["types"].keys())

        result[field_path] = {
            "type": primary_type,
            "types": all_types if len(all_types) > 1 else [primary_type],
            "presence": round(percentage, 2),
            "count": info["count"],
            "isNested": info.get("nested", False),
            "isArray": info.get("array", False),
        }

        if "array_of" in info:
            result[field_path]["arrayElementType"] = info["array_of"]

    return result

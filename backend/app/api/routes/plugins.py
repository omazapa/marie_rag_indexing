"""Data source plugin endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

from ...infrastructure.adapters.data_sources.google_drive import GoogleDriveAdapter
from ...infrastructure.adapters.data_sources.local_file import LocalFileAdapter
from ...infrastructure.adapters.data_sources.mongodb import MongoDBAdapter
from ...infrastructure.adapters.data_sources.s3 import S3Adapter
from ...infrastructure.adapters.data_sources.sql import SQLAdapter
from ...infrastructure.adapters.data_sources.web_scraper import WebScraperAdapter

router = APIRouter()


class MongoConnectionRequest(BaseModel):
    connection_string: str
    database: str | None = None


DATA_SOURCE_PLUGINS = {
    "local_file": LocalFileAdapter,
    "mongodb": MongoDBAdapter,
    "s3": S3Adapter,
    "sql": SQLAdapter,
    "web_scraper": WebScraperAdapter,
    "google_drive": GoogleDriveAdapter,
}


@router.get("/plugins")
async def list_plugins():
    """List all available data source plugins."""
    return {
        "plugins": [
            {"id": "local_file", "name": "Local File System"},
            {"id": "s3", "name": "S3 / MinIO"},
            {"id": "mongodb", "name": "MongoDB"},
            {"id": "sql", "name": "SQL Database"},
            {"id": "web_scraper", "name": "Web Scraper"},
            {"id": "google_drive", "name": "Google Drive"},
        ]
    }


@router.get("/plugins/{plugin_id}/schema")
async def get_plugin_schema(plugin_id: str):
    """Get configuration schema for a specific plugin."""
    plugin_class = DATA_SOURCE_PLUGINS.get(plugin_id)
    if not plugin_class:
        raise HTTPException(status_code=404, detail="Plugin not found")
    try:
        return plugin_class.get_config_schema()
    except NotImplementedError:
        raise HTTPException(
            status_code=501, detail="Schema not implemented for this plugin"
        ) from None


@router.post("/plugins/mongodb/databases")
async def list_mongodb_databases(request: MongoConnectionRequest):
    """List all databases in a MongoDB instance."""
    try:
        client: MongoClient[Any] = MongoClient(
            request.connection_string, serverSelectionTimeoutMS=5000
        )
        databases = client.list_database_names()
        return {"databases": databases}
    except ServerSelectionTimeoutError as e:
        error_msg = "Connection Timeout. MongoDB is not reachable."
        error_msg += " Ensure MongoDB is running on your host and allows connections on port 27017."
        raise HTTPException(status_code=500, detail=error_msg) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/plugins/mongodb/collections")
async def list_mongodb_collections(request: MongoConnectionRequest):
    """List all collections in a MongoDB database."""
    if not request.database:
        raise HTTPException(status_code=400, detail="Missing database parameter")

    try:
        client: MongoClient[Any] = MongoClient(
            request.connection_string, serverSelectionTimeoutMS=5000
        )
        db = client[request.database]
        collections = db.list_collection_names()
        return {"collections": collections}
    except ServerSelectionTimeoutError as e:
        error_msg = "Connection Timeout. MongoDB is not reachable."
        raise HTTPException(status_code=500, detail=error_msg) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/mongodb/schema")
async def get_mongodb_schema(
    connection_string: str = Query(...),
    database: str = Query(...),
    collection: str = Query(...),
):
    """Analyze schema from a MongoDB collection using aggregation pipeline."""
    try:
        client: MongoClient[Any] = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        db = client[database]
        coll = db[collection]

        # Get collection stats
        stats = db.command("collStats", collection)
        doc_count = stats.get("count", 0)

        if doc_count == 0:
            return {"schema": {}, "totalDocuments": 0, "message": "Collection is empty"}

        # Sample size: up to 100 documents or all if less
        sample_size = min(100, doc_count)

        # Use aggregation pipeline to analyze schema
        pipeline = [{"$sample": {"size": sample_size}}, {"$project": {"document": "$$ROOT"}}]

        # Analyze field types and presence
        field_analysis: dict[str, Any] = {}

        for doc in coll.aggregate(pipeline):
            analyze_document(doc["document"], field_analysis, sample_size)

        # Build schema result
        schema_result = build_schema_result(field_analysis, sample_size)

        # Get one sample document for preview
        sample_doc = coll.find_one()

        return {
            "schema": schema_result,
            "totalDocuments": doc_count,
            "sampledDocuments": sample_size,
            "sampleDocument": sample_doc,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


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

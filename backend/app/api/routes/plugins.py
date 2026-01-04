"""Data source plugin endpoints."""

from typing import Any

from bson import ObjectId
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
    """
    Analyze schema from a MongoDB collection using aggregation pipeline.
    Uses MongoDB's native aggregation for efficient schema analysis.
    """
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

        # MongoDB aggregation pipeline for schema analysis
        # This is inspired by the analyze-schema snippet
        pipeline = [
            {"$sample": {"size": sample_size}},
            {"$project": {"arrayofkeyvalue": {"$objectToArray": "$$ROOT"}}},
            {"$unwind": "$arrayofkeyvalue"},
            {
                "$group": {
                    "_id": None,
                    "allkeys": {"$addToSet": "$arrayofkeyvalue.k"},
                }
            },
        ]

        # Get all unique keys
        result = list(coll.aggregate(pipeline))
        all_keys = result[0]["allkeys"] if result else []

        # Analyze field types and presence for each key
        field_analysis: dict[str, Any] = {}

        # Sample documents to analyze types
        sample_docs = list(coll.aggregate([{"$sample": {"size": sample_size}}]))

        # First pass: collect ALL unique field paths across all documents
        all_field_paths = collect_all_field_paths(sample_docs)

        # Second pass: analyze each field path
        for field_path in sorted(all_field_paths):
            field_analysis[field_path] = analyze_field_path(field_path, sample_docs)

        # Convert all ObjectIds to strings in the entire response
        field_analysis = convert_objectid_to_str(field_analysis)

        # Get one sample document for preview and convert all ObjectIds to strings
        sample_doc = sample_docs[0] if sample_docs else None
        if sample_doc:
            sample_doc = convert_objectid_to_str(sample_doc)

        return {
            "schema": field_analysis,
            "totalDocuments": doc_count,
            "sampledDocuments": sample_size,
            "sampleDocument": sample_doc,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/mongodb/schemas-batch")
async def get_mongodb_schemas_batch(request: dict[str, Any]):
    """
    Analyze schemas from multiple MongoDB collections in a single request.
    Returns a dictionary with collection names as keys and their schemas as values.
    """
    try:
        connection_string = request.get("connection_string")
        database = request.get("database")
        collections = request.get("collections", [])

        if not connection_string or not database or not collections:
            raise HTTPException(
                status_code=400,
                detail="connection_string, database, and collections are required",
            )

        client: MongoClient[Any] = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        db = client[database]

        results = {}

        for collection_name in collections:
            try:
                coll = db[collection_name]

                # Get collection stats
                stats = db.command("collStats", collection_name)
                doc_count = stats.get("count", 0)

                if doc_count == 0:
                    results[collection_name] = {
                        "schema": {},
                        "totalDocuments": 0,
                        "message": "Collection is empty",
                    }
                    continue

                # Sample size: up to 50 documents for batch processing (less than single query)
                sample_size = min(50, doc_count)

                # MongoDB aggregation pipeline for schema analysis
                pipeline = [
                    {"$sample": {"size": sample_size}},
                    {"$project": {"arrayofkeyvalue": {"$objectToArray": "$$ROOT"}}},
                    {"$unwind": "$arrayofkeyvalue"},
                    {
                        "$group": {
                            "_id": None,
                            "allkeys": {"$addToSet": "$arrayofkeyvalue.k"},
                        }
                    },
                ]

                # Get all unique keys
                result = list(coll.aggregate(pipeline))
                all_keys = result[0]["allkeys"] if result else []

                # Analyze field types and presence for each key
                field_analysis: dict[str, Any] = {}

                # Sample documents to analyze types
                sample_docs = list(coll.aggregate([{"$sample": {"size": sample_size}}]))

                # First pass: collect ALL unique field paths across all documents
                all_field_paths = collect_all_field_paths(sample_docs)

                # Second pass: analyze each field path
                for field_path in sorted(all_field_paths):
                    field_analysis[field_path] = analyze_field_path(field_path, sample_docs)

                # Convert all ObjectIds to strings in the entire response
                field_analysis = convert_objectid_to_str(field_analysis)

                results[collection_name] = {
                    "schema": field_analysis,
                    "totalDocuments": doc_count,
                    "sampledDocuments": sample_size,
                }

            except Exception as col_error:
                results[collection_name] = {
                    "schema": {},
                    "error": str(col_error),
                    "totalDocuments": 0,
                }

        return {"collections": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def convert_objectid_to_str(obj: Any) -> Any:
    """Recursively convert ObjectId instances to strings in nested structures."""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_objectid_to_str(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid_to_str(item) for item in obj]
    else:
        return obj


def get_value_type(value: Any) -> str:
    """Determine the MongoDB BSON type of a value."""
    if isinstance(value, ObjectId):
        return "ObjectId"
    elif isinstance(value, bool):
        return "bool"
    elif isinstance(value, int):
        return "int"
    elif isinstance(value, float):
        return "double"
    elif isinstance(value, str):
        return "string"
    elif isinstance(value, dict):
        return "object"
    elif isinstance(value, list):
        return "array"
    elif value is None:
        return "null"
    else:
        return type(value).__name__


def collect_all_field_paths(
    documents: list[dict[str, Any]], prefix: str = "", max_depth: int = 10
) -> set[str]:
    """
    Recursively collect all unique field paths from all documents.
    This is similar to how MongoDB's analyze-schema snippet works.
    """
    if not documents or prefix.count(".") >= max_depth:
        return set()

    all_paths: set[str] = set()

    for doc in documents:
        if not isinstance(doc, dict):
            continue

        for key, value in doc.items():
            current_path = f"{prefix}{key}" if prefix else key
            all_paths.add(current_path)

            # Recursively process nested objects
            if isinstance(value, dict):
                nested_paths = collect_all_field_paths([value], f"{current_path}.", max_depth)
                all_paths.update(nested_paths)
            # Process arrays of objects
            elif isinstance(value, list):
                # Collect all objects from the array
                objects_in_array = [item for item in value if isinstance(item, dict)]
                if objects_in_array:
                    nested_paths = collect_all_field_paths(
                        objects_in_array, f"{current_path}.", max_depth
                    )
                    all_paths.update(nested_paths)

    return all_paths


def analyze_field_path(field_path: str, documents: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Analyze a specific field path across all documents.
    Similar to MongoDB's field analysis in analyze-schema snippet.
    """
    types: dict[str, int] = {}
    count = 0
    sample_values = []
    has_nested = False
    has_array = False
    array_element_type = None

    path_parts = field_path.split(".")

    for doc in documents:
        # Navigate to the field value
        value = doc
        try:
            for part in path_parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                elif isinstance(value, list):
                    # Handle arrays in the path - check all elements
                    temp_values = []
                    for item in value:
                        if isinstance(item, dict) and part in item:
                            temp_values.append(item[part])
                    if temp_values:
                        value = temp_values if len(temp_values) > 1 else temp_values[0]
                    else:
                        value = None
                        break
                else:
                    value = None
                    break

            if value is not None:
                count += 1
                value_type = get_value_type(value)
                types[value_type] = types.get(value_type, 0) + 1

                # Analyze structure
                if isinstance(value, dict):
                    has_nested = True
                elif isinstance(value, list):
                    has_array = True
                    # Determine array element type
                    for elem in value:
                        if elem is not None:
                            elem_type = get_value_type(elem)
                            if array_element_type is None:
                                array_element_type = elem_type
                            elif array_element_type != elem_type and elem_type != "null":
                                array_element_type = "mixed"
                            if isinstance(elem, dict):
                                has_nested = True
                                break

                # Collect sample values
                if len(sample_values) < 3:
                    if isinstance(value, ObjectId):
                        sample_values.append(str(value))
                    elif isinstance(value, dict):
                        sample_values.append(f"object({len(value)} keys)")
                    elif isinstance(value, list):
                        sample_values.append(f"array({len(value)} items)")
                    else:
                        sample_values.append(value)

        except (KeyError, TypeError, AttributeError, IndexError):
            continue

    if count == 0:
        return {}

    total_docs = len(documents)
    primary_type = max(types.items(), key=lambda x: x[1])[0] if types else "unknown"

    result = {
        "path": field_path,
        "type": primary_type,
        "types": list(types.keys()),
        "count": count,
        "percentage": round((count / total_docs) * 100, 2) if total_docs > 0 else 0,
        "sample_values": sample_values,
        "isNested": has_nested,
        "isArray": has_array,
    }

    if array_element_type:
        result["arrayElementType"] = array_element_type

    return result


def analyze_field_recursive(
    field_name: str,
    documents: list[dict[str, Any]],
    field_analysis: dict[str, Any],
    prefix: str = "",
    max_depth: int = 10,
    current_depth: int = 0,
) -> None:
    """
    Recursively analyze a field and its nested fields across multiple documents.
    Adds results directly to field_analysis dictionary.
    """
    if current_depth >= max_depth:
        return

    full_path = f"{prefix}{field_name}" if prefix else field_name

    types: dict[str, int] = {}
    count = 0
    sample_values = []
    has_nested = False
    has_array = False
    array_element_type = None
    nested_keys: set[str] = set()

    for doc in documents:
        # Navigate to the field through the prefix path
        value = doc
        path_parts = full_path.split(".")

        try:
            for part in path_parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    value = None
                    break

            if value is not None:
                count += 1
                value_type = get_value_type(value)
                types[value_type] = types.get(value_type, 0) + 1

                # Check for nested structures and collect ALL keys from ALL documents
                if isinstance(value, dict):
                    has_nested = True
                    # Collect all keys from this specific nested object
                    nested_keys.update(value.keys())
                elif isinstance(value, list):
                    has_array = True
                    # Analyze all elements in the array, not just the first one
                    for elem in value:
                        if isinstance(elem, dict):
                            has_nested = True
                            # Collect keys from all objects in the array
                            nested_keys.update(elem.keys())
                        elif elem is not None:
                            elem_type = get_value_type(elem)
                            if array_element_type is None:
                                array_element_type = elem_type
                            elif array_element_type != elem_type:
                                array_element_type = "mixed"

                # Collect sample values (max 3)
                if len(sample_values) < 3:
                    if isinstance(value, ObjectId):
                        sample_values.append(str(value))
                    elif isinstance(value, dict):
                        sample_values.append(f"object({len(value)} keys)")
                    elif isinstance(value, list):
                        sample_values.append(f"array({len(value)} items)")
                    else:
                        sample_values.append(value)
        except (KeyError, TypeError, AttributeError):
            continue

    if count == 0:
        return

    total_docs = len(documents)

    # Get primary type (most common)
    primary_type = max(types.items(), key=lambda x: x[1])[0] if types else "unknown"

    field_analysis[full_path] = {
        "path": full_path,
        "type": primary_type,
        "types": list(types.keys()),
        "count": count,
        "percentage": round((count / total_docs) * 100, 2) if total_docs > 0 else 0,
        "sample_values": sample_values,
        "isNested": has_nested,
        "isArray": has_array,
    }

    if array_element_type:
        field_analysis[full_path]["arrayElementType"] = array_element_type

    # Recursively analyze nested fields
    if has_nested and nested_keys and current_depth < max_depth - 1:
        new_prefix = f"{full_path}."
        for nested_key in sorted(nested_keys):  # Sort for consistent ordering
            analyze_field_recursive(
                nested_key,
                documents,
                field_analysis,
                prefix=new_prefix,
                max_depth=max_depth,
                current_depth=current_depth + 1,
            )


def analyze_field(field_name: str, documents: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Analyze a specific field across multiple documents.
    Returns type distribution, occurrence count, and sample values.
    """
    types: dict[str, int] = {}
    count = 0
    sample_values = []
    has_nested = False
    has_array = False
    array_element_type = None

    for doc in documents:
        if field_name in doc:
            count += 1
            value = doc[field_name]
            value_type = get_value_type(value)
            types[value_type] = types.get(value_type, 0) + 1

            # Check for nested structures
            if isinstance(value, dict):
                has_nested = True
            elif isinstance(value, list):
                has_array = True
                if value and not array_element_type:
                    array_element_type = get_value_type(value[0])

            # Collect sample values (max 3)
            if len(sample_values) < 3:
                if isinstance(value, ObjectId):
                    sample_values.append(str(value))
                elif isinstance(value, (dict, list)):
                    sample_values.append(str(type(value).__name__))
                else:
                    sample_values.append(value)

    total_docs = len(documents)

    # Get primary type (most common)
    primary_type = max(types.items(), key=lambda x: x[1])[0] if types else "unknown"

    result = {
        "path": field_name,
        "type": primary_type,
        "types": list(types.keys()),
        "count": count,
        "percentage": round((count / total_docs) * 100, 2) if total_docs > 0 else 0,
        "sample_values": sample_values,
        "isNested": has_nested,
        "isArray": has_array,
    }

    if array_element_type:
        result["arrayElementType"] = array_element_type

    return result

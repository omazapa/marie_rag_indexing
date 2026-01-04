"""Data source management endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...infrastructure.adapters.data_sources.google_drive import GoogleDriveAdapter
from ...infrastructure.adapters.data_sources.local_file import LocalFileAdapter
from ...infrastructure.adapters.data_sources.mongodb import MongoDBAdapter
from ...infrastructure.adapters.data_sources.s3 import S3Adapter
from ...infrastructure.adapters.data_sources.sql import SQLAdapter
from ...infrastructure.adapters.data_sources.web_scraper import WebScraperAdapter

router = APIRouter()


class SourceCreate(BaseModel):
    name: str
    type: str
    config: dict[str, Any] = {}


class SourceUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    status: str | None = None


class SourceTestConnection(BaseModel):
    type: str
    config: dict[str, Any]


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


@router.get("/sources")
async def get_sources():
    """Get all configured data sources."""
    return {"sources": data_sources}


@router.post("/sources")
async def add_source(source: SourceCreate):
    """Add a new data source configuration."""
    new_source = {
        "id": str(len(data_sources) + 1),
        "name": source.name,
        "type": source.type,
        "status": "inactive",
        "lastRun": "N/A",
        "config": source.config,
    }
    data_sources.append(new_source)
    return new_source


@router.put("/sources/{source_id}")
async def update_source(source_id: str, source: SourceUpdate):
    """Update an existing data source configuration."""
    # Find the source
    existing_source = next((s for s in data_sources if s["id"] == source_id), None)
    if not existing_source:
        raise HTTPException(status_code=404, detail="Source not found")

    # Update fields
    if source.name is not None:
        existing_source["name"] = source.name
    if source.config is not None:
        existing_source["config"] = source.config
    if source.status is not None:
        existing_source["status"] = source.status

    return existing_source


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str):
    """Delete a data source configuration."""
    global data_sources

    # Find the source
    source = next((s for s in data_sources if s["id"] == source_id), None)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    # Remove from list
    data_sources = [s for s in data_sources if s["id"] != source_id]

    return {"message": "Source deleted successfully"}


@router.post("/sources/test-connection")
async def test_source_connection(test_data: SourceTestConnection):
    """Test connection to a data source without saving it."""
    plugin_class = DATA_SOURCE_PLUGINS.get(test_data.type)
    if not plugin_class:
        raise HTTPException(status_code=404, detail="Plugin not found")

    try:
        adapter = plugin_class(test_data.config)
        success = adapter.test_connection()
        return {"success": success}
    except Exception as e:
        error_msg = str(e)
        conn_str = test_data.config.get("connection_string", "")
        if "localhost" in conn_str or "127.0.0.1" in conn_str:
            error_msg += " | TIP: Use 'host.docker.internal' instead of 'localhost' in Docker."
        return {"success": False, "error": error_msg}

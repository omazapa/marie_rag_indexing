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
from ...infrastructure.persistence.opensearch_store import OpenSearchStore

router = APIRouter()

# Initialize OpenSearch storage for data sources
sources_store = OpenSearchStore("marie_rag_indexing_sources")


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


@router.get("/sources")
async def get_sources():
    """Get all configured data sources."""
    sources = sources_store.list()
    return {"sources": sources}


@router.post("/sources")
async def add_source(source: SourceCreate):
    """Add a new data source configuration."""
    import uuid

    source_id = str(uuid.uuid4())
    new_source = sources_store.create(
        source_id,
        {
            "name": source.name,
            "source_type": source.type,
            "status": "inactive",
            "lastRun": "N/A",
            "config": source.config,
        },
    )
    return new_source


@router.put("/sources/{source_id}")
async def update_source(source_id: str, source: SourceUpdate):
    """Update an existing data source configuration."""
    existing_source = sources_store.get(source_id)
    if not existing_source:
        raise HTTPException(status_code=404, detail="Source not found")

    # Build updates dict
    updates = {}
    if source.name is not None:
        updates["name"] = source.name
    if source.config is not None:
        updates["config"] = source.config
    if source.status is not None:
        updates["status"] = source.status

    sources_store.update(source_id, updates)
    return sources_store.get(source_id)


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str):
    """Delete a data source configuration."""
    existing_source = sources_store.get(source_id)
    if not existing_source:
        raise HTTPException(status_code=404, detail="Source not found")

    sources_store.delete(source_id)
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

"""Ingestion orchestration endpoints."""

import threading
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ...application.services.assistant import ConnectorAssistant
from ...application.services.chunking import ChunkConfig
from ...application.services.orchestrator import IngestionOrchestrator
from ...infrastructure.adapters.data_sources.google_drive import GoogleDriveAdapter
from ...infrastructure.adapters.data_sources.local_file import LocalFileAdapter
from ...infrastructure.adapters.data_sources.mongodb import MongoDBAdapter
from ...infrastructure.adapters.data_sources.s3 import S3Adapter
from ...infrastructure.adapters.data_sources.sql import SQLAdapter
from ...infrastructure.adapters.data_sources.web_scraper import WebScraperAdapter
from ...infrastructure.adapters.vector_stores.milvus import MilvusAdapter
from ...infrastructure.adapters.vector_stores.opensearch import OpenSearchAdapter
from ...infrastructure.adapters.vector_stores.pgvector import PGVectorAdapter
from ...infrastructure.adapters.vector_stores.pinecone import PineconeAdapter
from ...infrastructure.adapters.vector_stores.qdrant import QdrantAdapter
from ...infrastructure.logging.log_manager import log_manager, stream_logs

router = APIRouter()


class IngestionRequest(BaseModel):
    plugin_id: str
    config: dict[str, Any] = {}
    chunk_settings: dict[str, Any] = {}
    vector_store: str = "opensearch"
    vector_store_config: dict[str, Any] = {}
    index_name: str = "default_index"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_provider: str = "huggingface"
    embedding_config: dict[str, Any] = {}
    execution_mode: str = "sequential"
    max_workers: int = 4


class AssistantRequest(BaseModel):
    prompt: str


DATA_SOURCE_PLUGINS = {
    "local_file": LocalFileAdapter,
    "mongodb": MongoDBAdapter,
    "s3": S3Adapter,
    "sql": SQLAdapter,
    "web_scraper": WebScraperAdapter,
    "google_drive": GoogleDriveAdapter,
}

VECTOR_STORE_PLUGINS = {
    "opensearch": OpenSearchAdapter,
    "pinecone": PineconeAdapter,
    "qdrant": QdrantAdapter,
    "milvus": MilvusAdapter,
    "pgvector": PGVectorAdapter,
}

# In-memory storage for jobs (TODO: persist to database)
ingestion_jobs: dict[str, dict[str, Any]] = {}

# Mock embedding models for assistant
embedding_models: list[dict[str, Any]] = [
    {
        "id": "2",
        "name": "Llama 3 (Ollama)",
        "provider": "ollama",
        "model": "llama3",
        "status": "active",
        "config": {"base_url": "http://localhost:11434"},
    },
]


@router.post("/ingest")
async def trigger_ingestion(request: IngestionRequest):
    """Trigger an ingestion job."""
    # Data Source Adapter Selection
    plugin_class: Any = DATA_SOURCE_PLUGINS.get(request.plugin_id)
    if not plugin_class:
        raise HTTPException(status_code=400, detail=f"Plugin {request.plugin_id} not supported")
    data_source = plugin_class(request.config)

    # Vector Store Adapter Selection
    vs_class: Any = VECTOR_STORE_PLUGINS.get(request.vector_store)
    if not vs_class:
        raise HTTPException(
            status_code=400, detail=f"Vector store {request.vector_store} not supported"
        )
    vector_store = vs_class(request.vector_store_config)

    # Create job record
    job_id = str(uuid.uuid4())
    ingestion_jobs[job_id] = {
        "id": job_id,
        "status": "running",
        "plugin_id": request.plugin_id,
        "index_name": request.index_name,
        "vector_store": request.vector_store,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "documents_processed": 0,
        "chunks_created": 0,
        "error": None,
    }

    chunk_config = ChunkConfig(**request.chunk_settings)
    orchestrator = IngestionOrchestrator(
        data_source=data_source,
        vector_store=vector_store,
        chunk_config=chunk_config,
        index_name=request.index_name,
        embedding_model=request.embedding_model,
        embedding_provider=request.embedding_provider,
        embedding_config=request.embedding_config,
        execution_mode=request.execution_mode,
        max_workers=request.max_workers,
    )

    def run_job():
        """Run the ingestion job and update job status."""
        try:
            result = orchestrator.run()
            ingestion_jobs[job_id]["status"] = "completed"
            ingestion_jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()
            ingestion_jobs[job_id]["documents_processed"] = result.get("documents", 0)
            ingestion_jobs[job_id]["chunks_created"] = result.get("chunks", 0)
        except Exception as e:
            ingestion_jobs[job_id]["status"] = "failed"
            ingestion_jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()
            ingestion_jobs[job_id]["error"] = str(e)

    # Run ingestion in a background thread
    thread = threading.Thread(target=run_job)
    thread.start()

    return {
        "status": "success",
        "message": "Ingestion started",
        "job_id": job_id,
        "vector_store": request.vector_store,
    }


@router.get("/ingest/logs")
async def get_ingestion_logs():
    """Stream ingestion logs via Server-Sent Events."""
    q = log_manager.subscribe()
    return StreamingResponse(stream_logs(q), media_type="text/event-stream")


@router.get("/jobs")
async def get_jobs():
    """Get all ingestion jobs."""
    jobs_list = list(ingestion_jobs.values())
    # Sort by started_at descending
    jobs_list.sort(key=lambda x: x["started_at"], reverse=True)
    return {"jobs": jobs_list}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get details of a specific ingestion job."""
    job = ingestion_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/assistant/connector")
async def assistant_connector(request: AssistantRequest):
    """Use AI assistant to suggest connector configuration."""
    # Try to find an Ollama model to use for the assistant
    ollama_url = "http://localhost:11434"
    assistant_model = "llama3"
    for m in embedding_models:
        if m["provider"] == "ollama":
            ollama_url = m.get("config", {}).get("base_url", ollama_url)
            assistant_model = m.get("model", assistant_model)
            break

    assistant = ConnectorAssistant(ollama_url=ollama_url, model=assistant_model)
    suggestion = assistant.suggest_connector(request.prompt)
    return suggestion

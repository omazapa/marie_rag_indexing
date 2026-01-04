"""Ingestion orchestration endpoints."""

import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
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
from ...infrastructure.persistence.opensearch_store import OpenSearchStore

router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenSearch storage for jobs
jobs_store = OpenSearchStore("marie_rag_indexing_jobs")

# Track running threads
active_threads: dict[str, threading.Thread] = {}


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
async def trigger_ingestion(request: IngestionRequest, background_tasks: BackgroundTasks):
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

    # Create job record with full configuration for retry
    job_id = str(uuid.uuid4())
    job_data = {
        "id": job_id,
        "status": "running",
        "data_source_id": request.plugin_id,
        "vector_store_id": request.vector_store,
        "index_name": request.index_name,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "last_update": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "documents_processed": 0,
        "total_documents": 0,
        "chunks_created": 0,
        "error": None,
        # Store configuration for retry
        "config": {
            "data_source_config": request.config,
            "vector_store_config": request.vector_store_config,
            "chunk_settings": request.chunk_settings,
            "embedding_model": request.embedding_model,
            "embedding_provider": request.embedding_provider,
            "embedding_config": request.embedding_config,
            "execution_mode": request.execution_mode,
            "max_workers": request.max_workers,
        },
    }
    jobs_store.create(job_id, job_data)

    # Callback to update progress
    def update_progress(docs, chunks):
        update_data = {
            "documents_processed": docs,
            "chunks_created": chunks,
            "last_update": datetime.now(timezone.utc).isoformat(),
        }
        jobs_store.update(job_id, update_data)

    # Callback to set total documents
    def set_total(total):
        jobs_store.update(job_id, {"total_documents": total})
        logger.info(f"Job {job_id} - Total documents to process: {total}")

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
        progress_callback=update_progress,
        total_callback=set_total,
    )

    def run_job():
        """Run the ingestion job and update job status."""
        try:
            logger.info(f"Starting ingestion job {job_id}")
            result = orchestrator.run()
            logger.info(f"Job {job_id} completed successfully")
            jobs_store.update(
                job_id,
                {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "last_update": datetime.now(timezone.utc).isoformat(),
                    "documents_processed": result.get("documents", 0),
                    "chunks_created": result.get("chunks", 0),
                },
            )

            # Calculate average speeds
            try:
                job = jobs_store.get(job_id)
                if job:
                    start_time = datetime.fromisoformat(job["started_at"])
                    end_time = datetime.now(timezone.utc)
                    elapsed_seconds = (end_time - start_time).total_seconds()

                    if elapsed_seconds > 0:
                        docs_per_second = result.get("documents", 0) / elapsed_seconds
                        chunks_per_second = result.get("chunks", 0) / elapsed_seconds

                        jobs_store.update(
                            job_id,
                            {
                                "avg_docs_per_second": round(docs_per_second, 2),
                                "avg_chunks_per_second": round(chunks_per_second, 2),
                            },
                        )
                        logger.info(
                            f"Job {job_id} completed - Avg: {docs_per_second:.2f} docs/s, {chunks_per_second:.2f} chunks/s"
                        )
            except Exception as e:
                logger.warning(f"Could not calculate average speeds: {e}")
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)
            jobs_store.update(
                job_id,
                {
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "last_update": datetime.now(timezone.utc).isoformat(),
                    "error": str(e),
                },
            )
        finally:
            # Cleanup thread tracking
            if job_id in active_threads:
                del active_threads[job_id]

    # Run ingestion as FastAPI background task (non-blocking, managed by uvicorn)
    background_tasks.add_task(run_job)

    logger.info(f"Job {job_id} added to background tasks queue")

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
    jobs_list = jobs_store.list()
    # Sort by started_at descending
    jobs_list.sort(key=lambda x: x.get("started_at", ""), reverse=True)
    return {"jobs": jobs_list}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get details of a specific ingestion job."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: str, background_tasks: BackgroundTasks):
    """Retry a failed or completed ingestion job with the same configuration."""
    # Get original job
    original_job = jobs_store.get(job_id)
    if not original_job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Only allow retry for failed or completed jobs
    if original_job.get("status") == "running":
        raise HTTPException(status_code=400, detail="Cannot retry a running job")

    # Try to get configuration from job, or fallback to data source
    config = original_job.get("config")

    if not config:
        # Old job without config stored - try to get from data source
        from ...api.routes.sources import sources_store

        data_sources = sources_store.load()
        # Search by type (plugin_id) since old jobs store plugin type, not source id
        data_source = next(
            (s for s in data_sources if s.get("type") == original_job["data_source_id"]), None
        )

        if not data_source:
            raise HTTPException(
                status_code=400,
                detail="Job configuration not found and no data source of this type exists. Cannot retry.",
            )

        # Build minimal config from available data
        config = {
            "data_source_config": data_source.get("config", {}),
            "vector_store_config": {},  # Will need defaults
            "chunk_settings": {
                "chunk_size": 512,
                "chunk_overlap": 50,
                "splitter_type": "character",
            },
            "embedding_model": "all-MiniLM-L6-v2",
            "embedding_provider": "huggingface",
            "embedding_config": {},
            "execution_mode": "sequential",
            "max_workers": 4,
        }

    # Reconstruct adapters
    plugin_class: Any = DATA_SOURCE_PLUGINS.get(original_job["data_source_id"])
    if not plugin_class:
        raise HTTPException(
            status_code=400, detail=f"Plugin {original_job['data_source_id']} not supported"
        )

    data_source_adapter = plugin_class(config["data_source_config"])

    vs_class: Any = VECTOR_STORE_PLUGINS.get(original_job["vector_store_id"])
    if not vs_class:
        raise HTTPException(
            status_code=400, detail=f"Vector store {original_job['vector_store_id']} not supported"
        )

    vector_store = vs_class(config["vector_store_config"])

    # Create new job
    new_job_id = str(uuid.uuid4())
    job_data = {
        "id": new_job_id,
        "status": "running",
        "data_source_id": original_job["data_source_id"],
        "vector_store_id": original_job["vector_store_id"],
        "index_name": original_job["index_name"],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "last_update": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "documents_processed": 0,
        "chunks_created": 0,
        "error": None,
        "retried_from": job_id,
        "config": config,  # Copy config for future retries
    }
    jobs_store.create(new_job_id, job_data)

    # Callback to update progress
    def update_retry_progress(docs, chunks):
        update_data = {
            "documents_processed": docs,
            "chunks_created": chunks,
            "last_update": datetime.now(timezone.utc).isoformat(),
        }
        jobs_store.update(new_job_id, update_data)

    # Callback to set total documents
    def set_retry_total(total):
        jobs_store.update(new_job_id, {"total_documents": total})
        logger.info(f"Retry job {new_job_id} - Total documents to process: {total}")

    # Create orchestrator
    chunk_config = ChunkConfig(**config["chunk_settings"])
    orchestrator = IngestionOrchestrator(
        data_source=data_source_adapter,
        vector_store=vector_store,
        chunk_config=chunk_config,
        index_name=original_job["index_name"],
        embedding_model=config["embedding_model"],
        embedding_provider=config["embedding_provider"],
        embedding_config=config["embedding_config"],
        execution_mode=config["execution_mode"],
        max_workers=config["max_workers"],
        progress_callback=update_retry_progress,
        total_callback=set_retry_total,
    )

    def run_retry_job():
        """Run the retry job."""
        try:
            logger.info(f"Starting retry job {new_job_id} (original: {job_id})")
            result = orchestrator.run()
            logger.info(f"Retry job {new_job_id} completed successfully")
            jobs_store.update(
                new_job_id,
                {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "last_update": datetime.now(timezone.utc).isoformat(),
                    "documents_processed": result.get("documents", 0),
                    "chunks_created": result.get("chunks", 0),
                },
            )

            # Calculate average speeds
            try:
                job = jobs_store.get(new_job_id)
                if job:
                    start_time = datetime.fromisoformat(job["started_at"])
                    end_time = datetime.now(timezone.utc)
                    elapsed_seconds = (end_time - start_time).total_seconds()

                    if elapsed_seconds > 0:
                        docs_per_second = result.get("documents", 0) / elapsed_seconds
                        chunks_per_second = result.get("chunks", 0) / elapsed_seconds

                        jobs_store.update(
                            new_job_id,
                            {
                                "avg_docs_per_second": round(docs_per_second, 2),
                                "avg_chunks_per_second": round(chunks_per_second, 2),
                            },
                        )
                        logger.info(
                            f"Retry job {new_job_id} completed - Avg: {docs_per_second:.2f} docs/s, {chunks_per_second:.2f} chunks/s"
                        )
            except Exception as e:
                logger.warning(f"Could not calculate average speeds: {e}")
        except Exception as e:
            logger.error(f"Retry job {new_job_id} failed: {e}", exc_info=True)
            jobs_store.update(
                new_job_id,
                {
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "last_update": datetime.now(timezone.utc).isoformat(),
                    "error": str(e),
                },
            )
        finally:
            if new_job_id in active_threads:
                del active_threads[new_job_id]

    # Run retry job in background
    background_tasks.add_task(run_retry_job)

    logger.info(f"Retry job {new_job_id} created from original job {job_id}")

    return {
        "status": "success",
        "message": "Job retry initiated",
        "original_job_id": job_id,
        "new_job_id": new_job_id,
    }


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running ingestion job."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("status") != "running":
        raise HTTPException(status_code=400, detail="Only running jobs can be cancelled")

    # Update job status to failed with cancellation message
    jobs_store.update(
        job_id,
        {
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": "Job cancelled by user",
        },
    )

    # Clean up thread if exists
    if job_id in active_threads:
        del active_threads[job_id]

    logger.info(f"Job {job_id} cancelled by user")

    return {
        "status": "success",
        "message": "Job cancelled successfully",
        "job_id": job_id,
    }


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete an ingestion job."""
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Only allow deletion of non-running jobs
    if job.get("status") == "running":
        raise HTTPException(status_code=400, detail="Cannot delete a running job. Cancel it first.")

    # Delete the job
    jobs_store.delete(job_id)

    logger.info(f"Job {job_id} deleted")

    return {
        "status": "success",
        "message": "Job deleted successfully",
        "job_id": job_id,
    }


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

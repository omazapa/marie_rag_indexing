"""Ingestion orchestration endpoints."""

import threading
import uuid
from datetime import datetime
from typing import Any

from flask import Blueprint, Response, jsonify, request

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

ingestion_bp = Blueprint("ingestion", __name__)

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


@ingestion_bp.route("/ingest", methods=["POST"])
def trigger_ingestion():
    """Trigger an ingestion job."""
    data = request.json
    plugin_id = data.get("plugin_id")
    config = data.get("config", {})
    chunk_settings = data.get("chunk_settings", {})
    vector_store_id = data.get("vector_store", "opensearch")
    vector_store_config = data.get("vector_store_config", {})
    index_name = data.get("index_name", "default_index")
    embedding_model = data.get("embedding_model", "all-MiniLM-L6-v2")
    embedding_provider = data.get("embedding_provider", "huggingface")
    embedding_config = data.get("embedding_config", {})
    execution_mode = data.get("execution_mode", "sequential")
    max_workers = data.get("max_workers", 4)

    # Data Source Adapter Selection
    plugin_class: Any = DATA_SOURCE_PLUGINS.get(plugin_id)
    if not plugin_class:
        return (
            jsonify({"status": "error", "message": f"Plugin {plugin_id} not supported"}),
            400,
        )
    data_source = plugin_class(config)

    # Vector Store Adapter Selection
    vs_class: Any = VECTOR_STORE_PLUGINS.get(vector_store_id)
    if not vs_class:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"Vector store {vector_store_id} not supported",
                }
            ),
            400,
        )
    vector_store = vs_class(vector_store_config)

    # Create job record
    job_id = str(uuid.uuid4())
    ingestion_jobs[job_id] = {
        "id": job_id,
        "status": "running",
        "plugin_id": plugin_id,
        "index_name": index_name,
        "vector_store": vector_store_id,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "documents_processed": 0,
        "chunks_created": 0,
        "error": None,
    }

    chunk_config = ChunkConfig(**chunk_settings)
    orchestrator = IngestionOrchestrator(
        data_source=data_source,
        vector_store=vector_store,
        chunk_config=chunk_config,
        index_name=index_name,
        embedding_model=embedding_model,
        embedding_provider=embedding_provider,
        embedding_config=embedding_config,
        execution_mode=execution_mode,
        max_workers=max_workers,
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

    return (
        jsonify(
            {
                "status": "success",
                "message": "Ingestion started",
                "job_id": job_id,
                "vector_store": vector_store_id,
            }
        ),
        200,
    )


@ingestion_bp.route("/ingest/logs", methods=["GET"])
def get_ingestion_logs():
    """Stream ingestion logs via Server-Sent Events."""
    q = log_manager.subscribe()
    return Response(stream_logs(q), mimetype="text/event-stream")


@ingestion_bp.route("/jobs", methods=["GET"])
def get_jobs():
    """Get all ingestion jobs."""
    jobs_list = list(ingestion_jobs.values())
    # Sort by started_at descending
    jobs_list.sort(key=lambda x: x["started_at"], reverse=True)
    return jsonify({"jobs": jobs_list}), 200


@ingestion_bp.route("/jobs/<job_id>", methods=["GET"])
def get_job(job_id):
    """Get details of a specific ingestion job."""
    job = ingestion_jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job), 200


@ingestion_bp.route("/assistant/connector", methods=["POST"])
def assistant_connector():
    """Use AI assistant to suggest connector configuration."""
    data = request.json
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Missing prompt"}), 400

    # Try to find an Ollama model to use for the assistant
    ollama_url = "http://localhost:11434"
    assistant_model = "llama3"
    for m in embedding_models:
        if m["provider"] == "ollama":
            ollama_url = m.get("config", {}).get("base_url", ollama_url)
            assistant_model = m.get("model", assistant_model)
            break

    assistant = ConnectorAssistant(ollama_url=ollama_url, model=assistant_model)
    suggestion = assistant.suggest_connector(prompt)
    return jsonify(suggestion), 200

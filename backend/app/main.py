import threading
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Hexagonal Architecture Imports
from .infrastructure.adapters.data_sources.local_file import LocalFileAdapter
from .infrastructure.adapters.data_sources.mongodb import MongoDBAdapter
from .infrastructure.adapters.data_sources.s3 import S3Adapter
from .infrastructure.adapters.data_sources.sql import SQLAdapter
from .infrastructure.adapters.data_sources.web_scraper import WebScraperAdapter
from .infrastructure.adapters.data_sources.google_drive import GoogleDriveAdapter

from .infrastructure.adapters.vector_stores.opensearch import OpenSearchAdapter
from .infrastructure.adapters.vector_stores.pinecone import PineconeAdapter
from .infrastructure.adapters.vector_stores.qdrant import QdrantAdapter
from .infrastructure.adapters.vector_stores.milvus import MilvusAdapter
from .infrastructure.adapters.vector_stores.pgvector import PGVectorAdapter
from .application.services.orchestrator import IngestionOrchestrator
from .application.services.chunking import ChunkConfig
from .infrastructure.logging.log_manager import log_manager, stream_logs
from .infrastructure.external_apis.model_search import search_huggingface_models, search_ollama_models
from .application.services.assistant import ConnectorAssistant

from pymongo import MongoClient

load_dotenv()

# In-memory storage for demo purposes
data_sources = [
    {"id": "1", "name": "Local Docs", "type": "local_file", "status": "active", "lastRun": "2025-12-23 10:00", "config": {"path": "./docs"}},
]

embedding_models = [
    {"id": "1", "name": "MiniLM (Local)", "provider": "huggingface", "model": "all-MiniLM-L6-v2", "status": "active", "config": {}},
    {"id": "2", "name": "Llama 3 (Ollama)", "provider": "ollama", "model": "llama3", "status": "active", "config": {"base_url": "http://localhost:11434"}},
]

def create_app():
    app = Flask(__name__)
    CORS(app)

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy", "service": "marie-rag-indexing-api"}), 200

    @app.route('/api/v1/plugins', methods=['GET'])
    def list_plugins():
        return jsonify({
            "plugins": [
                {"id": "local_file", "name": "Local File System"},
                {"id": "s3", "name": "S3 / MinIO"},
                {"id": "mongodb", "name": "MongoDB"},
                {"id": "sql", "name": "SQL Database"},
                {"id": "web_scraper", "name": "Web Scraper"},
                {"id": "google_drive", "name": "Google Drive"}
            ]
        }), 200

    @app.route('/api/v1/vector_stores', methods=['GET'])
    def list_vector_stores():
        return jsonify({
            "vector_stores": [
                {"id": "opensearch", "name": "OpenSearch"},
                {"id": "pinecone", "name": "Pinecone"},
                {"id": "qdrant", "name": "Qdrant"},
                {"id": "milvus", "name": "Milvus"},
                {"id": "pgvector", "name": "PostgreSQL (pgvector)"}
            ]
        }), 200

    @app.route('/api/v1/mongodb/databases', methods=['GET'])
    def get_mongodb_databases():
        conn_str = request.args.get("connection_string")
        if not conn_str:
            return jsonify({"error": "Missing connection string"}), 400
        try:
            client = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
            # The ismaster command is cheap and does not require special privileges.
            client.admin.command('ismaster')
            dbs = client.list_database_names()
            return jsonify({"databases": dbs}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/mongodb/collections', methods=['GET'])
    def list_mongodb_collections():
        conn_str = request.args.get("connection_string")
        db_name = request.args.get("database")
        if not conn_str or not db_name:
            return jsonify({"error": "Missing connection_string or database"}), 400
        try:
            client = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
            db = client[db_name]
            collections = db.list_collection_names()
            return jsonify({"collections": collections}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/mongodb/schema', methods=['GET'])
    def get_mongodb_schema():
        conn_str = request.args.get("connection_string")
        db_name = request.args.get("database")
        coll_name = request.args.get("collection")
        if not conn_str or not db_name or not coll_name:
            return jsonify({"error": "Missing parameters"}), 400
        try:
            client = MongoClient(conn_str, serverSelectionTimeoutMS=5000)
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
                        # Unify array path with dot notation to avoid duplicate tree branches
                        paths.extend(flatten_schema(value[0], f"{full_path}."))
                return paths

            schema = flatten_schema(sample)
            return jsonify({"schema": schema, "sample": str(sample)}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/sources', methods=['GET'])
    def get_sources():
        return jsonify({"sources": data_sources}), 200

    @app.route('/api/v1/assistant/connector', methods=['POST'])
    def assistant_connector():
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

    @app.route('/api/v1/models', methods=['GET'])
    def get_models():
        return jsonify({"models": embedding_models}), 200

    @app.route('/api/v1/models/search', methods=['GET'])
    def search_models():
        provider = request.args.get("provider", "huggingface")
        query = request.args.get("query", "")
        
        if not query:
            return jsonify({"results": []}), 200
            
        if provider == "huggingface":
            results = search_huggingface_models(query)
        elif provider == "ollama":
            # Try to get base_url from existing ollama models if any
            base_url = "http://localhost:11434"
            for m in embedding_models:
                if m["provider"] == "ollama":
                    base_url = m.get("config", {}).get("base_url", base_url)
                    break
            results = search_ollama_models(query, base_url)
        else:
            return jsonify({"error": "Unsupported provider"}), 400
            
        return jsonify({"results": results}), 200

    @app.route('/api/v1/models', methods=['POST'])
    def add_model():
        data = request.json
        new_model = {
            "id": str(len(embedding_models) + 1),
            "name": data.get("name"),
            "provider": data.get("provider"),
            "model": data.get("model"),
            "status": "active",
            "config": data.get("config", {})
        }
        embedding_models.append(new_model)
        return jsonify(new_model), 201

    @app.route('/api/v1/models/<model_id>', methods=['DELETE'])
    def delete_model(model_id):
        global embedding_models
        embedding_models = [m for m in embedding_models if m['id'] != model_id]
        return jsonify({"status": "success"}), 200

    @app.route('/api/v1/stats', methods=['GET'])
    def get_stats():
        return jsonify({
            "total_documents": 1250, # Mock for now
            "active_sources": len([s for s in data_sources if s['status'] == 'active']),
            "last_ingestion": "2025-12-23 10:00",
            "recent_jobs": [
                {"id": "job_1", "source": "Local Docs", "status": "completed", "time": "2 hours ago"},
                {"id": "job_2", "source": "Company Wiki", "status": "failed", "time": "5 hours ago"},
            ]
        }), 200

    @app.route('/api/v1/sources', methods=['POST'])
    def add_source():
        data = request.json
        new_source = {
            "id": str(len(data_sources) + 1),
            "name": data.get("name"),
            "type": data.get("type"),
            "status": "inactive",
            "lastRun": "N/A",
            "config": data.get("config", {})
        }
        data_sources.append(new_source)
        return jsonify(new_source), 201

    @app.route('/api/v1/ingest/logs', methods=['GET'])
    def get_ingestion_logs():
        q = log_manager.subscribe()
        return Response(stream_logs(q), mimetype='text/event-stream')

    @app.route('/api/v1/ingest', methods=['POST'])
    def trigger_ingestion():
        data = request.json
        plugin_id = data.get("plugin_id")
        config = data.get("config", {})
        chunk_settings = data.get("chunk_settings", {})
        vector_store_id = data.get("vector_store", "opensearch")
        index_name = data.get("index_name", "default_index")
        embedding_model = data.get("embedding_model", "all-MiniLM-L6-v2")
        embedding_provider = data.get("embedding_provider", "huggingface")
        embedding_config = data.get("embedding_config", {})
        execution_mode = data.get("execution_mode", "sequential")
        max_workers = data.get("max_workers", 4)

        # Data Source Adapter Selection
        if plugin_id == "local_file":
            data_source = LocalFileAdapter(config)
        elif plugin_id == "s3":
            data_source = S3Adapter(config)
        elif plugin_id == "mongodb":
            data_source = MongoDBAdapter(config)
        elif plugin_id == "sql":
            data_source = SQLAdapter(config)
        elif plugin_id == "web_scraper":
            data_source = WebScraperAdapter(config)
        elif plugin_id == "google_drive":
            data_source = GoogleDriveAdapter(config)
        else:
            return jsonify({"status": "error", "message": f"Plugin {plugin_id} not supported"}), 400

        # Vector Store Adapter Selection
        if vector_store_id == "opensearch":
            vector_store = OpenSearchAdapter()
        elif vector_store_id == "pinecone":
            vector_store = PineconeAdapter()
        elif vector_store_id == "qdrant":
            vector_store = QdrantAdapter()
        elif vector_store_id == "milvus":
            vector_store = MilvusAdapter()
        elif vector_store_id == "pgvector":
            vector_store = PGVectorAdapter()
        else:
            return jsonify({"status": "error", "message": f"Vector store {vector_store_id} not supported"}), 400

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
            max_workers=max_workers
        )
        
        # Run ingestion in a background thread
        thread = threading.Thread(target=orchestrator.run)
        thread.start()
        
        return jsonify({"status": "success", "message": "Ingestion started", "vector_store": vector_store_id}), 200

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)

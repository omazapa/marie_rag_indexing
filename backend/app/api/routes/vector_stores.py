"""Vector store management endpoints."""

from typing import Any

from flask import Blueprint, jsonify, request

from ...infrastructure.adapters.vector_stores.milvus import MilvusAdapter
from ...infrastructure.adapters.vector_stores.opensearch import OpenSearchAdapter
from ...infrastructure.adapters.vector_stores.pgvector import PGVectorAdapter
from ...infrastructure.adapters.vector_stores.pinecone import PineconeAdapter
from ...infrastructure.adapters.vector_stores.qdrant import QdrantAdapter

vector_stores_bp = Blueprint("vector_stores", __name__)

VECTOR_STORE_PLUGINS = {
    "opensearch": OpenSearchAdapter,
    "pinecone": PineconeAdapter,
    "qdrant": QdrantAdapter,
    "milvus": MilvusAdapter,
    "pgvector": PGVectorAdapter,
}


@vector_stores_bp.route("/vector_stores", methods=["GET"])
def list_vector_stores():
    """List all available vector store options."""
    return jsonify(
        {
            "vector_stores": [
                {"id": "opensearch", "name": "OpenSearch"},
                {"id": "pinecone", "name": "Pinecone"},
                {"id": "qdrant", "name": "Qdrant"},
                {"id": "milvus", "name": "Milvus"},
                {"id": "pgvector", "name": "PostgreSQL (pgvector)"},
            ]
        }
    ), 200


@vector_stores_bp.route("/vector_stores/<vs_id>/schema", methods=["GET"])
def get_vector_store_schema(vs_id):
    """Get configuration schema for a specific vector store."""
    vs_class = VECTOR_STORE_PLUGINS.get(vs_id)
    if not vs_class:
        return jsonify({"error": "Vector store not found"}), 404
    try:
        return jsonify(vs_class.get_config_schema()), 200
    except NotImplementedError:
        return jsonify({"error": "Schema not implemented for this vector store"}), 501


@vector_stores_bp.route("/indices", methods=["GET"])
def list_indices():
    """List all indices in the selected vector store."""
    vector_store_id = request.args.get("vector_store", "opensearch")
    adapter: Any
    if vector_store_id == "opensearch":
        adapter = OpenSearchAdapter()
    elif vector_store_id == "pinecone":
        adapter = PineconeAdapter()
    else:
        return jsonify({"indices": []}), 200

    try:
        indices = adapter.list_indices()
        return jsonify({"indices": indices}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@vector_stores_bp.route("/indices/<index_name>", methods=["DELETE"])
def delete_index(index_name):
    """Delete an index from the selected vector store."""
    vector_store_id = request.args.get("vector_store", "opensearch")
    adapter: Any
    if vector_store_id == "opensearch":
        adapter = OpenSearchAdapter()
    elif vector_store_id == "pinecone":
        adapter = PineconeAdapter()
    else:
        return jsonify({"error": "Unsupported vector store"}), 400

    try:
        adapter.delete_index(index_name)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

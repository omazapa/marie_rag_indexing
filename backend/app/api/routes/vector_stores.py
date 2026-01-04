"""Vector store management endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ...infrastructure.adapters.vector_stores.milvus import MilvusAdapter
from ...infrastructure.adapters.vector_stores.opensearch import OpenSearchAdapter
from ...infrastructure.adapters.vector_stores.pgvector import PGVectorAdapter
from ...infrastructure.adapters.vector_stores.pinecone import PineconeAdapter
from ...infrastructure.adapters.vector_stores.qdrant import QdrantAdapter

router = APIRouter()

VECTOR_STORE_PLUGINS = {
    "opensearch": OpenSearchAdapter,
    "pinecone": PineconeAdapter,
    "qdrant": QdrantAdapter,
    "milvus": MilvusAdapter,
    "pgvector": PGVectorAdapter,
}


@router.get("/vector_stores")
async def list_vector_stores():
    """List all available vector store options."""
    return {
        "vector_stores": [
            {"id": "opensearch", "name": "OpenSearch"},
            {"id": "pinecone", "name": "Pinecone"},
            {"id": "qdrant", "name": "Qdrant"},
            {"id": "milvus", "name": "Milvus"},
            {"id": "pgvector", "name": "PostgreSQL (pgvector)"},
        ]
    }


@router.get("/vector_stores/{vs_id}/schema")
async def get_vector_store_schema(vs_id: str):
    """Get configuration schema for a specific vector store."""
    vs_class = VECTOR_STORE_PLUGINS.get(vs_id)
    if not vs_class:
        raise HTTPException(status_code=404, detail="Vector store not found")
    try:
        return vs_class.get_config_schema()
    except NotImplementedError:
        raise HTTPException(
            status_code=501, detail="Schema not implemented for this vector store"
        ) from None


@router.get("/indices")
async def list_indices(vector_store: str = Query("opensearch")):
    """List all indices in the selected vector store."""
    adapter: Any
    if vector_store == "opensearch":
        adapter = OpenSearchAdapter()
    elif vector_store == "pinecone":
        adapter = PineconeAdapter()
    else:
        return {"indices": []}

    try:
        indices = adapter.list_indices()
        return {"indices": indices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/indices/{index_name}")
async def delete_index(index_name: str, vector_store: str = Query("opensearch")):
    """Delete an index from the selected vector store."""
    adapter: Any
    if vector_store == "opensearch":
        adapter = OpenSearchAdapter()
    elif vector_store == "pinecone":
        adapter = PineconeAdapter()
    else:
        raise HTTPException(status_code=400, detail="Unsupported vector store")

    try:
        adapter.delete_index(index_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

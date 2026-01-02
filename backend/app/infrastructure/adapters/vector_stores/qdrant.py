from qdrant_client import QdrantClient
from qdrant_client.http import models
from typing import List, Dict, Any, Optional
import os
from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk

class QdrantAdapter(VectorStorePort):
    """
    Adapter for Qdrant vector store.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        url = self.config.get("url") or os.getenv("QDRANT_URL", "http://localhost:6333")
        api_key = self.config.get("api_key") or os.getenv("QDRANT_API_KEY")
        self.client = QdrantClient(url=url, api_key=api_key)

    def create_index(self, index_name: str, dimension: int = 384, body: Optional[Dict[str, Any]] = None):
        collections = self.client.get_collections().collections
        exists = any(c.name == index_name for c in collections)
        
        if not exists:
            self.client.create_collection(
                collection_name=index_name,
                vectors_config=models.VectorParams(size=dimension, distance=models.Distance.COSINE),
            )
        return True

    def index_chunks(self, index_name: str, chunks: List[Chunk]):
        points = []
        for chunk in chunks:
            points.append(models.PointStruct(
                id=chunk.chunk_id,
                vector=chunk.embedding,
                payload={
                    "content": chunk.content,
                    "source_id": chunk.source_id,
                    **chunk.metadata
                }
            ))
        
        self.client.upsert(
            collection_name=index_name,
            points=points
        )
        return len(chunks), 0

    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
        # Qdrant can store metadata in a separate collection
        pass

    def get_checkpoint(self, source_id: str) -> Optional[Dict[str, Any]]:
        return None

    def search(self, index_name: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        search_result = self.client.search(
            collection_name=index_name,
            query_vector=query_vector,
            limit=k,
            query_filter=filters # This needs to be a Qdrant Filter object if provided
        )
        
        formatted_results = []
        for hit in search_result:
            formatted_results.append({
                "content": hit.payload.get('content', ''),
                "metadata": {k: v for k, v in hit.payload.items() if k != 'content'},
                "embedding": hit.vector,
                "source_id": hit.payload.get('source_id', ''),
                "chunk_id": str(hit.id)
            })
        return formatted_results

    def list_indices(self) -> List[Dict[str, Any]]:
        collections = self.client.get_collections().collections
        return [{"name": c.name, "status": "active", "documents": "N/A", "size": "N/A"} for c in collections]

    def delete_index(self, index_name: str) -> bool:
        self.client.delete_collection(collection_name=index_name)
        return True

    @staticmethod
    def get_config_schema() -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "title": "Qdrant URL",
                    "description": "URL of the Qdrant server",
                    "default": "http://localhost:6333"
                },
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Qdrant API Key (optional)",
                    "default": ""
                }
            },
            "required": ["url"]
        }

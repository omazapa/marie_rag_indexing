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
    
    def __init__(self):
        url = os.getenv("QDRANT_URL", "http://localhost:6333")
        api_key = os.getenv("QDRANT_API_KEY")
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

    def hybrid_search(self, index_name: str, query_text: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return self.search(index_name, query_vector, k, filters)

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
        return []

    def delete_index(self, index_name: str) -> bool:
        return True

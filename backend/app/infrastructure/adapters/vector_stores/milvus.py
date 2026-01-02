from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility
from typing import List, Dict, Any, Optional
import os
from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk

class MilvusAdapter(VectorStorePort):
    """
    Adapter for Milvus vector store.
    """
    
    def __init__(self):
        host = os.getenv("MILVUS_HOST", "localhost")
        port = os.getenv("MILVUS_PORT", "19530")
        connections.connect("default", host=host, port=port)

    def create_index(self, index_name: str, dimension: int = 384, body: Optional[Dict[str, Any]] = None):
        if not utility.has_collection(index_name):
            fields = [
                FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, is_primary=True, auto_id=False, max_length=100),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=dimension),
                FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="source_id", dtype=DataType.VARCHAR, max_length=100),
                FieldSchema(name="metadata", dtype=DataType.JSON)
            ]
            schema = CollectionSchema(fields, "Marie RAG Indexing Collection")
            collection = Collection(index_name, schema)
            
            # Create index for vector field
            index_params = {
                "metric_type": "L2",
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128}
            }
            collection.create_index("embedding", index_params)
        return True

    def index_chunks(self, index_name: str, chunks: List[Chunk]):
        collection = Collection(index_name)
        
        data = [
            [chunk.chunk_id for chunk in chunks],
            [chunk.embedding for chunk in chunks],
            [chunk.content for chunk in chunks],
            [chunk.source_id for chunk in chunks],
            [chunk.metadata for chunk in chunks]
        ]
        
        collection.insert(data)
        collection.flush()
        return len(chunks), 0

    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
        pass

    def get_checkpoint(self, source_id: str) -> Optional[Dict[str, Any]]:
        return None

    def hybrid_search(self, index_name: str, query_text: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return self.search(index_name, query_vector, k, filters)

    def search(self, index_name: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        collection = Collection(index_name)
        collection.load()
        
        search_params = {"metric_type": "L2", "params": {"nprobe": 10}}
        
        results = collection.search(
            data=[query_vector],
            anns_field="embedding",
            param=search_params,
            limit=k,
            expr=None, # Milvus uses boolean expressions for filtering
            output_fields=["content", "source_id", "metadata"]
        )
        
        formatted_results = []
        for hits in results:
            for hit in hits:
                formatted_results.append({
                    "content": hit.entity.get('content'),
                    "metadata": hit.entity.get('metadata'),
                    "embedding": None, # Milvus doesn't return vectors by default in search
                    "source_id": hit.entity.get('source_id'),
                    "chunk_id": hit.id
                })
        return formatted_results
    def list_indices(self) -> List[Dict[str, Any]]:
        return []

    def delete_index(self, index_name: str) -> bool:
        return True

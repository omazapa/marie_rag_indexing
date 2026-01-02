from pinecone import Pinecone, ServerlessSpec
from typing import List, Dict, Any, Optional
import os
import time
from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk

class PineconeAdapter(VectorStorePort):
    """
    Adapter for Pinecone vector store.
    """
    
    def __init__(self):
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise ValueError("PINECONE_API_KEY environment variable is not set")
        
        self.pc = Pinecone(api_key=api_key)
        self.index = None

    def create_index(self, index_name: str, dimension: int = 384, body: Optional[Dict[str, Any]] = None):
        if index_name not in self.pc.list_indexes().names():
            spec = ServerlessSpec(
                cloud=os.getenv("PINECONE_CLOUD", "aws"),
                region=os.getenv("PINECONE_REGION", "us-east-1")
            )
            
            self.pc.create_index(
                name=index_name,
                dimension=dimension,
                metric='cosine',
                spec=spec
            )
            
            # Wait for index to be ready
            while not self.pc.describe_index(index_name).status['ready']:
                time.sleep(1)
        
        self.index = self.pc.Index(index_name)
        return True

    def index_chunks(self, index_name: str, chunks: List[Chunk]):
        if not self.index:
            self.index = self.pc.Index(index_name)
            
        vectors = []
        for chunk in chunks:
            vectors.append({
                "id": chunk.chunk_id,
                "values": chunk.embedding,
                "metadata": {
                    "content": chunk.content,
                    "source_id": chunk.source_id,
                    **chunk.metadata
                }
            })
        
        # Pinecone upsert in batches if needed, but for now simple
        self.index.upsert(vectors=vectors)
        return len(chunks), 0

    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
        # Pinecone is not ideal for state management, but we can use a separate index or metadata
        # For now, we'll assume state is managed elsewhere or use a dedicated 'checkpoints' index
        pass

    def get_checkpoint(self, source_id: str) -> Optional[Dict[str, Any]]:
        return None

    def search(self, index_name: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if not self.index:
            self.index = self.pc.Index(index_name)
            
        results = self.index.query(
            vector=query_vector,
            top_k=k,
            include_metadata=True,
            filter=filters
        )
        
        formatted_results = []
        for match in results['matches']:
            formatted_results.append({
                "content": match['metadata'].get('content', ''),
                "metadata": {k: v for k, v in match['metadata'].items() if k != 'content'},
                "embedding": match.get('values'),
                "source_id": match['metadata'].get('source_id', ''),
                "chunk_id": match['id']
            })
        return formatted_results

    def hybrid_search(self, index_name: str, query_text: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        # Pinecone supports hybrid search with sparse-dense vectors, but for now fallback to vector search
        return self.search(index_name, query_vector, k, filters)

    def list_indices(self) -> List[Dict[str, Any]]:
        indexes = self.pc.list_indexes().names()
        return [{"name": name, "status": "active", "documents": "N/A", "size": "N/A"} for name in indexes]

    def delete_index(self, index_name: str) -> bool:
        self.pc.delete_index(index_name)
        return True

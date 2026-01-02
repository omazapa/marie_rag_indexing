from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from ...domain.models import Chunk

class VectorStorePort(ABC):
    """
    Port for vector database adapters.
    """
    
    @abstractmethod
    def create_index(self, index_name: str, dimension: int = 384, body: Optional[Dict[str, Any]] = None):
        """Creates an index if it doesn't exist."""
        pass

    @abstractmethod
    def index_chunks(self, index_name: str, chunks: List[Chunk]):
        """Indexes chunks into the vector store."""
        pass

    @abstractmethod
    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
        """Saves the ingestion state for a source."""
        pass

    @abstractmethod
    def get_checkpoint(self, source_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves the ingestion state for a source."""
        pass

    @abstractmethod
    def search(self, index_name: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Performs a vector search in the index."""
        pass

    @abstractmethod
    def hybrid_search(self, index_name: str, query_text: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Performs a hybrid search (k-NN + BM25) in the index."""
        pass

    @abstractmethod
    def list_indices(self) -> List[Dict[str, Any]]:
        """Lists all indices/collections in the vector store."""
        pass

    @abstractmethod
    def delete_index(self, index_name: str) -> bool:
        """Deletes an index/collection."""
        pass

    @staticmethod
    @abstractmethod
    def get_config_schema() -> Dict[str, Any]:
        """Return the JSON schema for the vector store configuration."""
        pass

    @staticmethod
    @abstractmethod
    def get_config_schema() -> Dict[str, Any]:
        """Return the JSON schema for the vector store configuration."""
        pass

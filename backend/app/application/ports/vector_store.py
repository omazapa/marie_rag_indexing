from abc import ABC, abstractmethod
from typing import Any

from ...domain.models import Chunk


class VectorStorePort(ABC):
    """
    Port for vector database adapters.
    """

    @abstractmethod
    def create_index(
        self, index_name: str, dimension: int = 384, body: dict[str, Any] | None = None
    ):
        """Creates an index if it doesn't exist."""
        pass

    @abstractmethod
    def index_chunks(self, index_name: str, chunks: list[Chunk]):
        """Indexes chunks into the vector store."""
        pass

    @abstractmethod
    def save_checkpoint(self, source_id: str, state: dict[str, Any]):
        """Saves the ingestion state for a source."""
        pass

    @abstractmethod
    def get_checkpoint(self, source_id: str) -> dict[str, Any] | None:
        """Retrieves the ingestion state for a source."""
        pass

    @abstractmethod
    def search(
        self,
        index_name: str,
        query_vector: list[float],
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Performs a vector search in the index."""
        pass

    @abstractmethod
    def hybrid_search(
        self,
        index_name: str,
        query_text: str,
        query_vector: list[float],
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Performs a hybrid search (k-NN + BM25) in the index."""
        pass

    @abstractmethod
    def list_indices(self) -> list[dict[str, Any]]:
        """Lists all indices/collections in the vector store."""
        pass

    @abstractmethod
    def delete_index(self, index_name: str) -> bool:
        """Deletes an index/collection."""
        pass

    @staticmethod
    @abstractmethod
    def get_config_schema() -> dict[str, Any]:
        """Return the JSON schema for the vector store configuration."""
        pass

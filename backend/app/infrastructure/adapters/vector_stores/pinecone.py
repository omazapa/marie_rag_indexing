import os
import time
from typing import Any

from pinecone import Pinecone, ServerlessSpec

from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk


class PineconeAdapter(VectorStorePort):
    """
    Adapter for Pinecone vector store.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        api_key = self.config.get("api_key") or os.getenv("PINECONE_API_KEY")
        self.pc: Pinecone | None = None
        if api_key:
            self.pc = Pinecone(api_key=api_key)
        self.index: Any = None

    def create_index(
        self, index_name: str, dimension: int = 384, body: dict[str, Any] | None = None
    ):
        if not self.pc:
            raise ValueError("Pinecone API key not configured")

        assert self.pc is not None

        if index_name not in self.pc.list_indexes().names():
            cloud = self.config.get("cloud") or os.getenv("PINECONE_CLOUD", "aws")
            region = self.config.get("region") or os.getenv("PINECONE_REGION", "us-east-1")
            spec = ServerlessSpec(cloud=cloud, region=region)  # type: ignore

            self.pc.create_index(name=index_name, dimension=dimension, metric="cosine", spec=spec)

            # Wait for index to be ready
            while not self.pc.describe_index(index_name).status["ready"]:
                time.sleep(1)

        self.index = self.pc.Index(index_name)
        return True

    def index_chunks(self, index_name: str, chunks: list[Chunk]):
        if not self.pc:
            raise ValueError("Pinecone API key not configured")
        if not self.index:
            self.index = self.pc.Index(index_name)

        vectors = []
        for chunk in chunks:
            vectors.append(
                {
                    "id": chunk.chunk_id,
                    "values": chunk.embedding,
                    "metadata": {
                        "content": chunk.content,
                        "source_id": chunk.source_id,
                        **chunk.metadata,
                    },
                }
            )

        # Pinecone upsert in batches if needed, but for now simple
        self.index.upsert(vectors=vectors)  # type: ignore
        return len(chunks), 0

    def save_checkpoint(self, source_id: str, state: dict[str, Any]):
        # Pinecone is not ideal for state management, but we can use a separate index or metadata
        # For now, we'll assume state is managed elsewhere or use a dedicated 'checkpoints' index
        pass

    def get_checkpoint(self, source_id: str) -> dict[str, Any] | None:
        return None

    def search(
        self,
        index_name: str,
        query_vector: list[float],
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        if not self.pc:
            raise ValueError("Pinecone API key not configured")
        if not self.index:
            self.index = self.pc.Index(index_name)

        results = self.index.query(  # type: ignore
            vector=query_vector,
            top_k=k,
            include_metadata=True,
            filter=filters,
        )

        formatted_results = []
        for match in results["matches"]:
            formatted_results.append(
                {
                    "content": match["metadata"].get("content", ""),
                    "metadata": {k: v for k, v in match["metadata"].items() if k != "content"},
                    "embedding": match.get("values"),
                    "source_id": match["metadata"].get("source_id", ""),
                    "chunk_id": match["id"],
                }
            )
        return formatted_results

    def hybrid_search(
        self,
        index_name: str,
        query_text: str,
        query_vector: list[float],
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        # Pinecone supports hybrid search with sparse-dense vectors,
        # but for now fallback to vector search
        return self.search(index_name, query_vector, k, filters)

    def list_indices(self) -> list[dict[str, Any]]:
        if not self.pc:
            return []
        indexes = self.pc.list_indexes().names()
        return [
            {"name": name, "status": "active", "documents": "N/A", "size": "N/A"}
            for name in indexes
        ]

    def delete_index(self, index_name: str) -> bool:
        if not self.pc:
            return False
        if index_name in self.pc.list_indexes().names():
            self.pc.delete_index(index_name)
            return True
        return False

    @staticmethod
    def get_config_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Pinecone API Key",
                },
                "cloud": {
                    "type": "string",
                    "title": "Cloud Provider",
                    "description": "Cloud provider (aws, gcp, azure)",
                    "default": "aws",
                },
                "region": {
                    "type": "string",
                    "title": "Region",
                    "description": "Pinecone region (e.g., us-east-1)",
                    "default": "us-east-1",
                },
            },
            "required": ["api_key"],
        }

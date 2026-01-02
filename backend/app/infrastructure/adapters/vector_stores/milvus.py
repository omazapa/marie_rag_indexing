import os
from typing import Any

from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, connections, utility

from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk


class MilvusAdapter(VectorStorePort):
    """
    Adapter for Milvus vector store.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        host = self.config.get("host") or os.getenv("MILVUS_HOST", "localhost")
        port = self.config.get("port") or os.getenv("MILVUS_PORT", "19530")
        connections.connect("default", host=host, port=port)

    def create_index(
        self, index_name: str, dimension: int = 384, body: dict[str, Any] | None = None
    ):
        if not utility.has_collection(index_name):
            fields = [
                FieldSchema(
                    name="chunk_id",
                    dtype=DataType.VARCHAR,
                    is_primary=True,
                    auto_id=False,
                    max_length=100,
                ),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=dimension),
                FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="source_id", dtype=DataType.VARCHAR, max_length=100),
                FieldSchema(name="metadata", dtype=DataType.JSON),
            ]
            schema = CollectionSchema(fields, "Marie RAG Indexing Collection")
            collection = Collection(index_name, schema)

            # Create index for vector field
            index_params = {"metric_type": "L2", "index_type": "IVF_FLAT", "params": {"nlist": 128}}
            collection.create_index("embedding", index_params)
        return True

    def index_chunks(self, index_name: str, chunks: list[Chunk]):
        collection = Collection(index_name)

        data = [
            [chunk.chunk_id for chunk in chunks],
            [chunk.embedding for chunk in chunks],
            [chunk.content for chunk in chunks],
            [chunk.source_id for chunk in chunks],
            [chunk.metadata for chunk in chunks],
        ]

        collection.insert(data)
        collection.flush()
        return len(chunks), 0

    def save_checkpoint(self, source_id: str, state: dict[str, Any]):
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
        collection = Collection(index_name)
        collection.load()

        search_params = {"metric_type": "L2", "params": {"nprobe": 10}}

        results = collection.search(
            data=[query_vector],
            anns_field="embedding",
            param=search_params,
            limit=k,
            expr=None,  # Milvus uses boolean expressions for filtering
            output_fields=["content", "source_id", "metadata"],
        )

        formatted_results = []
        for hits in results:
            for hit in hits:
                formatted_results.append(
                    {
                        "content": hit.entity.get("content"),
                        "metadata": hit.entity.get("metadata"),
                        "embedding": None,  # Milvus doesn't return vectors by default in search
                        "source_id": hit.entity.get("source_id"),
                        "chunk_id": hit.id,
                    }
                )
        return formatted_results

    def list_indices(self) -> list[dict[str, Any]]:
        collections = utility.list_collections()
        return [
            {"name": name, "status": "active", "documents": "N/A", "size": "N/A"}
            for name in collections
        ]

    def delete_index(self, index_name: str) -> bool:
        utility.drop_collection(index_name)
        return True

    @staticmethod
    def get_config_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "host": {
                    "type": "string",
                    "title": "Milvus Host",
                    "description": "Host of the Milvus server",
                    "default": "localhost",
                },
                "port": {
                    "type": "string",
                    "title": "Milvus Port",
                    "description": "Port of the Milvus server",
                    "default": "19530",
                },
            },
            "required": ["host", "port"],
        }

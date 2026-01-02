import os
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Column, String, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk

Base = declarative_base()


class PGChunk(Base):
    __tablename__ = "chunks"

    chunk_id = Column(String(100), primary_key=True)
    content = Column(Text)
    embedding = Column(Vector(384))  # Default dimension
    source_id = Column(String(100))
    metadata_json = Column(JSON)
    index_name = Column(String(100), index=True)


class PGVectorAdapter(VectorStorePort):
    """
    Adapter for PostgreSQL with pgvector extension.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        db_url = self.config.get("connection_string") or os.getenv(
            "DATABASE_URL", "postgresql://user:pass@localhost:5432/db"
        )
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)

        # Create extension if not exists
        with self.engine.connect() as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            conn.commit()

    def create_index(
        self, index_name: str, dimension: int = 384, body: dict[str, Any] | None = None
    ):
        # Update dimension if needed (this is a bit tricky with SQLAlchemy models)
        # For now, we assume the table is created with the correct dimension
        Base.metadata.create_all(self.engine)
        return True

    def index_chunks(self, index_name: str, chunks: list[Chunk]):
        session = self.Session()
        try:
            for chunk in chunks:
                pg_chunk = PGChunk(
                    chunk_id=chunk.chunk_id,
                    content=chunk.content,
                    embedding=chunk.embedding,
                    source_id=chunk.source_id,
                    metadata_json=chunk.metadata,
                    index_name=index_name,
                )
                session.merge(pg_chunk)
            session.commit()
            return len(chunks), 0
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def save_checkpoint(self, source_id: str, state: dict[str, Any]):
        pass

    def get_checkpoint(self, source_id: str) -> dict[str, Any] | None:
        return None

    def hybrid_search(
        self,
        index_name: str,
        query_text: str,
        query_vector: list[float],
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        return self.search(index_name, query_vector, k, filters)

    def search(
        self,
        index_name: str,
        query_vector: list[float],
        k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        session = self.Session()
        try:
            # Basic vector similarity search
            query = session.query(PGChunk).filter(PGChunk.index_name == index_name)

            # Apply filters if provided (simple metadata filtering)
            if filters:
                for key, value in filters.items():
                    query = query.filter(PGChunk.metadata_json[key].astext == str(value))

            results = query.order_by(PGChunk.embedding.l2_distance(query_vector)).limit(k).all()

            formatted_results = []
            for res in results:
                formatted_results.append(
                    {
                        "content": res.content,
                        "metadata": res.metadata_json,
                        "embedding": res.embedding,
                        "source_id": res.source_id,
                        "chunk_id": res.chunk_id,
                    }
                )
            return formatted_results
        finally:
            session.close()

    def list_indices(self) -> list[dict[str, Any]]:
        session = self.Session()
        try:
            indices = session.query(PGChunk.index_name).distinct().all()
            return [
                {"name": name[0], "status": "active", "documents": "N/A", "size": "N/A"}
                for name in indices
            ]
        finally:
            session.close()

    def delete_index(self, index_name: str) -> bool:
        session = self.Session()
        try:
            session.query(PGChunk).filter(PGChunk.index_name == index_name).delete()
            session.commit()
            return True
        finally:
            session.close()

    @staticmethod
    def get_config_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "connection_string": {
                    "type": "string",
                    "title": "Connection String",
                    "description": "PostgreSQL connection string (e.g., postgresql://user:pass@localhost:5432/db)",
                    "default": "postgresql://user:pass@localhost:5432/db",
                }
            },
            "required": ["connection_string"],
        }

from sqlalchemy import create_engine, Column, String, JSON, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector
from typing import List, Dict, Any, Optional
import os
from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk

Base = declarative_base()

class PGChunk(Base):
    __tablename__ = 'chunks'
    
    chunk_id = Column(String(100), primary_key=True)
    content = Column(Text)
    embedding = Column(Vector(384)) # Default dimension
    source_id = Column(String(100))
    metadata_json = Column(JSON)
    index_name = Column(String(100), index=True)

class PGVectorAdapter(VectorStorePort):
    """
    Adapter for PostgreSQL with pgvector extension.
    """
    
    def __init__(self):
        db_url = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # Create extension if not exists
        with self.engine.connect() as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            conn.commit()

    def create_index(self, index_name: str, dimension: int = 384, body: Optional[Dict[str, Any]] = None):
        # Update dimension if needed (this is a bit tricky with SQLAlchemy models)
        # For now, we assume the table is created with the correct dimension
        Base.metadata.create_all(self.engine)
        return True

    def index_chunks(self, index_name: str, chunks: List[Chunk]):
        session = self.Session()
        try:
            for chunk in chunks:
                pg_chunk = PGChunk(
                    chunk_id=chunk.chunk_id,
                    content=chunk.content,
                    embedding=chunk.embedding,
                    source_id=chunk.source_id,
                    metadata_json=chunk.metadata,
                    index_name=index_name
                )
                session.merge(pg_chunk)
            session.commit()
            return len(chunks), 0
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
        pass

    def get_checkpoint(self, source_id: str) -> Optional[Dict[str, Any]]:
        return None

    def search(self, index_name: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
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
                formatted_results.append({
                    "content": res.content,
                    "metadata": res.metadata_json,
                    "embedding": res.embedding,
                    "source_id": res.source_id,
                    "chunk_id": res.chunk_id
                })
            return formatted_results
        finally:
            session.close()

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from ...domain.models import Chunk, Document
from ..ports.data_source import DataSourcePort
from ..ports.vector_store import VectorStorePort
from .chunking import ChunkConfig, ChunkingEngine
from .embeddings import EmbeddingEngine


class IngestionOrchestrator:
    """
    Orchestrates the ingestion process: Load -> Chunk -> Embed -> Index.
    """

    def __init__(
        self,
        data_source: DataSourcePort,
        vector_store: VectorStorePort,
        chunk_config: ChunkConfig,
        index_name: str,
        embedding_model: str = "all-MiniLM-L6-v2",
        embedding_provider: str = "huggingface",
        embedding_config: dict[str, Any] | None = None,
        execution_mode: str = "sequential",
        max_workers: int = 4,
    ):
        self.data_source = data_source
        self.vector_store = vector_store
        self.chunking_engine = ChunkingEngine(chunk_config)
        self.embedding_engine = EmbeddingEngine(
            model_name=embedding_model, provider=embedding_provider, config=embedding_config
        )
        self.index_name = index_name
        self.execution_mode = execution_mode
        self.max_workers = max_workers

        # Ensure index exists with correct dimension
        self.vector_store.create_index(self.index_name, dimension=self.embedding_engine.dimension)

    def _process_document(self, doc: Document) -> int:
        """Processes a single document and returns the number of chunks indexed."""
        try:
            # 2. Chunk document
            raw_chunks = self.chunking_engine.split_text(doc.content, metadata=doc.metadata)

            # 3. Generate embeddings
            texts = [c["content"] for c in raw_chunks]
            if not texts:
                return 0

            embeddings = self.embedding_engine.embed_text(texts)
            if (
                isinstance(embeddings, list)
                and len(embeddings) > 0
                and not isinstance(embeddings[0], list)
            ):
                # Single embedding returned for multiple texts?
                # Should not happen with embed_text(list)
                embeddings = [embeddings]  # type: ignore

            # 4. Prepare for indexing
            chunks_to_index = []
            for i, raw_chunk in enumerate(raw_chunks):
                chunks_to_index.append(
                    Chunk(
                        content=raw_chunk["content"],
                        metadata=raw_chunk["metadata"],
                        embedding=embeddings[i],  # type: ignore
                        source_id=doc.source_id,
                        chunk_id=str(uuid.uuid4()),
                    )
                )

            # 5. Index in Vector Store
            if chunks_to_index:
                success, failed = self.vector_store.index_chunks(self.index_name, chunks_to_index)
                source_name = doc.metadata.get("source", "unknown")
                msg = f"Indexed {success} chunks from {source_name}. Failed: {failed}"
                logging.info(msg)
                return int(success)
            return 0
        except Exception as e:
            msg = f"Error processing document {doc.metadata.get('source', 'unknown')}: {e!s}"
            logging.error(msg)
            return 0

    def run(self):
        """
        Executes the full ingestion pipeline.
        """
        msg = (
            f"Starting ingestion for source: {self.data_source.plugin_id} "
            f"(Mode: {self.execution_mode})"
        )
        logging.info(msg)

        doc_count = 0
        chunk_count = 0
        try:
            if self.execution_mode == "parallel":
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    futures = []
                    for doc in self.data_source.load_data():
                        doc_count += 1
                        futures.append(executor.submit(self._process_document, doc))

                    for future in futures:
                        chunk_count += future.result()
            else:
                for doc in self.data_source.load_data():
                    doc_count += 1
                    chunk_count += self._process_document(doc)

            # Finalize
            msg = (
                f"Ingestion completed for source: {self.data_source.plugin_id}. "
                f"Total documents: {doc_count}, Total chunks: {chunk_count}"
            )
            logging.info(msg)
            return {"documents": doc_count, "chunks": chunk_count}
        except Exception as e:
            logging.error(f"Ingestion failed: {e!s}")
            return {"error": str(e)}

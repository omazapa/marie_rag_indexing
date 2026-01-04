import logging
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from ...domain.models import Chunk, Document
from ...infrastructure.logging.log_manager import LogManagerHandler
from ..ports.data_source import DataSourcePort
from ..ports.vector_store import VectorStorePort
from .chunking import ChunkConfig, ChunkingEngine
from .embeddings import EmbeddingEngine

# Setup logger with LogManagerHandler
logger = logging.getLogger(__name__)
if not any(isinstance(h, LogManagerHandler) for h in logger.handlers):
    handler = LogManagerHandler()
    handler.setLevel(logging.DEBUG)  # Capture DEBUG and above
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False  # Don't propagate to root logger


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
        progress_callback=None,
        total_callback=None,
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
        self.progress_callback = progress_callback
        self.total_callback = total_callback

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
                logger.info(msg)
                return int(success)
            return 0
        except Exception as e:
            msg = f"Error processing document {doc.metadata.get('source', 'unknown')}: {e!s}"
            logger.error(msg)
            return 0

    def run(self):
        """
        Executes the full ingestion pipeline.
        """
        msg = (
            f"Starting ingestion for source: {self.data_source.plugin_id} "
            f"(Mode: {self.execution_mode})"
        )
        logger.info(msg)

        # Try to get total document count from data source if available
        total_docs = None
        if hasattr(self.data_source, "get_document_count"):
            try:
                total_docs = self.data_source.get_document_count()
                if total_docs and self.total_callback:
                    self.total_callback(total_docs)
                    logger.info(f"Total documents to process: {total_docs}")
            except Exception as e:
                logger.warning(f"Could not get document count: {e}")

        doc_count = 0
        chunk_count = 0
        try:
            if self.execution_mode == "parallel":
                # Parallel mode with streaming - processes documents as they come from cursor
                logger.info(
                    f"🚀 Starting parallel processing with {self.max_workers} workers (streaming mode)"
                )

                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    futures_to_doc_num = {}

                    # Iterate over cursor directly without buffering
                    for doc in self.data_source.load_data():
                        doc_count += 1

                        # Submit document for processing
                        future = executor.submit(self._process_document, doc)
                        futures_to_doc_num[future] = doc_count

                        # Log queueing progress every 100 documents
                        if doc_count % 100 == 0:
                            logger.info(f"📄 Queued {doc_count} documents...")

                        # Wait for some futures to complete if queue is too large
                        # This prevents memory buildup while keeping cursor alive
                        while len(futures_to_doc_num) >= self.max_workers * 2:
                            # Process first completed future
                            done_future = next(as_completed(futures_to_doc_num.keys()))
                            chunks = done_future.result()
                            chunk_count += chunks
                            completed_doc_num = futures_to_doc_num.pop(done_future)

                            # Update progress
                            if self.progress_callback:
                                self.progress_callback(completed_doc_num, chunk_count)

                            # Log every 10 documents
                            if completed_doc_num % 10 == 0:
                                logger.info(
                                    f"📊 Documents Processed: {completed_doc_num}\nChunks Created: {chunk_count}"
                                )

                    # Process remaining futures after cursor exhausted
                    logger.info(f"⏳ Processing remaining {len(futures_to_doc_num)} documents...")
                    for future in as_completed(futures_to_doc_num.keys()):
                        chunks = future.result()
                        chunk_count += chunks
                        completed_doc_num = futures_to_doc_num.pop(future)

                        # Update progress
                        if self.progress_callback:
                            self.progress_callback(completed_doc_num, chunk_count)

                        # Log every 10 documents
                        if completed_doc_num % 10 == 0:
                            logger.info(
                                f"📊 Documents Processed: {completed_doc_num}\nChunks Created: {chunk_count}"
                            )

                    logger.info(
                        f"✅ Parallel processing completed: {doc_count} documents, {chunk_count} chunks"
                    )
            else:
                for doc in self.data_source.load_data():
                    doc_count += 1
                    chunks = self._process_document(doc)
                    chunk_count += chunks

                    # Update progress every document
                    if self.progress_callback:
                        self.progress_callback(doc_count, chunk_count)

                    # Log progress every 5 documents
                    if doc_count % 5 == 0:
                        logger.info(
                            f"📊 Documents Processed: {doc_count}\nChunks Created: {chunk_count}"
                        )

            # Finalize
            msg = (
                f"✨ Ingestion completed for source: {self.data_source.plugin_id}. "
                f"Total documents: {doc_count}, Total chunks: {chunk_count}"
            )
            logger.info(msg)
            return {"documents": doc_count, "chunks": chunk_count}
        except Exception as e:
            logger.error(f"❌ Ingestion failed: {e!s}")
            return {"error": str(e)}

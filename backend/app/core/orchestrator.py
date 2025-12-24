from typing import Dict, Any, List
from ..plugins.base import BasePlugin, Document
from .chunking import ChunkingEngine, ChunkConfig
from .embeddings import EmbeddingEngine
from .opensearch_client import OpenSearchClient
from .logs import log_manager
import logging
from concurrent.futures import ThreadPoolExecutor

class IngestionOrchestrator:
    """
    Orchestrates the ingestion process: Load -> Chunk -> Embed -> Index.
    """
    
    def __init__(self, plugin: BasePlugin, chunk_config: ChunkConfig, index_name: str, 
                 embedding_model: str = "all-MiniLM-L6-v2", 
                 embedding_provider: str = "huggingface",
                 embedding_config: Dict[str, Any] = None,
                 execution_mode: str = "sequential", 
                 max_workers: int = 4):
        self.plugin = plugin
        self.chunking_engine = ChunkingEngine(chunk_config)
        self.embedding_engine = EmbeddingEngine(
            model_name=embedding_model, 
            provider=embedding_provider, 
            config=embedding_config
        )
        self.os_client = OpenSearchClient()
        self.index_name = index_name
        self.execution_mode = execution_mode
        self.max_workers = max_workers
        
        # Ensure index exists with correct dimension
        self.os_client.create_index(self.index_name, dimension=self.embedding_engine.dimension)

    def _process_document(self, doc: Document) -> int:
        """Processes a single document and returns the number of chunks indexed."""
        try:
            # 2. Chunk document
            chunks = self.chunking_engine.split_text(doc.content, metadata=doc.metadata)
            
            # 3. Generate embeddings
            texts = [c["content"] for c in chunks]
            if not texts:
                return 0
                
            embeddings = self.embedding_engine.embed_text(texts)
            
            # 4. Prepare for indexing
            docs_to_index = []
            for i, chunk in enumerate(chunks):
                docs_to_index.append({
                    "content": chunk["content"],
                    "embedding": embeddings[i],
                    "metadata": chunk["metadata"]
                })
            
            # 5. Index in OpenSearch
            if docs_to_index:
                success, failed = self.os_client.index_documents(self.index_name, docs_to_index)
                msg = f"Indexed {success} chunks from {doc.metadata.get('source', 'unknown')}. Failed: {failed}"
                logging.info(msg)
                log_manager.log(msg)
                return success
            return 0
        except Exception as e:
            msg = f"Error processing document {doc.metadata.get('source', 'unknown')}: {str(e)}"
            logging.error(msg)
            log_manager.log(msg, level="ERROR")
            return 0

    def run(self):
        """
        Executes the full ingestion pipeline.
        """
        msg = f"Starting ingestion for source: {self.plugin.plugin_id} (Mode: {self.execution_mode})"
        logging.info(msg)
        log_manager.log(msg)
        
        doc_count = 0
        chunk_count = 0
        try:
            if self.execution_mode == "parallel":
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    # We consume the generator and submit tasks
                    futures = []
                    for doc in self.plugin.load_data():
                        doc_count += 1
                        futures.append(executor.submit(self._process_document, doc))
                    
                    for future in futures:
                        chunk_count += future.result()
            else:
                for doc in self.plugin.load_data():
                    doc_count += 1
                    chunk_count += self._process_document(doc)
            
            # Finalize
            msg = f"Ingestion completed for source: {self.plugin.plugin_id}. Total documents: {doc_count}, Total chunks: {chunk_count}"
            logging.info(msg)
            log_manager.log(msg)
                    
            # Save checkpoint
            self.os_client.save_checkpoint(self.plugin.plugin_id, {"status": "completed", "doc_count": doc_count})
        except Exception as e:
            error_msg = f"Error during ingestion: {str(e)}"
            logging.error(error_msg)
            log_manager.log(error_msg, level="ERROR")
            raise e

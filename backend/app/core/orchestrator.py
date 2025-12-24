from typing import Dict, Any, List
from ..plugins.base import BasePlugin
from .chunking import ChunkingEngine, ChunkConfig
from .opensearch_client import OpenSearchClient
from .logs import log_manager
import logging

class IngestionOrchestrator:
    """
    Orchestrates the ingestion process: Load -> Chunk -> Embed -> Index.
    """
    
    def __init__(self, plugin: BasePlugin, chunk_config: ChunkConfig, index_name: str):
        self.plugin = plugin
        self.chunking_engine = ChunkingEngine(chunk_config)
        self.os_client = OpenSearchClient()
        self.index_name = index_name
        
        # Ensure index exists
        self.os_client.create_index(self.index_name)

    def run(self):
        """
        Executes the full ingestion pipeline.
        """
        msg = f"Starting ingestion for source: {self.plugin.plugin_id}"
        logging.info(msg)
        log_manager.log(msg)
        
        # 1. Load data from plugin
        docs = self.plugin.load_data()
        msg = f"Fetched {len(docs)} documents from {self.plugin.plugin_id}"
        logging.info(msg)
        log_manager.log(msg)

        for doc in docs:
            # 2. Chunk document
            chunks = self.chunking_engine.split_text(doc.content, metadata=doc.metadata)
            
            # 3. Prepare for indexing (Embedding step would go here)
            docs_to_index = []
            for chunk in chunks:
                docs_to_index.append({
                    "content": chunk["content"],
                    "metadata": chunk["metadata"]
                })
            
            # 4. Index in OpenSearch
            if docs_to_index:
                success, failed = self.os_client.index_documents(self.index_name, docs_to_index)
                msg = f"Indexed {success} chunks from {doc.metadata.get('source', 'unknown')}. Failed: {failed}"
                logging.info(msg)
                log_manager.log(msg)
                
        # 5. Save checkpoint (simplified)
        self.os_client.save_checkpoint(self.plugin.plugin_id, {"status": "completed"})
        msg = "Ingestion completed successfully."
        logging.info(msg)
        log_manager.log(msg)

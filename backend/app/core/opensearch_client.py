from opensearchpy import OpenSearch, helpers
from typing import List, Dict, Any
import os
import logging

class OpenSearchClient:
    """
    Client to interact with OpenSearch for indexing and state management.
    """
    
    def __init__(self):
        url = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
        self.auth = (os.getenv("OPENSEARCH_USER", "admin"), os.getenv("OPENSEARCH_PASSWORD", "admin"))
        
        self.client = OpenSearch(
            hosts=[url],
            http_compress=True,
            http_auth=self.auth,
            use_ssl=False,  # Set to True in production
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False
        )

    def create_index(self, index_name: str, body: Dict[str, Any] = None):
        """Creates an index if it doesn't exist."""
        if not self.client.indices.exists(index=index_name):
            if not body:
                # Default hybrid index settings
                body = {
                    "settings": {
                        "index": {
                            "knn": True,
                            "knn.algo_param.ef_search": 100
                        }
                    },
                    "mappings": {
                        "properties": {
                            "content": {"type": "text"},
                            "embedding": {
                                "type": "knn_vector",
                                "dimension": 1536,  # Default for OpenAI, adjust as needed
                                "method": {
                                    "name": "hnsw",
                                    "space_type": "l2",
                                    "engine": "nmslib"
                                }
                            },
                            "metadata": {"type": "object"}
                        }
                    }
                }
            self.client.indices.create(index=index_name, body=body)
            return True
        return False

    def index_documents(self, index_name: str, documents: List[Dict[str, Any]]):
        """Bulk indexes documents."""
        actions = [
            {
                "_index": index_name,
                "_source": doc
            }
            for doc in documents
        ]
        success, failed = helpers.bulk(self.client, actions)
        return success, failed

    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
        """Saves the ingestion state for a source."""
        index_name = "ingestion_checkpoints"
        self.create_index(index_name, body={
            "mappings": {
                "properties": {
                    "source_id": {"type": "keyword"},
                    "last_processed": {"type": "date"},
                    "state": {"type": "object"}
                }
            }
        })
        
        self.client.index(
            index=index_name,
            id=source_id,
            body={
                "source_id": source_id,
                "state": state
            },
            refresh=True
        )

    def get_checkpoint(self, source_id: str) -> Dict[str, Any]:
        """Retrieves the ingestion state for a source."""
        index_name = "ingestion_checkpoints"
        try:
            response = self.client.get(index=index_name, id=source_id)
            return response["_source"]["state"]
        except Exception:
            return None

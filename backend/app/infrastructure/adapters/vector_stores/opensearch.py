from opensearchpy import OpenSearch, helpers
from typing import List, Dict, Any, Optional
import os
from ...application.ports.vector_store import VectorStorePort
from ...domain.models import Chunk

class OpenSearchAdapter(VectorStorePort):
    """
    Adapter for OpenSearch vector store.
    """
    
    def __init__(self):
        url = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
        self.auth = (os.getenv("OPENSEARCH_USER", "admin"), os.getenv("OPENSEARCH_PASSWORD", "admin"))
        
        self.client = OpenSearch(
            hosts=[url],
            http_compress=True,
            http_auth=self.auth,
            use_ssl=False,
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False
        )

    def create_index(self, index_name: str, dimension: int = 384, body: Optional[Dict[str, Any]] = None):
        if not self.client.indices.exists(index=index_name):
            if not body:
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
                                "dimension": dimension,
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

    def index_chunks(self, index_name: str, chunks: List[Chunk]):
        actions = [
            {
                "_index": index_name,
                "_source": chunk.dict()
            }
            for chunk in chunks
        ]
        success, failed = helpers.bulk(self.client, actions)
        return success, failed

    def save_checkpoint(self, source_id: str, state: Dict[str, Any]):
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

    def get_checkpoint(self, source_id: str) -> Optional[Dict[str, Any]]:
        index_name = "ingestion_checkpoints"
        try:
            response = self.client.get(index=index_name, id=source_id)
            return response["_source"]["state"]
        except Exception:
            return None

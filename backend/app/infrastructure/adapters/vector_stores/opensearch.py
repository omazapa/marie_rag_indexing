from opensearchpy import OpenSearch, helpers
from typing import List, Dict, Any, Optional
import os
from ....application.ports.vector_store import VectorStorePort
from ....domain.models import Chunk

class OpenSearchAdapter(VectorStorePort):
    """
    Adapter for OpenSearch vector store.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        url = self.config.get("url") or os.getenv("OPENSEARCH_URL", "http://localhost:9200")
        user = self.config.get("user") or os.getenv("OPENSEARCH_USER", "admin")
        password = self.config.get("password") or os.getenv("OPENSEARCH_PASSWORD", "admin")
        self.auth = (user, password)
        
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
                "_source": chunk.model_dump()
            }
            for chunk in chunks
        ]
        success, failed = helpers.bulk(self.client, actions, refresh=True)
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

    def search(self, index_name: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        query = {
            "size": k,
            "query": {
                "knn": {
                    "embedding": {
                        "vector": query_vector,
                        "k": k
                    }
                }
            }
        }
        
        if filters:
            # Simple term filtering for now
            filter_list = [{"term": {f"metadata.{key}": value}} for key, value in filters.items()]
            query["query"] = {
                "bool": {
                    "must": [
                        {"knn": {"embedding": {"vector": query_vector, "k": k}}}
                    ],
                    "filter": filter_list
                }
            }

        response = self.client.search(index=index_name, body=query)
        return [hit["_source"] for hit in response["hits"]["hits"]]

    def hybrid_search(self, index_name: str, query_text: str, query_vector: List[float], k: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        query = {
            "size": k,
            "query": {
                "bool": {
                    "should": [
                        {
                            "knn": {
                                "embedding": {
                                    "vector": query_vector,
                                    "k": k,
                                    "boost": 0.7
                                }
                            }
                        },
                        {
                            "match": {
                                "content": {
                                    "query": query_text,
                                    "boost": 0.3
                                }
                            }
                        }
                    ]
                }
            }
        }
        
        if filters:
            filter_list = [{"term": {f"metadata.{key}": value}} for key, value in filters.items()]
            query["query"]["bool"]["filter"] = filter_list

        response = self.client.search(index=index_name, body=query)
        return [hit["_source"] for hit in response["hits"]["hits"]]

    def list_indices(self) -> List[Dict[str, Any]]:
        indices = self.client.indices.get_alias().keys()
        result = []
        for index in indices:
            if index.startswith('.') or index == "ingestion_checkpoints":
                continue
            
            stats = self.client.indices.stats(index=index)
            count = stats['_all']['primaries']['docs']['count']
            size_bytes = stats['_all']['primaries']['store']['size_in_bytes']
            
            result.append({
                "name": index,
                "documents": count,
                "size": f"{size_bytes / 1024 / 1024:.2f} MB",
                "status": "active"
            })
        return result

    def delete_index(self, index_name: str) -> bool:
        if self.client.indices.exists(index=index_name):
            self.client.indices.delete(index=index_name)
            return True
        return False

    @staticmethod
    def get_config_schema() -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "title": "OpenSearch URL",
                    "description": "URL of the OpenSearch instance",
                    "default": "http://localhost:9200"
                },
                "user": {
                    "type": "string",
                    "title": "Username",
                    "description": "OpenSearch username",
                    "default": "admin"
                },
                "password": {
                    "type": "string",
                    "title": "Password",
                    "description": "OpenSearch password",
                    "default": "admin"
                }
            },
            "required": ["url"]
        }

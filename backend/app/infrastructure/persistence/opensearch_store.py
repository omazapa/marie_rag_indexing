"""OpenSearch-based configuration store."""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from opensearchpy import OpenSearch, exceptions

logger = logging.getLogger(__name__)


class OpenSearchStore:
    """Store for managing configuration in OpenSearch."""

    def __init__(self, index_name: str = "marie_rag_indexing_settings"):
        self.index_name = index_name
        self.client: OpenSearch | None = None
        self._ensure_index()

    def _get_client(self) -> OpenSearch:
        """Get or create OpenSearch client."""
        if self.client is None:
            import os

            # Parse OPENSEARCH_URL or use individual components
            opensearch_url = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
            
            # Parse URL
            from urllib.parse import urlparse
            parsed = urlparse(opensearch_url)
            
            host = parsed.hostname or "localhost"
            port = parsed.port or 9200
            use_ssl = parsed.scheme == "https"
            
            # Get auth from env
            username = os.getenv("OPENSEARCH_USER")
            password = os.getenv("OPENSEARCH_PASSWORD")
            
            http_auth = (username, password) if username and password else None

            self.client = OpenSearch(
                hosts=[{"host": host, "port": port}],
                http_auth=http_auth,
                use_ssl=use_ssl,
                verify_certs=False,
                ssl_show_warn=False,
            )
        return self.client

    def _ensure_index(self):
        """Ensure the settings index exists."""
        try:
            client = self._get_client()
            if not client.indices.exists(index=self.index_name):
                client.indices.create(
                    index=self.index_name,
                    body={
                        "mappings": {
                            "properties": {
                                "id": {"type": "keyword"},
                                "name": {"type": "text"},
                                "created_at": {"type": "date"},
                                "updated_at": {"type": "date"},
                            }
                        },
                        "settings": {
                            "number_of_shards": 1,
                            "number_of_replicas": 0,
                        },
                    },
                )
                logger.info(f"Created OpenSearch index: {self.index_name}")
        except Exception as e:
            logger.error(f"Could not create OpenSearch index: {e}")
            # Don't raise - allow app to start even if OpenSearch is not available

    def create(self, id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new document."""
        try:
            client = self._get_client()
            now = datetime.now(timezone.utc).isoformat()
            doc = {**data, "id": id, "created_at": now, "updated_at": now}

            client.index(index=self.index_name, id=id, body=doc, refresh=True)
            logger.info(f"Created document {id} in {self.index_name}")
            return doc
        except exceptions.ConnectionError as e:
            logger.error(f"OpenSearch connection error creating document {id}: {e}")
            raise HTTPException(
                status_code=503, detail="Storage service unavailable. Please check OpenSearch connection."
            )
        except Exception as e:
            logger.error(f"Error creating document {id}: {e}")
            raise HTTPException(status_code=500, detail=f"Error creating document: {str(e)}")

    def get(self, id: str) -> dict[str, Any] | None:
        """Get a document by ID."""
        try:
            client = self._get_client()
            response = client.get(index=self.index_name, id=id)
            return response["_source"]
        except exceptions.NotFoundError:
            return None
        except Exception as e:
            logger.error(f"Error getting document {id}: {e}")
            return None

    def update(self, id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """Update a document."""
        try:
            client = self._get_client()
            now = datetime.now(timezone.utc).isoformat()
            update_data = {**data, "updated_at": now}

            client.update(
                index=self.index_name,
                id=id,
                body={"doc": update_data},
                refresh=True,
            )
            logger.info(f"Updated document {id} in {self.index_name}")
            return self.get(id)
        except exceptions.NotFoundError:
            logger.warning(f"Document {id} not found for update")
            return None
        except Exception as e:
            logger.error(f"Error updating document {id}: {e}")
            return None

    def delete(self, id: str) -> bool:
        """Delete a document."""
        try:
            client = self._get_client()
            client.delete(index=self.index_name, id=id, refresh=True)
            logger.info(f"Deleted document {id} from {self.index_name}")
            return True
        except exceptions.NotFoundError:
            logger.warning(f"Document {id} not found for deletion")
            return False
        except Exception as e:
            logger.error(f"Error deleting document {id}: {e}")
            return False

    def list(self) -> list[dict[str, Any]]:
        """List all documents."""
        try:
            client = self._get_client()

            response = client.search(
                index=self.index_name,
                body={"query": {"match_all": {}}, "size": 1000, "sort": [{"created_at": "desc"}]},
            )
            return [hit["_source"] for hit in response["hits"]["hits"]]
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []

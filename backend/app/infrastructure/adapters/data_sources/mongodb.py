from collections.abc import Generator
from typing import Any

from pymongo import MongoClient

from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document


class MongoDBAdapter(DataSourcePort):
    """
    Adapter to ingest documents from a MongoDB collection.
    """

    @property
    def plugin_id(self) -> str:
        return "mongodb"

    @property
    def display_name(self) -> str:
        return "MongoDB"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.connection_string = config.get("connection_string")
        self.database_name = config.get("database")
        self.collection_name = config.get("collection")
        self.query_mode = config.get("query_mode", False)
        self.query = config.get("query", {})
        self.content_field = config.get("content_field", "text")
        self.metadata_fields = config.get("metadata_fields", [])

        if not self.connection_string:
            raise ValueError("connection_string is required for MongoDBAdapter")
        if not self.database_name:
            raise ValueError("database is required for MongoDBAdapter")

        self.client: MongoClient[Any] = MongoClient(self.connection_string)
        self.db = self.client[self.database_name]
        if self.collection_name:
            self.collection = self.db[self.collection_name]

    def validate_config(self) -> bool:
        return all([self.connection_string, self.database_name, self.collection_name])

    def test_connection(self) -> bool:
        try:
            self.client.admin.command("ping")
            return True
        except Exception:
            return False

    def load_data(self) -> Generator[Document, None, None]:
        if not hasattr(self, "collection"):
            return

        try:
            cursor: Any
            if self.query_mode:
                if isinstance(self.query, list):  # Aggregation pipeline
                    cursor = self.collection.aggregate(self.query)
                else:  # Find query
                    cursor = self.collection.find(self.query)
            else:
                cursor = self.collection.find({})

            def get_nested_value(doc, path):
                parts = path.split(".")
                current = doc
                for part in parts:
                    if isinstance(current, dict):
                        current = current.get(part)
                    else:
                        return None
                return current

            for item in cursor:
                content = get_nested_value(item, self.content_field)
                if not content:
                    continue

                metadata = {
                    "source": (
                        f"mongodb://{self.database_name}/{self.collection_name}/"
                        f"{item.get('_id', 'unknown')}"
                    ),
                    "id": str(item.get("_id", "")),
                }

                for field in self.metadata_fields:
                    val = get_nested_value(item, field)
                    if val is not None:
                        metadata[field] = val

                yield Document(
                    content=str(content), metadata=metadata, source_id=str(item.get("_id", ""))
                )
        except Exception as e:
            print(f"Error fetching data from MongoDB: {e}")

    @staticmethod
    def get_config_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "connection_string": {
                    "type": "string",
                    "title": "Connection URI",
                    "description": "Standard MongoDB connection string (e.g., mongodb://192.168.1.10:27017)",
                    "default": "mongodb://192.168.1.10:27017",
                },
                "database": {
                    "type": "string",
                    "title": "Database",
                    "description": "The name of the database to connect to",
                },
                "collection": {
                    "type": "string",
                    "title": "Collection",
                    "description": "The collection containing the documents",
                },
                "content_field": {
                    "type": "string",
                    "title": "Content Field",
                    "description": "Field with main text content (e.g., 'text', 'body')",
                    "default": "text",
                },
                "metadata_fields": {
                    "type": "array",
                    "title": "Metadata Fields",
                    "description": "Additional fields for metadata (e.g., ['author', 'date'])",
                    "items": {"type": "string"},
                    "default": [],
                },
                "query_mode": {
                    "type": "boolean",
                    "title": "Advanced Query Mode",
                    "description": "Enable to use a custom JSON query or aggregation pipeline",
                    "default": False,
                },
                "query": {
                    "type": "object",
                    "title": "Query / Pipeline",
                    "description": "A valid MongoDB find query {} or aggregation pipeline []",
                    "default": {},
                },
            },
            "required": ["connection_string", "database", "collection", "content_field"],
        }

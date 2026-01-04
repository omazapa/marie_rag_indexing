import logging
from collections.abc import Generator
from typing import Any

from pymongo import MongoClient

from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document
from ....infrastructure.logging.log_manager import LogManagerHandler

# Setup logger with LogManagerHandler
logger = logging.getLogger(__name__)
if not any(isinstance(h, LogManagerHandler) for h in logger.handlers):
    handler = LogManagerHandler()
    handler.setLevel(logging.DEBUG)
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False


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

        # Handle data_source_mode
        data_source_mode = config.get("data_source_mode")
        if data_source_mode == "custom_query":
            self.query_mode = True
            self.query = config.get("custom_query", {})
        else:
            self.query_mode = config.get("query_mode", False)
            self.query = config.get("query", {})

        # Support multiple content fields for vectorization
        self.content_fields = config.get("content_fields", [])
        if not self.content_fields:
            # Check for custom_content_fields (string with comma-separated values)
            custom_fields = config.get("custom_content_fields")
            if custom_fields and isinstance(custom_fields, str):
                self.content_fields = [f.strip() for f in custom_fields.split(",") if f.strip()]
            else:
                # Fallback to single content_field for backward compatibility
                single_field = config.get("content_field", "text")
                self.content_fields = [single_field] if single_field else []

        self.metadata_fields = config.get("metadata_fields", [])
        if not self.metadata_fields:
            # Check for custom_metadata_fields (string with comma-separated values)
            custom_meta = config.get("custom_metadata_fields")
            if custom_meta and isinstance(custom_meta, str):
                self.metadata_fields = [f.strip() for f in custom_meta.split(",") if f.strip()]

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

    def get_document_count(self) -> int:
        """Get total document count based on query."""
        if not hasattr(self, "collection"):
            return 0

        try:
            if self.query_mode:
                if isinstance(self.query, list):  # Aggregation pipeline
                    count_pipeline = self.query.copy()
                    count_pipeline.append({"$count": "total"})
                    count_result = list(self.collection.aggregate(count_pipeline))
                    return count_result[0]["total"] if count_result else 0
                else:  # Find query
                    return self.collection.count_documents(self.query)
            else:
                return self.collection.count_documents({})
        except Exception as e:
            logger.warning(f"MongoDB: Could not get document count: {e}")
            return 0

    def load_data(self) -> Generator[Document, None, None]:
        if not hasattr(self, "collection"):
            logger.warning("MongoDB: No collection configured")
            return

        try:
            logger.info(f"MongoDB: Starting data load from collection '{self.collection.name}'")
            logger.info(f"MongoDB: Query mode: {self.query_mode}, Query: {self.query}")
            logger.info(f"MongoDB: Content fields: {self.content_fields}")

            cursor: Any
            if self.query_mode:
                if isinstance(self.query, list):  # Aggregation pipeline
                    logger.info("MongoDB: Using aggregation pipeline")
                    cursor = self.collection.aggregate(self.query)
                else:  # Find query
                    logger.info("MongoDB: Using find query")
                    cursor = self.collection.find(self.query)
            else:
                logger.info("MongoDB: Loading all documents (no query)")
                cursor = self.collection.find({})

            doc_count = 0

            def get_nested_value(doc, path):
                """Extract value from nested path, handling arrays."""
                parts = path.split(".")
                current = doc
                for part in parts:
                    if isinstance(current, dict):
                        current = current.get(part)
                    elif isinstance(current, list):
                        # If it's a list, try to extract the field from all items
                        if part.isdigit():
                            # Specific index like titles.0.title
                            idx = int(part)
                            if idx < len(current):
                                current = current[idx]
                            else:
                                return None
                        else:
                            # Extract field from all items in array
                            # For example: titles.title will get all title fields from titles array
                            values = []
                            for item in current:
                                if isinstance(item, dict) and part in item:
                                    values.append(item[part])
                            if values:
                                return values  # Return list of values
                            return None
                    else:
                        return None
                return current

            for item in cursor:
                doc_count += 1
                # Collect content from all content_fields
                content_parts = []
                for field_path in self.content_fields:
                    field_value = get_nested_value(item, field_path)
                    if field_value:
                        # Handle list of values (e.g., from arrays)
                        if isinstance(field_value, list):
                            # Join all values from array
                            field_value = " | ".join(str(v) for v in field_value if v)
                        if field_value:
                            content_parts.append(f"{field_path}: {field_value}")

                if not content_parts:
                    if doc_count % 100 == 0:  # Log every 100 empty docs to avoid spam
                        logger.warning(
                            f"MongoDB: Document {doc_count} has no content in fields {self.content_fields}"
                        )
                    continue

                # Concatenate all content fields
                content = "\n\n".join(content_parts)

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
                    content=content, metadata=metadata, source_id=str(item.get("_id", ""))
                )

            logger.info(f"MongoDB: Finished loading data. Total documents yielded: {doc_count}")
        except Exception as e:
            logger.error(f"MongoDB: Error fetching data from MongoDB: {e}")
            raise

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

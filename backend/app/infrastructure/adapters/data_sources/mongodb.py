from pymongo import MongoClient
from typing import List, Dict, Any, Generator
from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document

class MongoDBAdapter(DataSourcePort):
    """
    Adapter to ingest documents from a MongoDB collection.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.connection_string = config.get("connection_string")
        self.database_name = config.get("database")
        self.collection_name = config.get("collection")
        self.query_mode = config.get("query_mode", False)
        self.query = config.get("query", {})
        self.content_field = config.get("content_field", "text")
        self.metadata_fields = config.get("metadata_fields", [])

        self.client = MongoClient(self.connection_string)
        self.db = self.client[self.database_name]
        if self.collection_name:
            self.collection = self.db[self.collection_name]

    def load_data(self) -> Generator[Document, None, None]:
        try:
            if self.query_mode:
                if isinstance(self.query, list): # Aggregation pipeline
                    cursor = self.collection.aggregate(self.query)
                else: # Find query
                    cursor = self.collection.find(self.query)
            else:
                cursor = self.collection.find({})

            def get_nested_value(doc, path):
                parts = path.split('.')
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
                    "source": f"mongodb://{self.database_name}/{self.collection_name}/{item.get('_id', 'unknown')}",
                    "id": str(item.get('_id', ''))
                }
                
                for field in self.metadata_fields:
                    val = get_nested_value(item, field)
                    if val is not None:
                        metadata[field] = val
                
                yield Document(
                    content=str(content),
                    metadata=metadata,
                    source_id=str(item.get('_id', ''))
                )
        except Exception as e:
            print(f"Error fetching data from MongoDB: {e}")
            
    def test_connection(self) -> bool:
        try:
            self.client.admin.command('ismaster')
            return True
        except:
            return False

    def validate_config(self) -> bool:
        return all([self.connection_string, self.database_name, self.collection_name])

    @staticmethod
    def get_config_schema() -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "connection_string": {
                    "type": "string",
                    "title": "Connection String",
                    "description": "MongoDB connection URI (e.g., mongodb://localhost:27017)",
                    "default": "mongodb://localhost:27017"
                },
                "database": {
                    "type": "string",
                    "title": "Database Name",
                    "description": "Name of the database to index"
                },
                "collection": {
                    "type": "string",
                    "title": "Collection Name",
                    "description": "Name of the collection to index"
                },
                "content_field": {
                    "type": "string",
                    "title": "Content Field",
                    "description": "Field containing the text to be vectorized",
                    "default": "text"
                },
                "metadata_fields": {
                    "type": "array",
                    "title": "Metadata Fields",
                    "description": "Fields to include as metadata",
                    "items": {"type": "string"},
                    "default": []
                },
                "query_mode": {
                    "type": "boolean",
                    "title": "Enable Custom Query",
                    "default": False
                },
                "query": {
                    "type": "object",
                    "title": "Custom Query/Pipeline",
                    "description": "JSON query or aggregation pipeline",
                    "default": {}
                }
            },
            "required": ["connection_string", "database", "collection", "content_field"]
        }

    @property
    def plugin_id(self) -> str:
        return "mongodb"

    @property
    def display_name(self) -> str:
        return "MongoDB"

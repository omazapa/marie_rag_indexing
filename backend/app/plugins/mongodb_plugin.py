from pymongo import MongoClient
from typing import List, Dict, Any
from .base import BasePlugin, Document

class MongoDBPlugin(BasePlugin):
    """
    Plugin to ingest documents from a MongoDB collection.
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

    def load_data(self) -> List[Document]:
        documents = []
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
                    elif isinstance(current, list) and part.endswith('[]'):
                        # Handle array notation if needed, but for now simple dot notation
                        return current
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

    @property
    def plugin_id(self) -> str:
        return "mongodb"

    @property
    def display_name(self) -> str:
        return "MongoDB"

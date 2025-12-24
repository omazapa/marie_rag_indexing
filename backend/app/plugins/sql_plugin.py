from sqlalchemy import create_engine, text
from typing import List, Dict, Any
from .base import BasePlugin, Document

class SQLPlugin(BasePlugin):
    """
    Plugin to ingest documents from a SQL database.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.connection_string = config.get("connection_string")
        self.query = config.get("query")
        self.content_column = config.get("content_column", "content")
        self.metadata_columns = config.get("metadata_columns", [])

        self.engine = create_engine(self.connection_string)

    def fetch_data(self) -> List[Document]:
        documents = []
        try:
            with self.engine.connect() as connection:
                result = connection.execute(text(self.query))
                for row in result:
                    # Convert row to dict
                    row_dict = row._asdict()
                    content = row_dict.get(self.content_column, "")
                    
                    if not content:
                        continue
                    
                    metadata = {
                        "source": f"sql://{self.connection_string}",
                    }
                    
                    for col in self.metadata_columns:
                        if col in row_dict:
                            metadata[col] = row_dict[col]
                    
                    documents.append(Document(
                        content=str(content),
                        metadata=metadata
                    ))
        except Exception as e:
            print(f"Error fetching data from SQL: {e}")
            
        return documents

    def validate_config(self) -> bool:
        return all([self.connection_string, self.query])

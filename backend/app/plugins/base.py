from abc import ABC, abstractmethod
from typing import Any, Dict, List, Generator
from pydantic import BaseModel

class Document(BaseModel):
    content: str
    metadata: Dict[str, Any]
    source_id: str

class BasePlugin(ABC):
    """
    Base class for all data source plugins.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
    def validate_config(self) -> bool:
        """Validate the provided configuration."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Test the connection to the data source."""
        pass

    @abstractmethod
    def load_data(self) -> Generator[Document, None, None]:
        """Stream documents from the data source."""
        pass

    @property
    @abstractmethod
    def plugin_id(self) -> str:
        """Unique identifier for the plugin."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable name for the plugin."""
        pass

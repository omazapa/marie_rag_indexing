from abc import ABC, abstractmethod
from typing import Any, Dict, Generator
from ...domain.models import Document

class DataSourcePort(ABC):
    """
    Port for all data source adapters.
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

    @staticmethod
    @abstractmethod
    def get_config_schema() -> Dict[str, Any]:
        """Return the JSON schema for the plugin configuration."""
        pass

    @abstractmethod
    def load_data(self) -> Generator[Document, None, None]:
        """Stream documents from the data source."""
        pass

    @staticmethod
    @abstractmethod
    def get_config_schema() -> Dict[str, Any]:
        """Return the JSON schema for the plugin configuration."""
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

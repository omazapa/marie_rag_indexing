import os
from typing import Any, Dict, Generator
from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document

class LocalFileAdapter(DataSourcePort):
    """
    Adapter to load documents from the local file system.
    """

    @property
    def plugin_id(self) -> str:
        return "local_file"

    @property
    def display_name(self) -> str:
        return "Local File System"

    def validate_config(self) -> bool:
        path = self.config.get("path")
        if not path:
            return False
        return os.path.exists(path)

    def test_connection(self) -> bool:
        return self.validate_config()

    def load_data(self) -> Generator[Document, None, None]:
        base_path = self.config.get("path")
        recursive = self.config.get("recursive", True)
        extensions = self.config.get("extensions", [".txt", ".md", ".pdf"])

        if recursive:
            for root, _, files in os.walk(base_path):
                for file in files:
                    if any(file.endswith(ext) for ext in extensions):
                        file_path = os.path.join(root, file)
                        yield self._process_file(file_path)
        else:
            for file in os.listdir(base_path):
                if any(file.endswith(ext) for ext in extensions):
                    file_path = os.path.join(base_path, file)
                    yield self._process_file(file_path)

    def _process_file(self, file_path: str) -> Document:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        return Document(
            content=content,
            metadata={
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "extension": os.path.splitext(file_path)[1]
            },
            source_id=self.plugin_id
        )

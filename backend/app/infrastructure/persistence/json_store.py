"""Simple JSON-based persistence for development."""
import json
import logging
from pathlib import Path
from typing import Any


class JSONStore:
    """Simple JSON file-based storage."""

    def __init__(self, filename: str):
        self.data_dir = Path("/app/data")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / filename
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Create file with empty structure if it doesn't exist."""
        if not self.filepath.exists():
            self.save([])

    def load(self) -> list[dict[str, Any]]:
        """Load data from JSON file."""
        try:
            with open(self.filepath) as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Error loading from {self.filepath}: {e}")
            return []

    def save(self, data: list[dict[str, Any]]):
        """Save data to JSON file."""
        try:
            with open(self.filepath, "w") as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logging.error(f"Error saving to {self.filepath}: {e}")

    def add(self, item: dict[str, Any]):
        """Add item to store."""
        data = self.load()
        data.append(item)
        self.save(data)

    def update(self, item_id: str, updates: dict[str, Any], id_field: str = "id"):
        """Update item in store."""
        data = self.load()
        for item in data:
            if str(item.get(id_field)) == str(item_id):
                item.update(updates)
                break
        self.save(data)

    def delete(self, item_id: str, id_field: str = "id"):
        """Delete item from store."""
        data = self.load()
        data = [item for item in data if str(item.get(id_field)) != str(item_id)]
        self.save(data)

    def get(self, item_id: str, id_field: str = "id") -> dict[str, Any] | None:
        """Get item by ID."""
        data = self.load()
        return next((item for item in data if str(item.get(id_field)) == str(item_id)), None)

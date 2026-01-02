import json
import logging
from typing import Any

import requests


class ConnectorAssistant:
    """
    Assistant to help users create data connectors using natural language.
    """

    def __init__(self, ollama_url: str = "http://localhost:11434", model: str = "llama3"):
        self.ollama_url = ollama_url
        self.model = model

    def suggest_connector(self, user_prompt: str) -> dict[str, Any]:
        """
        Uses an LLM to suggest a connector configuration.
        """
        system_prompt = """
        You are a data engineering assistant for the Marie RAG Indexing tool.
        Your task is to help users configure data connectors.

        Available plugins:
        1. local_file: { "path": "string", "recursive": bool, "extensions": ["string"] }
        2. s3: {
            "bucket_name": "string",
            "prefix": "string",
            "endpoint_url": "string",
            "aws_access_key_id": "string",
            "aws_secret_access_key": "string"
        }
        3. mongodb: {
            "connection_string": "string",
            "database": "string",
            "collection": "string",
            "content_field": "string",
            "metadata_fields": ["string"]
        }
        4. sql: {
            "connection_string": "string",
            "query": "string",
            "content_column": "string",
            "metadata_columns": ["string"]
        }
        5. web_scraper: { "base_url": "string", "max_depth": int }

        Based on the user's description, identify the best plugin and suggest a configuration.
        Return ONLY a JSON object with the following structure:
        {
            "plugin_id": "one of the above",
            "config": { ... the suggested config ... },
            "explanation": "A short explanation of why this was chosen"
        }
        If you don't have enough information for some fields, use placeholders like
        "YOUR_BUCKET_NAME".
        """

        try:
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "format": "json",
                },
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
            res_data = json.loads(result["response"])
            return (
                res_data if isinstance(res_data, dict) else self._fallback_suggestion(user_prompt)
            )
        except Exception as e:
            logging.error(f"Assistant error: {e}")
            # Fallback: simple keyword matching if LLM fails
            return self._fallback_suggestion(user_prompt)

    def _fallback_suggestion(self, prompt: str) -> dict[str, Any]:
        prompt = prompt.lower()
        if "mongo" in prompt:
            return {
                "plugin_id": "mongodb",
                "config": {
                    "connection_string": "mongodb://localhost:27017",
                    "database": "test",
                    "collection": "docs",
                    "content_field": "text",
                },
                "explanation": "Detected MongoDB keywords. Here is a template.",
            }
        elif "s3" in prompt or "bucket" in prompt:
            return {
                "plugin_id": "s3",
                "config": {
                    "bucket_name": "my-bucket",
                    "aws_access_key_id": "KEY",
                    "aws_secret_access_key": "SECRET",
                },
                "explanation": "Detected S3 keywords. Here is a template.",
            }
        elif "sql" in prompt or "postgres" in prompt or "mysql" in prompt:
            return {
                "plugin_id": "sql",
                "config": {
                    "connection_string": "postgresql://user:pass@localhost:5432/db",
                    "query": "SELECT text FROM table",
                },
                "explanation": "Detected SQL keywords. Here is a template.",
            }
        elif "http" in prompt or "web" in prompt or "site" in prompt:
            return {
                "plugin_id": "web_scraper",
                "config": {"base_url": "https://example.com", "max_depth": 2},
                "explanation": "Detected Web keywords. Here is a template.",
            }
        else:
            return {
                "plugin_id": "local_file",
                "config": {"path": "./data", "recursive": True},
                "explanation": (
                    "Defaulting to local file system. "
                    "Please provide more details for other sources."
                ),
            }

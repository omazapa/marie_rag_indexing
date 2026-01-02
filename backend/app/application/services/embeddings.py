import logging
from typing import Any

import requests
from sentence_transformers import SentenceTransformer


class EmbeddingEngine:
    """
    Engine to generate embeddings for text chunks using various providers.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        provider: str = "huggingface",
        config: dict[str, Any] | None = None,
    ):
        self.model_name = model_name
        self.provider = provider
        self.config = config or {}
        self.model: Any = None
        self.dimension = 0

        self._initialize_provider()

    def _initialize_provider(self):
        if self.provider == "huggingface":
            try:
                self.model = SentenceTransformer(self.model_name)
                dim = self.model.get_sentence_embedding_dimension()
                self.dimension = dim if dim is not None else 0
                logging.info(
                    f"Loaded HuggingFace model: {self.model_name} (Dimension: {self.dimension})"
                )
            except Exception as e:
                logging.error(f"Error loading HuggingFace model {self.model_name}: {e}")
                raise e
        elif self.provider == "ollama":
            self.base_url = self.config.get("base_url", "http://localhost:11434")
            # Try to get dimension by embedding a dummy text
            try:
                dummy_emb = self._embed_ollama(["test"])
                self.dimension = len(dummy_emb[0])
                logging.info(
                    f"Initialized Ollama model: {self.model_name} (Dimension: {self.dimension})"
                )
            except Exception as e:
                logging.error(f"Error connecting to Ollama: {e}")
                # Don't raise here, maybe Ollama is just down
                self.dimension = 4096  # Default for many llama models

    def embed_text(self, text: str | list[str]) -> list[float] | list[list[float]]:
        """
        Generates embeddings for a single string or a list of strings.
        """
        texts = [text] if isinstance(text, str) else text

        if self.provider == "huggingface":
            embeddings = self.model.encode(texts)
            result = embeddings.tolist()
        elif self.provider == "ollama":
            result = self._embed_ollama(texts)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

        if isinstance(text, str):
            return result[0]  # type: ignore
        return result  # type: ignore

    def _embed_ollama(self, texts: list[str]) -> list[list[float]]:
        embeddings = []
        for t in texts:
            try:
                response = requests.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model_name, "prompt": t},
                    timeout=30,
                )
                response.raise_for_status()
                embeddings.append(response.json()["embedding"])
            except Exception as e:
                logging.error(f"Ollama embedding error: {e}")
                # Return zero vector as fallback to avoid breaking the whole batch
                embeddings.append([0.0] * self.dimension)
        return embeddings

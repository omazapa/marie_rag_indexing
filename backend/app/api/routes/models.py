"""Embedding model management endpoints."""

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ...infrastructure.external_apis.model_search import (
    search_huggingface_models,
    search_ollama_models,
)

router = APIRouter()


class ModelCreate(BaseModel):
    name: str
    provider: str
    model: str
    config: dict[str, Any] = {}


# In-memory storage for demo purposes
# TODO: Replace with database persistence
embedding_models: list[dict[str, Any]] = [
    {
        "id": "1",
        "name": "MiniLM (Local)",
        "provider": "huggingface",
        "model": "all-MiniLM-L6-v2",
        "status": "active",
        "config": {},
    },
    {
        "id": "2",
        "name": "Llama 3 (Ollama)",
        "provider": "ollama",
        "model": "llama3",
        "status": "active",
        "config": {"base_url": "http://localhost:11434"},
    },
]


@router.get("/models")
async def get_models():
    """Get all configured embedding models."""
    return {"models": embedding_models}


@router.post("/models")
async def add_model(model: ModelCreate):
    """Add a new embedding model configuration."""
    new_model = {
        "id": str(len(embedding_models) + 1),
        "name": model.name,
        "provider": model.provider,
        "model": model.model,
        "status": "active",
        "config": model.config,
    }
    embedding_models.append(new_model)
    return new_model


@router.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """Delete an embedding model configuration."""
    global embedding_models
    embedding_models = [m for m in embedding_models if m["id"] != model_id]
    return {"status": "success"}


@router.get("/models/search")
async def search_models(
    provider: str = Query("huggingface"),
    query: str = Query(""),
):
    """Search for available embedding models."""
    if not query:
        return {"results": []}

    if provider == "huggingface":
        results = search_huggingface_models(query)
    elif provider == "ollama":
        # Try to get base_url from existing ollama models if any
        base_url = "http://localhost:11434"
        for m in embedding_models:
            if m["provider"] == "ollama":
                base_url = m.get("config", {}).get("base_url", base_url)
                break
        results = search_ollama_models(query, base_url)
    else:
        return {"error": "Unsupported provider"}

    return {"results": results}

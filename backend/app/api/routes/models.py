"""Embedding model management endpoints."""

from typing import Any

from flask import Blueprint, jsonify, request

from ...infrastructure.external_apis.model_search import (
    search_huggingface_models,
    search_ollama_models,
)

models_bp = Blueprint("models", __name__)

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


@models_bp.route("/models", methods=["GET"])
def get_models():
    """Get all configured embedding models."""
    return jsonify({"models": embedding_models}), 200


@models_bp.route("/models", methods=["POST"])
def add_model():
    """Add a new embedding model configuration."""
    data = request.json
    new_model = {
        "id": str(len(embedding_models) + 1),
        "name": data.get("name"),
        "provider": data.get("provider"),
        "model": data.get("model"),
        "status": "active",
        "config": data.get("config", {}),
    }
    embedding_models.append(new_model)
    return jsonify(new_model), 201


@models_bp.route("/models/<model_id>", methods=["DELETE"])
def delete_model(model_id):
    """Delete an embedding model configuration."""
    global embedding_models
    embedding_models = [m for m in embedding_models if m["id"] != model_id]
    return jsonify({"status": "success"}), 200


@models_bp.route("/models/search", methods=["GET"])
def search_models():
    """Search for available embedding models."""
    provider = request.args.get("provider", "huggingface")
    query = request.args.get("query", "")

    if not query:
        return jsonify({"results": []}), 200

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
        return jsonify({"error": "Unsupported provider"}), 400

    return jsonify({"results": results}), 200

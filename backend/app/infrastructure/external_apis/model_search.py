import logging
from typing import Any

import requests


def search_huggingface_models(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search for models on Hugging Face Hub.
    Filters for sentence-similarity and feature-extraction.
    """
    try:
        # Search for sentence-similarity models
        url = "https://huggingface.co/api/models"
        params: dict[str, Any] = {
            "search": query,
            "filter": "sentence-similarity",
            "sort": "downloads",
            "direction": -1,
            "limit": limit,
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        models = response.json()

        results = []
        for m in models:
            results.append(
                {
                    "id": m["modelId"],
                    "name": m["modelId"],
                    "downloads": m.get("downloads", 0),
                    "likes": m.get("likes", 0),
                    "provider": "huggingface",
                }
            )
        return results
    except Exception as e:
        logging.error(f"Error searching Hugging Face: {e}")
        return []


def search_ollama_models(
    query: str, base_url: str = "http://localhost:11434"
) -> list[dict[str, Any]]:
    """
    Search for models in Ollama.
    Since Ollama doesn't have a public search API for its library,
    we return locally installed models that match the query,
    plus a few popular ones if they match.
    """
    results = []

    # 1. Search local models
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=5)
        if response.status_code == requests.codes.ok:
            local_models = response.json().get("models", [])
            for m in local_models:
                name = m["name"]
                if query.lower() in name.lower():
                    results.append(
                        {
                            "id": name,
                            "name": f"{name} (Local)",
                            "provider": "ollama",
                            "installed": True,
                        }
                    )
    except Exception as e:
        logging.warning(f"Could not connect to local Ollama to search models: {e}")

    # 2. Popular models from Ollama library (static list for now)
    popular_ollama = [
        "llama3",
        "llama3:8b",
        "llama3:70b",
        "mistral",
        "mixtral",
        "phi3",
        "nomic-embed-text",
        "mxbai-embed-large",
        "gemma",
        "gemma:2b",
        "gemma:7b",
        "command-r",
        "command-r-plus",
        "qwen",
        "llava",
    ]

    for model in popular_ollama:
        if query.lower() in model.lower():
            # Avoid duplicates if already in local
            if not any(r["id"] == model for r in results):
                results.append(
                    {"id": model, "name": model, "provider": "ollama", "installed": False}
                )

    return results[:10]

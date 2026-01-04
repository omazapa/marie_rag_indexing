"""
API package initialization.
Contains all FastAPI routers for the application routes.
"""

from fastapi import FastAPI

from .routes.health import router as health_router
from .routes.ingestion import router as ingestion_router
from .routes.models import router as models_router
from .routes.plugins import router as plugins_router
from .routes.sources import router as sources_router
from .routes.stats import router as stats_router
from .routes.vector_stores import router as vector_stores_router


def register_routers(app: FastAPI):
    """Register all routers with the FastAPI application."""
    app.include_router(health_router, tags=["Health"])
    app.include_router(plugins_router, prefix="/api/v1", tags=["Plugins"])
    app.include_router(sources_router, prefix="/api/v1", tags=["Sources"])
    app.include_router(models_router, prefix="/api/v1", tags=["Models"])
    app.include_router(vector_stores_router, prefix="/api/v1", tags=["Vector Stores"])
    app.include_router(ingestion_router, prefix="/api/v1", tags=["Ingestion"])
    app.include_router(stats_router, prefix="/api/v1", tags=["Stats"])

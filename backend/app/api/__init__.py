"""
API package initialization.
Contains all Flask Blueprints for the application routes.
"""

from flask import Flask

from .routes.health import health_bp
from .routes.ingestion import ingestion_bp
from .routes.models import models_bp
from .routes.plugins import plugins_bp
from .routes.sources import sources_bp
from .routes.stats import stats_bp
from .routes.vector_stores import vector_stores_bp


def register_blueprints(app: Flask):
    """Register all blueprints with the Flask application."""
    app.register_blueprint(health_bp)
    app.register_blueprint(plugins_bp, url_prefix="/api/v1")
    app.register_blueprint(sources_bp, url_prefix="/api/v1")
    app.register_blueprint(models_bp, url_prefix="/api/v1")
    app.register_blueprint(vector_stores_bp, url_prefix="/api/v1")
    app.register_blueprint(ingestion_bp, url_prefix="/api/v1")
    app.register_blueprint(stats_bp, url_prefix="/api/v1")

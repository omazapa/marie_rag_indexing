"""
Main Flask application factory.
Refactored to use Flask Blueprints for better code organization.
"""

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from .api import register_blueprints

load_dotenv()


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Enable CORS for all routes and all origins with explicit settings
    CORS(
        app,
        resources={
            r"/*": {
                "origins": "*",
                "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Methods"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            }
        },
    )

    # Register all API blueprints
    register_blueprints(app)

    print("Flask app created with modular Blueprint architecture and robust CORS enabled")
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5001)

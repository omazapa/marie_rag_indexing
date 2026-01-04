"""
Main FastAPI application.
Refactored from Flask to FastAPI for better performance and async support.
"""

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import register_routers

load_dotenv()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Marie RAG Indexing API",
        description="A modular and scalable system for RAG indexing with multiple sources",
        version="0.1.0",
    )

    # Enable CORS for all routes
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register all API routers
    register_routers(app)

    print("FastAPI app created with modular architecture and CORS enabled")
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001, reload=True)

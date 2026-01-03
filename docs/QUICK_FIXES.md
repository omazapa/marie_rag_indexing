# Quick Fixes - Immediate Actions

**Date**: January 3, 2026

These are the most critical fixes that should be applied immediately to resolve existing inconsistencies.

---

## 🔥 Fix 1: Create .env.example Files

### Backend .env.example
```bash
cd /home/ozapatam/Projects/Colav/marie_rag_indexing
cat > .env.example << 'EOF'
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key-change-in-production

# OpenSearch Configuration
OPENSEARCH_URL=http://localhost:9200
OPENSEARCH_USER=admin
OPENSEARCH_PASSWORD=admin
OPENSEARCH_VERIFY_CERTS=False

# Vector Stores (Optional - Configure as needed)
PINECONE_API_KEY=
QDRANT_URL=http://localhost:6333
MILVUS_HOST=localhost
MILVUS_PORT=19530

# Database (Future Implementation)
DATABASE_URL=sqlite:///./data/marie.db

# JWT Authentication (Future Implementation)
JWT_SECRET_KEY=change-this-to-a-secure-random-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRES=900
JWT_REFRESH_TOKEN_EXPIRES=604800

# Embedding Providers (Optional)
HUGGINGFACE_API_KEY=
OPENAI_API_KEY=

# Cloud Storage (Optional)
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_ENDPOINT=

# Google Drive (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
```

### Frontend .env.example
```bash
cd /home/ozapatam/Projects/Colav/marie_rag_indexing/frontend
cat > .env.local.example << 'EOF'
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1

# Branding
NEXT_PUBLIC_APP_NAME=Marie RAG Indexing
NEXT_PUBLIC_VERSION=1.0.0
NEXT_PUBLIC_COMPANY_NAME=Colav
EOF
```

---

## 🔥 Fix 2: Update Service Imports

### Check All Services
```bash
cd /home/ozapatam/Projects/Colav/marie_rag_indexing/frontend/src/services
grep -r "import api from" . | cut -d: -f1 | sort -u
```

### Files to Update
Each file should use:
```typescript
import { apiClient } from './api';
```

Instead of:
```typescript
import api from './api';
```

---

## 🔥 Fix 3: Create Data Directory for SQLite

```bash
cd /home/ozapatam/Projects/Colav/marie_rag_indexing
mkdir -p backend/data
touch backend/data/.gitkeep

# Add to .gitignore
echo "backend/data/*.db" >> .gitignore
echo "backend/data/*.db-journal" >> .gitignore
```

---

## 🔥 Fix 4: Add Shared Plugin Registry

Create `backend/app/core/registry.py`:

```python
"""
Centralized plugin registry to avoid duplication.
"""
from typing import Dict, Type, Optional

from ..application.ports.data_source import DataSourcePort
from ..application.ports.vector_store import VectorStorePort


class PluginRegistry:
    """Central registry for all plugins."""

    _data_sources: Dict[str, Type[DataSourcePort]] = {}
    _vector_stores: Dict[str, Type[VectorStorePort]] = {}
    _initialized = False

    @classmethod
    def initialize(cls):
        """Initialize the registry with all available plugins."""
        if cls._initialized:
            return

        from ..infrastructure.adapters.data_sources import (
            LocalFileAdapter,
            MongoDBAdapter,
            S3Adapter,
            SQLAdapter,
            WebScraperAdapter,
            GoogleDriveAdapter,
        )
        from ..infrastructure.adapters.vector_stores import (
            OpenSearchAdapter,
            PineconeAdapter,
            QdrantAdapter,
            MilvusAdapter,
            PGVectorAdapter,
        )

        # Register data sources
        cls._data_sources = {
            "local_file": LocalFileAdapter,
            "mongodb": MongoDBAdapter,
            "s3": S3Adapter,
            "sql": SQLAdapter,
            "web_scraper": WebScraperAdapter,
            "google_drive": GoogleDriveAdapter,
        }

        # Register vector stores
        cls._vector_stores = {
            "opensearch": OpenSearchAdapter,
            "pinecone": PineconeAdapter,
            "qdrant": QdrantAdapter,
            "milvus": MilvusAdapter,
            "pgvector": PGVectorAdapter,
        }

        cls._initialized = True

    @classmethod
    def get_data_source(cls, plugin_id: str) -> Optional[Type[DataSourcePort]]:
        """Get a data source plugin by ID."""
        cls.initialize()
        return cls._data_sources.get(plugin_id)

    @classmethod
    def get_vector_store(cls, store_id: str) -> Optional[Type[VectorStorePort]]:
        """Get a vector store plugin by ID."""
        cls.initialize()
        return cls._vector_stores.get(store_id)

    @classmethod
    def list_data_sources(cls) -> Dict[str, Type[DataSourcePort]]:
        """List all registered data source plugins."""
        cls.initialize()
        return cls._data_sources.copy()

    @classmethod
    def list_vector_stores(cls) -> Dict[str, Type[VectorStorePort]]:
        """List all registered vector store plugins."""
        cls.initialize()
        return cls._vector_stores.copy()
```

Then update route files to use it:

```python
# In route files, replace plugin dictionaries with:
from ...core.registry import PluginRegistry

# Instead of:
# DATA_SOURCE_PLUGINS = {...}
# Use:
plugin_class = PluginRegistry.get_data_source(plugin_id)
```

---

## 🔥 Fix 5: Add Basic Request Validation

Create `backend/app/api/schemas.py`:

```python
"""
Pydantic schemas for request validation.
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator


class CreateSourceRequest(BaseModel):
    """Schema for creating a new data source."""
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(local_file|mongodb|s3|sql|web_scraper|google_drive)$")
    config: Dict[str, Any] = Field(default_factory=dict)

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()


class CreateModelRequest(BaseModel):
    """Schema for creating a new embedding model."""
    name: str = Field(..., min_length=1, max_length=100)
    provider: str = Field(..., pattern="^(huggingface|ollama|openai)$")
    model: str = Field(..., min_length=1)
    config: Dict[str, Any] = Field(default_factory=dict)


class TriggerIngestionRequest(BaseModel):
    """Schema for triggering an ingestion job."""
    plugin_id: str
    config: Dict[str, Any]
    chunk_settings: Dict[str, Any] = Field(default_factory=dict)
    vector_store: str = "opensearch"
    vector_store_config: Dict[str, Any] = Field(default_factory=dict)
    index_name: str
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_provider: str = "huggingface"
    embedding_config: Dict[str, Any] = Field(default_factory=dict)
    execution_mode: str = Field(default="sequential", pattern="^(sequential|parallel)$")
    max_workers: int = Field(default=4, ge=1, le=32)
```

---

## 🔥 Fix 6: Standardize Error Responses

Create `backend/app/api/responses.py`:

```python
"""
Standardized API response helpers.
"""
from typing import Any, Optional, Dict
from flask import jsonify


def success_response(data: Any, message: Optional[str] = None, status_code: int = 200):
    """Create a standardized success response."""
    response = {
        "success": True,
        "data": data
    }
    if message:
        response["message"] = message

    return jsonify(response), status_code


def error_response(
    message: str,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None
):
    """Create a standardized error response."""
    response = {
        "success": False,
        "error": {
            "message": message,
            "code": status_code,
        }
    }
    if details:
        response["error"]["details"] = details

    return jsonify(response), status_code


def validation_error_response(errors: list):
    """Create a validation error response."""
    return error_response(
        message="Validation failed",
        status_code=422,
        details={"validation_errors": errors}
    )
```

---

## 📝 Application Checklist

Apply these fixes in order:

- [ ] Create `.env.example` files
- [ ] Create `backend/data` directory
- [ ] Update `.gitignore`
- [ ] Create `PluginRegistry` in `backend/app/core/registry.py`
- [ ] Create validation schemas in `backend/app/api/schemas.py`
- [ ] Create response helpers in `backend/app/api/responses.py`
- [ ] Update all route files to use registry
- [ ] Update all route files to use standardized responses
- [ ] Fix frontend service imports (check with grep)
- [ ] Test all endpoints after changes

---

## 🧪 Testing After Fixes

```bash
# 1. Test backend starts
cd backend
uv run python -m app.main

# 2. Test frontend starts
cd frontend
npm run dev

# 3. Test health endpoint
curl http://localhost:5001/health

# 4. Test API endpoints
curl http://localhost:5001/api/v1/plugins
curl http://localhost:5001/api/v1/sources
curl http://localhost:5001/api/v1/models
```

---

## 📅 Estimated Time

- **Environment Setup**: 15 minutes
- **Registry Implementation**: 30 minutes
- **Validation & Responses**: 30 minutes
- **Route Updates**: 1 hour
- **Testing**: 30 minutes

**Total**: ~2.5 hours

Apply these fixes before moving to the next development phase.

# Project Inconsistencies & Resolution Plan

**Date**: January 3, 2026
**Status**: Active Review

---

## 🔴 Critical Issues

### 1. Data Persistence - In-Memory Storage
**Severity**: HIGH
**Impact**: Data loss on server restart

#### Current State
Multiple components use in-memory storage:

**Sources** (`backend/app/api/routes/sources.py`):
```python
data_sources: list[dict[str, Any]] = [
    {
        "id": "1",
        "name": "Local Docs",
        "type": "local_file",
        "status": "active",
        "lastRun": "2025-12-23 10:00",
        "config": {"path": "./docs"},
    },
]
```

**Models** (`backend/app/api/routes/models.py`):
```python
embedding_models: list[dict[str, Any]] = [...]
```

**Jobs** (`backend/app/api/routes/ingestion.py`):
```python
ingestion_jobs: dict[str, dict[str, Any]] = {}
```

#### Resolution Options

**Option A: SQLite (Recommended for Development)**
```python
# Quick implementation
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "data" / "marie.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS data_sources (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT,
            config JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Similar for models, jobs
    conn.commit()
```

**Option B: PostgreSQL (Production Ready)**
```python
# Using SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/marie")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
```

**Option C: OpenSearch Metadata (Per Specs)**
```python
# Store metadata in OpenSearch
# Aligns with project specifications
METADATA_INDEX = "marie_metadata"
```

#### Action Items
- [ ] Choose persistence strategy
- [ ] Create database models/schemas
- [ ] Implement DAO/Repository pattern
- [ ] Add migration system (Alembic for SQL)
- [ ] Update all routes to use persistence
- [ ] Add data seeding for development

---

### 2. Service Import Inconsistency
**Severity**: MEDIUM
**Impact**: Potential issues with error handling

#### Problem
Some services still use old `api` import instead of new `apiClient`:

**File**: `frontend/src/services/pluginService.ts`
```typescript
import api from './api';  // ❌ OLD

// Should be:
import { apiClient } from './api';  // ✅ NEW
```

#### Affected Files
Need to verify and update:
- ✅ `sourceService.ts`
- ⚠️ `pluginService.ts` - Partially updated
- ✅ `modelService.ts`
- ✅ `vectorStoreService.ts`
- ✅ `statsService.ts`
- ✅ `ingestionService.ts`
- ✅ `jobService.ts`
- ✅ `indexService.ts`
- ? `mongodbService.ts` - Need to check
- ? `assistantService.ts` - Need to check

#### Resolution
```bash
# Search for old imports
cd frontend/src/services
grep -r "import api from" .

# Update each file to use apiClient
```

---

### 3. Missing Environment Configuration
**Severity**: MEDIUM
**Impact**: Deployment issues, unclear setup

#### Missing
- No `.env.example` file
- Environment variables not documented
- No validation of required variables

#### Required Variables

**Backend**:
```bash
# Core
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key-here

# OpenSearch
OPENSEARCH_URL=http://localhost:9200
OPENSEARCH_USER=admin
OPENSEARCH_PASSWORD=admin
OPENSEARCH_VERIFY_CERTS=False

# Vector Stores (Optional)
PINECONE_API_KEY=
QDRANT_URL=http://localhost:6333
MILVUS_HOST=localhost
MILVUS_PORT=19530
PGVECTOR_URL=postgresql://user:pass@localhost:5432/vectors

# Database (Future)
DATABASE_URL=sqlite:///./data/marie.db

# JWT Authentication (Future)
JWT_SECRET_KEY=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRES=900
JWT_REFRESH_TOKEN_EXPIRES=604800

# Embeddings
HUGGINGFACE_API_KEY=
OPENAI_API_KEY=

# Storage
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_ENDPOINT=

# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Frontend**:
```bash
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
NEXT_PUBLIC_APP_NAME=Marie RAG Indexing
NEXT_PUBLIC_VERSION=1.0.0
```

#### Action Items
- [ ] Create `.env.example` files for backend and frontend
- [ ] Add environment validation on startup
- [ ] Document all variables in README
- [ ] Add to `.gitignore` if not already present

---

## 🟡 Medium Priority Issues

### 4. Duplicate Data Between Routes
**Severity**: MEDIUM
**Impact**: Code duplication, inconsistency risk

#### Problem
Same plugin/vector store mappings defined in multiple files:

**In `main.py`** (now minimal):
```python
# Empty after refactoring
```

**In route files**:
```python
# backend/app/api/routes/plugins.py
DATA_SOURCE_PLUGINS = {...}

# backend/app/api/routes/sources.py
DATA_SOURCE_PLUGINS = {...}

# backend/app/api/routes/ingestion.py
DATA_SOURCE_PLUGINS = {...}
VECTOR_STORE_PLUGINS = {...}
```

#### Resolution
Create a shared registry:

```python
# backend/app/core/registry.py
from typing import Dict, Type
from ..application.ports.data_source import DataSourcePort
from ..application.ports.vector_store import VectorStorePort

class PluginRegistry:
    _data_sources: Dict[str, Type[DataSourcePort]] = {}
    _vector_stores: Dict[str, Type[VectorStorePort]] = {}

    @classmethod
    def register_data_source(cls, plugin_id: str, plugin_class: Type[DataSourcePort]):
        cls._data_sources[plugin_id] = plugin_class

    @classmethod
    def get_data_source(cls, plugin_id: str) -> Type[DataSourcePort]:
        return cls._data_sources.get(plugin_id)

    @classmethod
    def list_data_sources(cls) -> Dict[str, Type[DataSourcePort]]:
        return cls._data_sources.copy()

# Usage in routes:
from backend.app.core.registry import PluginRegistry
plugin_class = PluginRegistry.get_data_source(plugin_id)
```

---

### 5. No API Versioning Strategy
**Severity**: MEDIUM
**Impact**: Future breaking changes difficult

#### Current State
All routes under `/api/v1` but no clear versioning strategy.

#### Issues
- What happens when we need v2?
- How to deprecate old endpoints?
- How to support multiple versions?

#### Recommendation
```python
# backend/app/api/__init__.py
def register_blueprints(app: Flask, version: str = "v1"):
    prefix = f"/api/{version}"

    app.register_blueprint(health_bp)  # No version (global)
    app.register_blueprint(plugins_bp, url_prefix=prefix)
    app.register_blueprint(sources_bp, url_prefix=prefix)
    # ...

# Future v2 routes
def register_v2_blueprints(app: Flask):
    from .v2.routes import sources_v2_bp
    app.register_blueprint(sources_v2_bp, url_prefix="/api/v2")
```

---

### 6. Missing Request Validation
**Severity**: MEDIUM
**Impact**: Security risk, data corruption

#### Problem
Many endpoints lack input validation:

```python
@sources_bp.route("/sources", methods=["POST"])
def add_source():
    data = request.json  # ⚠️ No validation
    new_source = {
        "id": str(len(data_sources) + 1),
        "name": data.get("name"),  # Could be None
        "type": data.get("type"),   # Could be None
        # ...
    }
```

#### Resolution
Use Pydantic for validation:

```python
from pydantic import BaseModel, Field, validator

class CreateSourceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(local_file|mongodb|s3|sql|web_scraper|google_drive)$")
    config: dict = Field(default_factory=dict)

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

@sources_bp.route("/sources", methods=["POST"])
def add_source():
    try:
        data = CreateSourceRequest(**request.json)
        # Now data is validated
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
```

---

## 🟢 Low Priority Issues

### 7. Inconsistent Error Response Format
**Severity**: LOW
**Impact**: Frontend error handling inconsistency

#### Current State
Different endpoints return errors in different formats:

```python
# Some return:
return jsonify({"error": "Message"}), 400

# Others return:
return jsonify({"message": "Message", "status": "error"}), 400

# Others return:
return jsonify({"success": False, "error": "Message"}), 200  # ⚠️ Wrong status code
```

#### Standard Format
```python
from typing import Optional, Dict, Any

def error_response(
    message: str,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None
):
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

def success_response(data: Any, message: Optional[str] = None):
    response = {
        "success": True,
        "data": data
    }
    if message:
        response["message"] = message

    return jsonify(response), 200
```

---

### 8. Missing Logging Configuration
**Severity**: LOW
**Impact**: Debugging difficulties

#### Current State
Basic Python logging, no structured logging, no log rotation.

#### Recommendations
```python
# backend/app/core/logging.py
import logging
from logging.handlers import RotatingFileHandler
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        return json.dumps(log_obj)

def setup_logging(app):
    handler = RotatingFileHandler(
        'logs/marie.log',
        maxBytes=10485760,  # 10MB
        backupCount=10
    )
    handler.setFormatter(JSONFormatter())
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
```

---

### 9. No Health Check Details
**Severity**: LOW
**Impact**: Limited observability

#### Current Health Check
```python
@health_bp.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200
```

#### Enhanced Health Check
```python
@health_bp.route("/health", methods=["GET"])
def health_check():
    checks = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {
            "api": "up",
            "opensearch": check_opensearch(),
            "database": check_database(),
        }
    }

    all_healthy = all(v == "up" for v in checks["services"].values())
    status_code = 200 if all_healthy else 503

    if not all_healthy:
        checks["status"] = "degraded"

    return jsonify(checks), status_code
```

---

### 10. Frontend Type Inconsistencies
**Severity**: LOW
**Impact**: Type safety issues

#### Issues
- Some components use `any` types
- Missing interfaces for some API responses
- Inconsistent null handling

#### Example Fixes
```typescript
// ❌ Bad
const data: any = await api.get('/sources');

// ✅ Good
interface Source {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastRun: string | null;
  config: Record<string, unknown>;
}

const data: Source[] = await apiClient.get<{ sources: Source[] }>('/sources');
```

---

## 📋 Resolution Priority

### Immediate (This Sprint)
1. ✅ Fix service import inconsistencies
2. ⏳ Create `.env.example` files
3. ⏳ Implement basic data persistence (SQLite)

### Short Term (Next Sprint)
4. Add request validation with Pydantic
5. Standardize error response format
6. Create plugin registry
7. Enhanced health checks

### Medium Term (Q1 2026)
8. Implement proper logging
9. Add API versioning strategy
10. Fix frontend type inconsistencies
11. Add automated tests

---

## 🔄 Review Process

This document should be reviewed and updated:
- Weekly during active development
- After each major feature implementation
- Before any production deployment
- When inconsistencies are discovered

**Next Review**: January 10, 2026

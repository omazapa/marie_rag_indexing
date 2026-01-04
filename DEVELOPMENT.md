# Development Guide

## Quick Start

### Development Mode (Recommended)

```bash
# Start development environment
./dev.sh up

# Run in background
./dev.sh up -d
```

This will:
- Mount your code as volumes (no rebuild needed for code changes)
- Enable hot-reload for both backend and frontend
- Persist backend virtualenv across restarts
- Exclude test files from triggering backend reload

### Available Commands

```bash
./dev.sh up          # Start all services
./dev.sh down        # Stop all services
./dev.sh restart     # Restart services
./dev.sh logs        # Follow logs (all services)
./dev.sh logs backend # Follow backend logs only
./dev.sh test        # Run backend tests
./dev.sh test -v     # Run tests with verbose output
./dev.sh shell       # Open shell in backend container
./dev.sh shell frontend # Open shell in frontend container
./dev.sh rebuild     # Rebuild images and restart
./dev.sh clean       # Remove containers and volumes
```

## Development Workflow

### Backend Changes
1. Edit Python files in `backend/`
2. Save - uvicorn will auto-reload (excluding test files)
3. No rebuild needed!

### Frontend Changes
1. Edit TypeScript/React files in `frontend/`
2. Save - Next.js hot-reload will update
3. No rebuild needed!

### Running Tests

```bash
# Run all tests
./dev.sh test

# Run with coverage
./dev.sh test --cov

# Run specific test file
./dev.sh test backend/tests/test_sources.py

# Run with verbose output
./dev.sh test -v

# Run in parallel
./dev.sh test -n auto
```

## Ports

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5001
- **API Docs**: http://localhost:5001/docs

## Environment Variables

Create a `.env` file in the root directory:

```bash
# OpenSearch
OPENSEARCH_URL=http://host.docker.internal:9200
OPENSEARCH_USER=admin
OPENSEARCH_PASSWORD=admin

# Optional: Pinecone
PINECONE_API_KEY=your-key-here

# Optional: PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## Troubleshooting

### Backend won't start
```bash
./dev.sh logs backend
```

### Frontend build issues
```bash
./dev.sh shell frontend
npm install
```

### Clean start
```bash
./dev.sh clean
./dev.sh up --build
```

### Access container shell
```bash
./dev.sh shell backend
./dev.sh shell frontend
```

## Production Build

For production deployment:

```bash
docker compose up --build -d
```

This uses production Dockerfiles without dev overrides.

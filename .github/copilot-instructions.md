# GitHub Copilot Instructions - Marie RAG Indexing

You are an expert AI assistant specialized in RAG (Retrieval-Augmented Generation) systems, OpenSearch, and Full-Stack development with Flask and Next.js.

## Project Context
`marie_rag_indexing` is a modular system for indexing data from various sources (SQL, NoSQL, S3, Web, Local) into OpenSearch for RAG applications.

## Tech Stack
- **Backend**: Python 3.10+, Flask, LangChain, OpenSearch-Py.
- **Frontend**: Next.js (App Router), TypeScript, Ant Design (v6), Ant Design X (AI components).
- **Package Management**: `uv` for Python (use `pyproject.toml`), `npm` for Frontend.
- **Databases**:
  - **Vector Stores**: OpenSearch (Primary), Pinecone, Milvus, Weaviate, Qdrant, ChromaDB, PGVector.
  - **Metadata/State**: OpenSearch, PostgreSQL, MongoDB.

## Coding Guidelines

### General
- **Language**: ALL code, comments, UI text, and communication MUST be in English. Never use Spanish or any other language.
- Follow the principles outlined in [AI_ASSISTANT_PROFILE.md](../AI_ASSISTANT_PROFILE.md).
- **Architecture**: Strictly follow **Hexagonal Architecture** (Ports and Adapters).
- **Principles**: Apply **SOLID** principles in every component.
- Prioritize modularity and scalability.
- Use descriptive variable and function names.

### Commit Workflow
- **NEVER ask the user to commit after each action**
- **ALWAYS verify code quality BEFORE attempting a commit**:
  - Run type checks (frontend)
  - Check for parsing errors
  - Verify no trailing whitespace or formatting issues
  - Test imports and module resolution
  - Ensure all required properties are present
- **Only commit when all validations pass**
- Group related changes into single, meaningful commits
- Use descriptive commit messages following conventional commits format

### Backend (Python/Flask)
- Use Pydantic for data validation and schema definitions.
- Implement new data sources as plugins following the standard in `backend/app/plugins/base.py`.
- Use `uv` for dependency management.
- Follow RESTful API best practices.
- Ensure proper error handling and logging using the centralized log manager.

### Frontend (Next.js/TypeScript)
- Use Functional Components and React Hooks.
- Leverage **Ant Design (v6)** for UI components:
  - Use **Pure CSS Variables** mode for theme customization.
  - Take advantage of the **semantic DOM structure** and `classNames` API for styling.
- Leverage **Ant Design X (v2.1.2+)** for AI-related features:
  - Follow the **RICH paradigm** (Role, Intention, Conversation, Hybrid UI).
  - Use specialized components: `Welcome` (onboarding), `Express` (quick commands), `Confirm` (process visualization), and `Feedback` (results).
  - Implement **Hybrid UI** solutions that blend LUI (Language User Interface) with GUI.
- Use TanStack Query (React Query) for data fetching and state management.
- Maintain a clean separation between services (`frontend/src/services`) and components.
- Use Tailwind CSS for utility-first styling where appropriate, but prefer Ant Design's design system.

### RAG & Indexing
- Use LangChain for chunking and document processing.
- **Database Independence**: Ensure the system remains agnostic of the underlying vector store or metadata database.
- Optimize vector queries for hybrid search (k-NN + BM25) across different providers.
- Ensure all indexed documents include proper metadata for traceability.
- Implement vector store logic using an abstraction layer to support multiple backends.

## Specific Instructions
- When creating new plugins, ensure they implement the `BasePlugin` interface.
- When modifying the UI, ensure consistency with the existing Ant Design theme.
- Always consider security (ACL/RBAC) when designing new features.

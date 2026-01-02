# Marie RAG Indexing - Technical Specifications

## Project Overview

`marie_rag_indexing` is a modular and scalable system designed to index information from multiple data sources for Retrieval-Augmented Generation (RAG) applications. It leverages OpenSearch and other leading vector databases as the primary storage for embeddings and metadata, supporting hybrid search techniques and flexible data ingestion pipelines.

## Core Architecture & Features

### 0. Architectural Philosophy: Hexagonal & SOLID

The system is built following **Hexagonal Architecture (Ports and Adapters)** and **SOLID principles** to ensure it remains database-agnostic, highly testable, and easy to extend:

- **Ports (Interfaces)**: Define the contracts for data ingestion, storage, and processing.
- **Adapters (Implementations)**: Concrete implementations for specific technologies (OpenSearch, Pinecone, MongoDB, etc.).
- **Domain Centric**: The core business logic (chunking, orchestration, RAG logic) is isolated from external infrastructure.
- **Dependency Inversion**: High-level modules do not depend on low-level modules; both depend on abstractions.

### 1. Advanced Indexing & Chunking Engine

The system is designed to support multiple RAG paradigms (Naive, Advanced, Modular, and Agentic) through a robust and highly configurable indexing strategy:

- **LangChain-Powered Chunking**: Full integration with LangChain's text splitters:
  - **Strategies**: Recursive Character, Semantic, Token-based, and specialized splitters (Markdown, HTML, Code).
  - **Parameterization**: Granular control over `chunk_size`, `chunk_overlap`, and separators.
- **Multi-Granularity Indexing**: Support for hierarchical indexing (Parent-Document Retrieval).
- **Knowledge Graph Indexing (GraphRAG)**: 
    - Automated Entity & Relationship Extraction.
    - Community Summarization for global reasoning.
- **Multi-Modal Indexing**:
    - Support for Image (CLIP/SigLIP), Video, and Audio (Transcription).
    - Cross-Modal retrieval in a unified vector space.

### 2. Modular Data Source Architecture (Plugin System)

- **Plugin-based Ingestion**: Standardized interface for all connectors.
- **Core Connectors**:
  - **Databases**: SQL (PostgreSQL, MySQL) and NoSQL (MongoDB).
  - **Web & HTTP Scrapers**: Static and Dynamic (Playwright/Selenium) with recursive crawling.
  - **Object Storage**: S3-compatible (AWS S3, MinIO).
  - **Cloud Services**: Google Drive, OneDrive, SharePoint.
  - **Local File Systems**: Recursive scanning and NAS support.
- **Flexible Field Mapper**: Declarative mapping (YAML/JSON) for source-to-index field translation.

### 3. Multi-Vector Database Support & State Management

The system is designed to be database-agnostic, supporting multiple vector stores through a unified abstraction layer:

- **Supported Vector Databases**:
    - **OpenSearch**: Primary vector engine with native k-NN support.
    - **Pinecone**: Managed, serverless vector database for high-scale applications.
    - **Milvus / Zilliz**: Highly scalable, open-source vector database.
    - **Weaviate**: Multi-modal vector search engine with GraphQL support.
    - **Qdrant**: High-performance vector similarity search engine.
    - **ChromaDB**: Lightweight, AI-native open-source embedding database.
    - **PGVector**: Vector similarity search for PostgreSQL.
- **Hybrid Search**: Optimized for k-NN + BM25 with RRF across supported providers.
- **State & Checkpoints**: A dedicated metadata store (OpenSearch or PostgreSQL) is used to store:
    - Ingestion state and "last processed" markers.
    - Audit logs and document lineage.
    - Checkpoints for fault-tolerant resuming.

### 4. Management Dashboard (Web Interface)

- **Frontend**: Next.js with Ant Design (v6) & Ant Design X (v2.1.2+).
- **Backend**: Flask API for orchestration.
- **AI Interface Strategy**:
    - **RICH Paradigm**: Implementation of Role, Intention, Conversation, and Hybrid UI.
    - **Hybrid UI**: Seamless blending of natural language interactions (LUI) with structured graphical components (GUI).
- **Features**: 
    - Visual job control, real-time progress (using `Confirm` components), live logs, and configuration builders.
    - **AI-Driven Configuration**: Use of `Express` and `Welcome` components to guide users through complex setup tasks.
    - **Specialized MongoDB UI**:
        - Database and collection discovery.
        - Schema-aware field selection for content and metadata.
        - Support for custom aggregation pipelines and find queries.
        - Advanced reference mapping and per-source chunking configuration.

### 5. Reliability & Performance

- **Incremental Re-indexing**: Hash-based change detection.
- **Atomic Updates**: Alias-based indexing to ensure zero downtime.
- **Hardware**: Optional GPU acceleration via CUDA.

## Technical Stack

- **Backend**: Python 3.10+, Flask, LangChain, OpenSearch-Py.
- **Frontend**: Next.js, Ant Design, Ant Design X, TanStack Query.
- **Embeddings**: HuggingFace, OpenAI, CLIP, SigLIP.
- **Infrastructure**: Docker-ready, GPU/CPU compatible.

## Plugin Standard

To integrate a new data source, a plugin must implement:

1. **Source Connector**: Auth and connection logic.
2. **Data Loader**: Streaming logic for the source.
3. **Field Mapper**: Declarative mapping (YAML/JSON).
4. **Parser**: Format conversion.
5. **Schema**: Pydantic parameters.

## Future Roadmap

- Real-time indexing via webhooks and event-driven architectures.
- Advanced temporal indexing for time-series RAG.
- Automated index optimization and pruning based on usage patterns.
- Distributed indexing workers for massive scale ingestion.


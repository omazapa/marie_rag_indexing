# Marie RAG Indexing - Technical Specifications

## Project Overview

`marie_rag_indexing` is a modular and scalable system designed to index information from multiple data sources for Retrieval-Augmented Generation (RAG) applications. It leverages OpenSearch as the primary vector and keyword database, supporting hybrid search techniques and flexible data ingestion pipelines.

## Core Architecture & Features

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

### 3. OpenSearch Integration & State Management

- **Vector Database**: Native OpenSearch Vector Engine support.
- **Hybrid Search**: Optimized for k-NN + BM25 with RRF.
- **State & Checkpoints**: OpenSearch is used to store:
    - Ingestion state and "last processed" markers.
    - Audit logs and document lineage.
    - Checkpoints for fault-tolerant resuming.

### 4. Management Dashboard (Web Interface)

- **Frontend**: Next.js with Ant Design & Ant Design X.
- **Backend**: Flask API for orchestration.
- **Features**: Visual job control, real-time progress, live logs, and configuration builders.

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


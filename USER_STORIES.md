# Marie RAG Indexing - Detailed User Stories

This document outlines the user stories and acceptance criteria for the `marie_rag_indexing` system, covering data ingestion, processing, management, and reliability.

---

## 1. Data Ingestion & Connectivity

### US1.1: Multi-Source Database Connection
**As an** administrator,
**I want to** configure connections to SQL (PostgreSQL, MySQL) and NoSQL (MongoDB) databases,
**so that** I can ingest structured and semi-structured data into the RAG system.
- **Acceptance Criteria:**
    - Support for connection strings and credential management.
    - Ability to test the connection before saving.
    - Support for custom SQL queries or MongoDB aggregation pipelines for data selection.
    - Traceability of which database and table/collection the data originated from.

### US1.2: Advanced Web Scraping
**As a** user,
**I want to** scrape content from static and dynamic (JS-rendered) websites,
**so that** I can index web-based documentation and articles.
- **Acceptance Criteria:**
    - Integration with Playwright/Selenium for dynamic content.
    - Support for recursive crawling with configurable depth.
    - Ability to provide a Sitemap URL for targeted ingestion.
    - Handling of authentication (Basic Auth, Cookies, Headers).

### US1.3: Cloud & Object Storage Integration
**As a** developer,
**I want to** connect to S3-compatible storage (AWS S3, MinIO) and cloud services (Google Drive, OneDrive),
**so that** I can process documents stored in the cloud.
- **Acceptance Criteria:**
    - Support for bucket/folder level scanning.
    - Automatic detection of file types (PDF, DOCX, TXT, etc.).
    - Support for service account authentication (Google Cloud) and Access/Secret keys (S3).

### US1.4: Local & Network File System Scanning
**As a** user,
**I want to** index files from local directories and NAS storage,
**so that** I can make my local knowledge base searchable.
- **Acceptance Criteria:**
    - Recursive directory scanning.
    - Support for large file handling without memory overflow.
    - Monitoring for file changes (optional/future) or manual trigger for re-scan.

---

## 2. Indexing & Chunking Logic

### US2.1: LangChain Strategy Configuration
**As a** data engineer,
**I want to** select and parameterize LangChain chunking strategies,
**so that** I can tailor the data structure to the specific needs of the LLM.
- **Acceptance Criteria:**
    - Support for `RecursiveCharacterTextSplitter`, `SemanticChunker`, and `TokenTextSplitter`.
    - Configurable `chunk_size` and `chunk_overlap`.
    - Specialized splitters for Markdown, HTML, and Code.
    - Preview of chunking results in the UI.

### US2.2: Declarative Field Mapping & Transformation
**As a** user,
**I want to** define how source fields map to the index schema using a simple interface,
**so that** I can standardize metadata across different sources.
- **Acceptance Criteria:**
    - UI/YAML mapping of `source_field` to `target_field`.
    - Support for basic transformations (lowercase, strip, regex).
    - Ability to designate fields as "Content", "Metadata", or "Vector ID".

### US2.3: GraphRAG & Relational Indexing
**As a** researcher,
**I want to** extract entities and relationships during the indexing process,
**so that** I can perform complex relational queries.
- **Acceptance Criteria:**
    - Automated entity extraction using LLMs or NLP models.
    - Storage of relationships in a graph-compatible format within OpenSearch.
    - Generation of community summaries for global reasoning.

### US2.4: Multi-Modal Data Processing
**As a** user,
**I want to** index images, audio, and video alongside text,
**so that** I can build a multi-modal RAG system.
- **Acceptance Criteria:**
    - Use of CLIP/SigLIP for image embeddings.
    - Automatic transcription of audio files before indexing.
    - Cross-modal retrieval capabilities (search images with text).

---

## 3. Management Dashboard (Web UI)

### US3.1: Centralized Management Interface
**As an** operator,
**I want to** use a web dashboard built with Ant Design,
**so that** I can manage all aspects of the system without using the CLI.
- **Acceptance Criteria:**
    - Responsive design using AntD components.
    - Dashboard overview showing system health, active jobs, and index statistics.
    - Secure login and session management.

### US3.2: Visual Ingestion Control
**As a** user,
**I want to** start, pause, stop, and resume indexing jobs visually,
**so that** I have full control over the ingestion process.
- **Acceptance Criteria:**
    - Real-time progress bars for each active job.
    - Ability to view job history and status (Success, Failed, In-Progress).
    - One-click resume for failed or paused jobs.

### US3.3: Live Traceability & Audit Logs
**As a** developer,
**I want to** see live logs and a full audit trail of the ingestion process,
**so that** I can debug issues and verify data lineage.
- **Acceptance Criteria:**
    - Real-time log streaming in the UI.
    - Ability to click on a chunk and see its source document, version, and processing steps.
    - Exportable audit logs for compliance.

---

## 4. Reliability & Performance

### US4.1: Checkpoint System & Fault Tolerance
**As a** system,
**I want to** save the state of ingestion in OpenSearch,
**so that** I can recover from crashes or interruptions.
- **Acceptance Criteria:**
    - Automatic checkpointing after every batch of documents.
    - Persistent storage of "last processed" markers for each source.
    - Zero data loss on system restart.

### US4.2: Incremental Re-indexing
**As an** administrator,
**I want to** only index new or changed documents,
**so that** I can minimize processing time and costs.
- **Acceptance Criteria:**
    - Comparison of document hashes or timestamps to detect changes.
    - Option to force a full re-index if needed.
    - Automatic pruning of deleted documents from the index.

### US4.3: GPU Acceleration Support
**As a** developer,
**I want to** enable GPU acceleration for embedding generation,
**so that** I can process millions of documents efficiently.
- **Acceptance Criteria:**
    - Configurable toggle for GPU/CPU usage.
    - Support for CUDA-enabled environments.
    - Automatic fallback to CPU if GPU is unavailable.

### US4.4: Atomic Index Updates
**As a** user,
**I want** index updates to be atomic,
**so that** the RAG system always provides consistent results.
- **Acceptance Criteria:**
    - Use of aliases or temporary indices during large updates.
    - No downtime for the search API during re-indexing.

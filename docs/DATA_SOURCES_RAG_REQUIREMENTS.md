# Data Sources RAG Requirements

## Overview
This document outlines the requirements for each data source type in the Marie RAG system, focusing on what's needed for effective document retrieval and generation.

## General RAG Requirements (All Sources)

### 1. Connection & Authentication
- Secure credential storage
- Connection validation before indexing
- Error handling for network issues
- Connection pooling for performance

### 2. Content Extraction
- Text extraction from various formats
- Metadata preservation (author, date, title, etc.)
- Structure preservation (headers, sections, lists)
- Language detection

### 3. Chunking Strategy
- Appropriate chunk size based on content type
- Semantic boundaries (paragraphs, sections)
- Context preservation with overlap
- Maximum token limits for embeddings

### 4. Metadata Enrichment
- Source identification (URL, file path, database location)
- Timestamps (created, modified, indexed)
- Custom tags and categories
- Relationships between documents

### 5. Update Detection
- Change tracking for re-indexing
- Incremental updates vs full re-index
- Deletion handling
- Version control

---

## Source-Specific Requirements

### 1. SQL Databases

#### Configuration Needs
```json
{
  "connection_string": "postgresql://user:pass@host:5432/db",
  "tables": ["articles", "documents"],
  "text_fields": ["title", "content", "summary"],
  "metadata_fields": ["author", "created_at", "category"],
  "id_field": "id",
  "batch_size": 1000
}
```

#### RAG Considerations
- **Chunking**: Split long text fields by paragraphs
- **Metadata**: Include table name, primary key, foreign keys
- **Updates**: Use timestamp columns for incremental indexing
- **Relationships**: Join tables for richer context
- **Best For**: Structured content with rich metadata

#### Recommended Settings
- Chunk Size: 500-1000 characters
- Overlap: 100-200 characters
- Strategy: Recursive (respects paragraph breaks)

---

### 2. MongoDB / NoSQL

#### Configuration Needs
```json
{
  "connection_string": "mongodb://localhost:27017",
  "database": "content_db",
  "collection": "articles",
  "text_fields": ["title", "body", "excerpt"],
  "metadata_fields": ["author", "tags", "published_date"],
  "filter_query": {"status": "published"},
  "batch_size": 500
}
```

#### RAG Considerations
- **Chunking**: Handle nested documents and arrays
- **Metadata**: Flatten nested objects, preserve arrays as lists
- **Updates**: Use `_id` or timestamp for change detection
- **Relationships**: Follow references for context
- **Best For**: Semi-structured content, rich metadata

#### Recommended Settings
- Chunk Size: 800-1200 characters
- Overlap: 150-250 characters
- Strategy: Recursive with custom separators for nested content

---

### 3. S3 / Cloud Storage

#### Configuration Needs
```json
{
  "bucket_name": "my-documents",
  "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
  "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "region": "us-east-1",
  "prefix": "documents/",
  "file_extensions": [".pdf", ".docx", ".txt", ".md"],
  "recursive": true,
  "max_file_size_mb": 10
}
```

#### RAG Considerations
- **Chunking**: File-type specific (PDF vs DOCX vs TXT)
- **Metadata**: S3 metadata, file size, MIME type, last modified
- **Updates**: Use ETag or Last-Modified for change detection
- **Relationships**: Folder structure as hierarchy
- **Best For**: Document repositories, file archives

#### Recommended Settings
- Chunk Size: Varies by file type
  - PDF/DOCX: 1000-1500 characters
  - Markdown: 800-1200 characters
  - Plain text: 500-1000 characters
- Overlap: 200-300 characters
- Strategy: Recursive (respects document structure)

#### File-Specific Processing
- **PDF**: Use PyPDF2 or pdfplumber, preserve page numbers
- **DOCX**: Use python-docx, preserve styles and headings
- **Markdown**: Parse headers for hierarchical structure
- **CSV/Excel**: Each row as document with column names as metadata

---

### 4. Web Scraper

#### Configuration Needs
```json
{
  "start_urls": ["https://docs.example.com"],
  "url_patterns": ["^https://docs\\.example\\.com.*"],
  "max_depth": 3,
  "selectors": {
    "content": "article.content",
    "title": "h1.title",
    "author": "span.author",
    "date": "time.published"
  },
  "exclude_patterns": ["/api/", "/admin/"],
  "wait_time": 1,
  "respect_robots_txt": true
}
```

#### RAG Considerations
- **Chunking**: By HTML sections (h2, h3 tags)
- **Metadata**: URL, title, meta tags, scraped date, author
- **Updates**: Check Last-Modified header, hash content
- **Relationships**: Link structure, breadcrumbs, sitemaps
- **Best For**: Documentation, blogs, knowledge bases

#### Recommended Settings
- Chunk Size: 600-1000 characters (web content is often fragmented)
- Overlap: 100-150 characters
- Strategy: Custom separators based on HTML structure (h2, h3, p)

#### Special Considerations
- Handle JavaScript-rendered content (use Selenium/Playwright if needed)
- Rate limiting to avoid being blocked
- Cookie/session management for authenticated content
- HTML cleaning (remove scripts, styles, navigation)

---

### 5. Local File System

#### Configuration Needs
```json
{
  "base_path": "/data/documents",
  "file_extensions": [".txt", ".md", ".pdf", ".docx"],
  "recursive": true,
  "exclude_patterns": ["*.tmp", ".*", "__pycache__"],
  "follow_symlinks": false,
  "max_file_size_mb": 50
}
```

#### RAG Considerations
- **Chunking**: File-type specific (same as S3)
- **Metadata**: File path, size, creation/modification dates, permissions
- **Updates**: Use file modification time (mtime)
- **Relationships**: Directory structure as hierarchy
- **Best For**: Local documentation, code repositories, archives

#### Recommended Settings
- Same as S3 (varies by file type)
- Watch mode for real-time updates

---

### 6. Google Drive

#### Configuration Needs
```json
{
  "credentials_file": "path/to/credentials.json",
  "folder_ids": ["1abc...xyz"],
  "file_types": ["document", "pdf", "spreadsheet"],
  "shared_with_me": false,
  "recursive": true
}
```

#### RAG Considerations
- **Chunking**: By document structure (Google Docs), sheets (Spreadsheets)
- **Metadata**: Owner, shared users, comments, version history
- **Updates**: Use Drive API's change notifications
- **Relationships**: Folder hierarchy, shared access
- **Best For**: Collaborative documents, team knowledge bases

#### Recommended Settings
- Google Docs: 1000-1500 characters, recursive chunking
- Sheets: Each row or sheet as separate document
- PDFs: Same as S3/Local

---

## Cross-Source Best Practices

### 1. Embedding Model Selection
- **Short content (< 500 chars)**: `all-MiniLM-L6-v2` (fast, lightweight)
- **Long content (> 1000 chars)**: `all-mpnet-base-v2` (more accurate)
- **Multilingual**: `paraphrase-multilingual-mpnet-base-v2`
- **Code**: `microsoft/codebert-base`

### 2. Vector Store Index Design
- **Index naming**: `{source_type}_{source_name}_{date}`
- **Sharding**: For large datasets (> 1M documents)
- **Replicas**: For high-availability scenarios
- **Refresh interval**: Balance freshness vs performance

### 3. Chunking Strategy Decision Tree
```
Is content structured (SQL, NoSQL)?
├─ YES: Use table/collection boundaries + text field splits
└─ NO: Is it code?
    ├─ YES: Use AST-based chunking by function/class
    └─ NO: Is it web content?
        ├─ YES: Use HTML section tags (h2, h3)
        └─ NO: Use recursive character splitting with semantic separators
```

### 4. Metadata Schema
Every indexed document should have:
```json
{
  "source_type": "mongodb",
  "source_name": "articles_db",
  "source_id": "unique_identifier",
  "indexed_at": "2024-01-15T10:30:00Z",
  "content_hash": "sha256_hash",
  "chunk_index": 0,
  "total_chunks": 5,
  "metadata": {
    "author": "John Doe",
    "title": "Example Article",
    "tags": ["tutorial", "python"],
    "custom_field": "value"
  }
}
```

### 5. Error Handling & Logging
- Log every document processed (success/failure)
- Track skipped documents with reasons
- Implement retry logic for transient failures
- Provide progress indicators for long ingestion jobs

### 6. Performance Optimization
- **Batch processing**: Group documents for embedding (10-100 docs)
- **Parallel workers**: Use for independent sources
- **Caching**: Cache embeddings for unchanged documents
- **Compression**: Compress stored vectors if supported

---

## UI/UX Recommendations

### Configuration Wizard
1. **Step 1: Source Type** - Select from available plugins
2. **Step 2: Connection** - Enter credentials, test connection
3. **Step 3: Content Selection** - Choose what to index
4. **Step 4: Field Mapping** - Map text and metadata fields
5. **Step 5: Chunking** - Configure strategy with preview
6. **Step 6: Validation** - Preview sample documents before ingestion

### Smart Defaults
- Pre-fill common settings based on source type
- Suggest chunk sizes based on detected content
- Auto-detect text fields in databases
- Recommend separators based on content analysis

### Visual Feedback
- Connection test results with detailed errors
- Document preview before indexing
- Progress bar with estimated time remaining
- Real-time log streaming during ingestion

---

## Testing & Validation

### Pre-Ingestion Checks
1. **Connection valid**: Can authenticate and connect
2. **Content accessible**: Can read sample documents
3. **Fields exist**: Configured fields are present
4. **Chunk size appropriate**: Not too small/large for model
5. **Metadata complete**: Required fields are populated

### Post-Ingestion Verification
1. **Document count**: Expected vs actual indexed
2. **Sample retrieval**: Test queries return relevant results
3. **Metadata preserved**: All fields correctly stored
4. **Vector quality**: Check embedding dimensions and values

---

## Security Considerations

### Credential Management
- Store credentials encrypted (use environment variables)
- Support credential rotation
- Audit access logs
- Use least-privilege principles

### Data Privacy
- PII detection and masking
- Compliance with GDPR, CCPA
- Data retention policies
- User consent tracking

### Access Control
- Source-level permissions
- Document-level filtering
- Query-time access checks
- Audit trails for data access

---

## Monitoring & Maintenance

### Metrics to Track
- **Ingestion rate**: Documents/minute
- **Error rate**: Failed documents/total
- **Index size**: Total vectors, storage used
- **Query performance**: Avg retrieval time
- **Update frequency**: How often sources change

### Alerts
- Connection failures
- High error rates (> 5%)
- Slow ingestion (< 50% expected rate)
- Storage approaching limits
- Stale indexes (not updated in X days)

---

## Future Enhancements

### Planned Features
1. **Incremental indexing**: Only index new/changed documents
2. **Smart chunking**: ML-based chunk boundary detection
3. **Multi-modal**: Support images, audio, video
4. **Knowledge graph**: Build relationships between documents
5. **Auto-tuning**: Optimize chunk size based on retrieval metrics
6. **Collaborative filtering**: Learn from user interactions

### Research Areas
- **Hierarchical embeddings**: Chunk + document + collection levels
- **Contextual chunking**: Use LLM to determine optimal boundaries
- **Adaptive retrieval**: Adjust k and filters based on query complexity
- **Cross-lingual RAG**: Translate queries and documents on-the-fly

---

## References

- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)
- [OpenSearch k-NN Guide](https://opensearch.org/docs/latest/search-plugins/knn/index/)
- [Sentence Transformers Models](https://www.sbert.net/docs/pretrained_models.html)
- [RAG Best Practices (Pinecone)](https://www.pinecone.io/learn/retrieval-augmented-generation/)

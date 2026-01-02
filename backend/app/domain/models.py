from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class Document(BaseModel):
    content: str
    metadata: Dict[str, Any]
    source_id: str

class Chunk(BaseModel):
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None
    source_id: str
    chunk_id: str

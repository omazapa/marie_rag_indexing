from typing import Any

from pydantic import BaseModel


class Document(BaseModel):
    content: str
    metadata: dict[str, Any]
    source_id: str


class Chunk(BaseModel):
    content: str
    metadata: dict[str, Any]
    embedding: list[float] | None = None
    source_id: str
    chunk_id: str

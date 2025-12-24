from typing import List, Dict, Any
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    CharacterTextSplitter,
    TokenTextSplitter,
    MarkdownHeaderTextSplitter
)
from langchain_community.document_loaders import TextLoader
from pydantic import BaseModel

class ChunkConfig(BaseModel):
    strategy: str = "recursive"  # recursive, character, token, markdown
    chunk_size: int = 1000
    chunk_overlap: int = 200
    separators: List[str] = None
    encoding_name: str = "cl100k_base"  # for token splitting

class ChunkingEngine:
    """
    Engine to handle document chunking using LangChain strategies.
    """
    
    def __init__(self, config: ChunkConfig):
        self.config = config
        self.splitter = self._get_splitter()

    def _get_splitter(self):
        # Unescape common separators if provided as strings like "\n"
        separators = self.config.separators
        if separators:
            separators = [s.replace("\\n", "\n").replace("\\t", "\t").replace("\\r", "\r") for s in separators]

        if self.config.strategy == "recursive":
            kwargs = {
                "chunk_size": self.config.chunk_size,
                "chunk_overlap": self.config.chunk_overlap,
            }
            if separators:
                kwargs["separators"] = separators
            return RecursiveCharacterTextSplitter(**kwargs)
        elif self.config.strategy == "character":
            return CharacterTextSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap,
                separator=separators[0] if separators else "\n\n"
            )
        elif self.config.strategy == "token":
            return TokenTextSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap,
                encoding_name=self.config.encoding_name
            )
        else:
            # Default to recursive if strategy is unknown
            return RecursiveCharacterTextSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap
            )

    def split_text(self, text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Splits text into chunks and attaches metadata.
        """
        chunks = self.splitter.split_text(text)
        result = []
        for i, chunk in enumerate(chunks):
            chunk_metadata = metadata.copy() if metadata else {}
            chunk_metadata["chunk_index"] = i
            result.append({
                "content": chunk,
                "metadata": chunk_metadata
            })
        return result

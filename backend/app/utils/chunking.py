"""
Document chunking utilities for the RAG pipeline.
Supports PDF, DOCX, TXT, CSV with intelligent chunking strategies.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.core.logging import get_logger

logger = get_logger(__name__)

CHUNK_SIZE = 800       # tokens (approx chars / 4)
CHUNK_OVERLAP = 150    # overlap to preserve context across chunks


@dataclass
class DocumentChunk:
    content: str
    metadata: dict
    chunk_index: int


def _chunk_text(text: str, filename: str, page: int = 0) -> list[DocumentChunk]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    chunk_index = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + CHUNK_SIZE * 4, text_len)  # *4 chars per token approx
        chunk_text = text[start:end].strip()

        if chunk_text:
            chunks.append(DocumentChunk(
                content=chunk_text,
                metadata={
                    "filename": filename,
                    "page": page,
                    "chunk_index": chunk_index,
                    "start_char": start,
                    "end_char": end,
                },
                chunk_index=chunk_index,
            ))
            chunk_index += 1

        start = end - CHUNK_OVERLAP * 4  # overlap
        if start >= text_len:
            break

    return chunks


async def chunk_pdf(file_bytes: bytes, filename: str) -> list[DocumentChunk]:
    """Extract text from PDF and chunk it page by page."""
    from pypdf import PdfReader

    chunks = []
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        for page_num, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                page_chunks = _chunk_text(text, filename, page=page_num + 1)
                chunks.extend(page_chunks)
        logger.info("chunking.pdf", filename=filename, pages=len(reader.pages), chunks=len(chunks))
    except Exception as e:
        logger.error("chunking.pdf.error", error=str(e), filename=filename)
    return chunks


async def chunk_docx(file_bytes: bytes, filename: str) -> list[DocumentChunk]:
    """Extract text from DOCX."""
    from docx import Document

    chunks = []
    try:
        doc = Document(io.BytesIO(file_bytes))
        full_text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        chunks = _chunk_text(full_text, filename)
        logger.info("chunking.docx", filename=filename, chunks=len(chunks))
    except Exception as e:
        logger.error("chunking.docx.error", error=str(e))
    return chunks


async def chunk_txt(file_bytes: bytes, filename: str) -> list[DocumentChunk]:
    """Chunk plain text files."""
    try:
        text = file_bytes.decode("utf-8", errors="replace")
        chunks = _chunk_text(text, filename)
        logger.info("chunking.txt", filename=filename, chunks=len(chunks))
        return chunks
    except Exception as e:
        logger.error("chunking.txt.error", error=str(e))
        return []


async def chunk_csv(file_bytes: bytes, filename: str) -> list[DocumentChunk]:
    """Convert CSV to readable text chunks."""
    import pandas as pd

    chunks = []
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
        # Convert to readable text representation
        text = f"CSV File: {filename}\n\nColumns: {', '.join(df.columns.tolist())}\n\n"
        text += df.to_string(index=False, max_rows=500)
        chunks = _chunk_text(text, filename)
        logger.info("chunking.csv", filename=filename, rows=len(df), chunks=len(chunks))
    except Exception as e:
        logger.error("chunking.csv.error", error=str(e))
    return chunks


async def chunk_document(
    file_bytes: bytes, filename: str, file_type: str
) -> list[DocumentChunk]:
    """Route to the correct chunker based on file type."""
    handlers = {
        "pdf": chunk_pdf,
        "docx": chunk_docx,
        "txt": chunk_txt,
        "csv": chunk_csv,
    }
    handler = handlers.get(file_type.lower())
    if not handler:
        raise ValueError(f"Unsupported file type: {file_type}")
    return await handler(file_bytes, filename)

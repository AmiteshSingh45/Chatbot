"""
RAG Service — FAISS-based document retrieval.
Replaces ChromaDB with fully local FAISS indexes.

Pipeline:
1. Upload → local disk storage
2. Parse (PDF/DOCX/TXT/CSV)
3. Chunk (RecursiveCharacterTextSplitter: 1000/200)
4. Embed (SentenceTransformers all-MiniLM-L6-v2)
5. Index (FAISS per-file)
6. Retrieve (semantic similarity search)
7. Rerank (by distance score)
"""
import asyncio
import pickle
from pathlib import Path
from typing import Any, Optional
from functools import lru_cache

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False


class RAGService:
    """
    Manages FAISS indexes for document RAG.
    Each uploaded file gets its own FAISS index: {FAISS_INDEX_DIR}/doc_{file_id}.faiss
    """

    def __init__(self) -> None:
        self.index_dir = settings.faiss_index_path
        self._embedding_model = None

    def _get_model(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._embedding_model

    def _embed(self, texts: list[str]) -> np.ndarray:
        model = self._get_model()
        return model.encode(texts, normalize_embeddings=True, batch_size=16).astype(np.float32)

    def _file_index_paths(self, file_id: str) -> tuple[Path, Path]:
        return (
            self.index_dir / f"doc_{file_id}.faiss",
            self.index_dir / f"doc_{file_id}_chunks.pkl",
        )

    async def index_document(
        self,
        file_id: str,
        chunks: list[dict],  # [{"content": "...", "metadata": {...}}]
    ) -> int:
        """
        Build and save FAISS index for a document's chunks.
        Returns number of chunks indexed.
        """
        if not chunks:
            return 0

        texts = [c["content"] for c in chunks]

        # Run CPU-intensive embedding in thread pool
        embeddings = await asyncio.get_event_loop().run_in_executor(
            None, self._embed, texts
        )

        faiss_path, chunks_path = self._file_index_paths(file_id)

        if FAISS_AVAILABLE:
            index = faiss.IndexFlatIP(384)  # Inner product = cosine on normalized vectors
            index.add(embeddings)
            faiss.write_index(index, str(faiss_path))

        # Always save chunks metadata
        with open(chunks_path, "wb") as f:
            pickle.dump(chunks, f)

        logger.info("rag_service.indexed", file_id=file_id, chunks=len(chunks))
        return len(chunks)

    async def retrieve(
        self,
        query: str,
        user_id: str,
        file_ids: Optional[list[str]] = None,
        top_k: int = 5,
        threshold: float = 0.25,
    ) -> tuple[list[str], list[dict]]:
        """
        Retrieve relevant chunks for a query.
        Returns: (chunk_texts, citations)
        """
        if not FAISS_AVAILABLE:
            return [], []

        # Build query embedding
        query_embedding = await asyncio.get_event_loop().run_in_executor(
            None, self._embed, [query]
        )

        all_chunks = []
        all_scores = []
        all_meta = []

        # Find relevant file IDs
        if file_ids:
            ids_to_search = file_ids
        else:
            # Search all files for this user
            ids_to_search = self._get_user_file_ids(user_id)

        for file_id in ids_to_search:
            faiss_path, chunks_path = self._file_index_paths(file_id)

            if not faiss_path.exists() or not chunks_path.exists():
                continue

            try:
                index = faiss.read_index(str(faiss_path))
                with open(chunks_path, "rb") as f:
                    chunks = pickle.load(f)

                k = min(top_k, index.ntotal)
                distances, indices = index.search(query_embedding, k=k)

                for dist, idx in zip(distances[0], indices[0]):
                    if idx < 0 or idx >= len(chunks) or dist < threshold:
                        continue
                    all_chunks.append(chunks[idx]["content"])
                    all_scores.append(float(dist))
                    all_meta.append({
                        "file_id": file_id,
                        "score": float(dist),
                        **chunks[idx].get("metadata", {}),
                    })

            except Exception as e:
                logger.error("rag_service.retrieve_error", file_id=file_id, error=str(e))

        if not all_chunks:
            return [], []

        # Sort by score and take top_k
        combined = sorted(zip(all_scores, all_chunks, all_meta), reverse=True)[:top_k]
        sorted_chunks = [c for _, c, _ in combined]
        citations = [
            {
                "index": i + 1,
                "source": m.get("filename", f"Document {m.get('file_id', '')[:8]}"),
                "page": m.get("page", "N/A"),
                "score": round(m["score"], 3),
                "file_id": m.get("file_id"),
            }
            for i, (_, _, m) in enumerate(combined)
        ]

        return sorted_chunks, citations

    def _get_user_file_ids(self, user_id: str) -> list[str]:
        """Find all FAISS index files in the index directory."""
        if not self.index_dir.exists():
            return []
        return [
            p.stem.replace("doc_", "")
            for p in self.index_dir.glob("doc_*.faiss")
        ]

    def delete_document_index(self, file_id: str) -> bool:
        """Delete FAISS index and chunks for a file."""
        faiss_path, chunks_path = self._file_index_paths(file_id)
        deleted = False
        for p in [faiss_path, chunks_path]:
            if p.exists():
                p.unlink()
                deleted = True
        return deleted


@lru_cache(maxsize=1)
def get_rag_service() -> RAGService:
    """Singleton RAG service."""
    return RAGService()

"""
Long-Term Memory Service — FAISS + SQLite implementation.
Provides semantic search over user memories across conversation sessions.

Memory Architecture:
- Text + metadata → SQLite (memories table)
- Vector embeddings → FAISS index (per user, saved to disk)

Memory types supported:
- semantic:    User facts (name, job, college, skills, preferences)
- episodic:    Past conversation summaries
- procedural:  Agent behavior instructions
- working:     Current session context (not persisted to FAISS)

This gives NexusAI a "Claude-like" persistent memory experience.
"""
import asyncio
import json
import os
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
    logger.warning("memory_service.faiss_unavailable", fallback="no_vector_search")


class MemoryService:
    """
    Manages long-term user memory with FAISS semantic search.

    Each user has their own FAISS index stored at:
    {FAISS_INDEX_DIR}/memory_{user_id}.faiss
    {FAISS_INDEX_DIR}/memory_{user_id}_meta.pkl  (text + metadata)
    """

    def __init__(self) -> None:
        self.index_dir = settings.faiss_index_path
        self._indexes: dict[str, Any] = {}       # user_id → faiss.Index
        self._metadata: dict[str, list[dict]] = {}  # user_id → list of memory dicts
        self._embedding_model = None
        self._lock = asyncio.Lock()

    def _get_embedding_model(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer(
                settings.MEMORY_EMBEDDING_MODEL
            )
            logger.info("memory_service.model_loaded", model=settings.MEMORY_EMBEDDING_MODEL)
        return self._embedding_model

    def _embed(self, texts: list[str]) -> np.ndarray:
        """Embed texts and return normalized numpy array."""
        model = self._get_embedding_model()
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=16)
        return embeddings.astype(np.float32)

    def _user_index_path(self, user_id: str) -> tuple[Path, Path]:
        """Returns (faiss_path, metadata_path) for a user."""
        safe_id = user_id.replace("-", "_")
        return (
            self.index_dir / f"memory_{safe_id}.faiss",
            self.index_dir / f"memory_{safe_id}_meta.pkl",
        )

    def _load_user_index(self, user_id: str) -> tuple[Any, list[dict]]:
        """Load or create FAISS index + metadata for a user."""
        if user_id in self._indexes:
            return self._indexes[user_id], self._metadata[user_id]

        faiss_path, meta_path = self._user_index_path(user_id)

        if faiss_path.exists() and meta_path.exists() and FAISS_AVAILABLE:
            try:
                index = faiss.read_index(str(faiss_path))
                with open(meta_path, "rb") as f:
                    metadata = pickle.load(f)
                logger.info(
                    "memory_service.index_loaded",
                    user_id=user_id,
                    count=len(metadata),
                )
            except Exception as e:
                logger.error("memory_service.load_error", error=str(e))
                index = faiss.IndexFlatIP(384) if FAISS_AVAILABLE else None  # Inner product for cosine
                metadata = []
        else:
            if FAISS_AVAILABLE:
                index = faiss.IndexFlatIP(384)
            else:
                index = None
            metadata = []

        self._indexes[user_id] = index
        self._metadata[user_id] = metadata
        return index, metadata

    def _save_user_index(self, user_id: str) -> None:
        """Persist FAISS index and metadata to disk."""
        if not FAISS_AVAILABLE:
            return
        index = self._indexes.get(user_id)
        metadata = self._metadata.get(user_id, [])
        if index is None:
            return

        faiss_path, meta_path = self._user_index_path(user_id)
        try:
            faiss.write_index(index, str(faiss_path))
            with open(meta_path, "wb") as f:
                pickle.dump(metadata, f)
        except Exception as e:
            logger.error("memory_service.save_error", error=str(e))

    async def store(
        self,
        user_id: str,
        memory_text: str,
        memory_type: str = "semantic",
        category: str = "general",
        importance_score: float = 0.5,
        source_conversation_id: Optional[str] = None,
    ) -> str:
        """
        Store a new memory fact for a user.
        Returns the memory ID.
        """
        import uuid
        memory_id = str(uuid.uuid4())

        async with self._lock:
            index, metadata = self._load_user_index(user_id)

            # Check for near-duplicate (avoid storing same fact twice)
            if metadata and FAISS_AVAILABLE and index.ntotal > 0:
                embedding = self._embed([memory_text])
                distances, _ = index.search(embedding, k=1)
                if distances[0][0] > 0.95:  # Very similar already exists
                    logger.debug("memory_service.duplicate_skipped", user_id=user_id)
                    return memory_id

            # Store in FAISS
            if FAISS_AVAILABLE:
                embedding = self._embed([memory_text])
                index.add(embedding)

            # Store metadata
            memory_record = {
                "id": memory_id,
                "memory_text": memory_text,
                "memory_type": memory_type,
                "category": category,
                "importance_score": importance_score,
                "source_conversation_id": source_conversation_id,
                "access_count": 0,
                "faiss_index_id": len(metadata),
            }
            metadata.append(memory_record)

            # Persist to disk
            self._save_user_index(user_id)

            # Also persist to SQLite
            await self._persist_to_db(user_id, memory_record)

        logger.info(
            "memory_service.stored",
            user_id=user_id,
            category=category,
            memory_preview=memory_text[:60],
        )
        return memory_id

    async def _persist_to_db(self, user_id: str, record: dict) -> None:
        """Save memory to SQLite as well (for admin/API access)."""
        try:
            from app.db.session import AsyncSessionFactory
            from app.models.memory import Memory

            async with AsyncSessionFactory() as db:
                mem = Memory(
                    id=record["id"],
                    user_id=user_id,
                    memory_text=record["memory_text"],
                    memory_type=record["memory_type"],
                    category=record["category"],
                    importance_score=record["importance_score"],
                    source_conversation_id=record.get("source_conversation_id"),
                    faiss_index_id=record["faiss_index_id"],
                )
                db.add(mem)
                await db.commit()
        except Exception as e:
            logger.warning("memory_service.db_persist_error", error=str(e))

    async def retrieve(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        threshold: float = 0.3,
        memory_type: Optional[str] = None,
    ) -> list[dict]:
        """
        Retrieve semantically relevant memories for a query.
        Returns list of memory dicts sorted by relevance.
        """
        if not FAISS_AVAILABLE:
            return self._fallback_retrieve(user_id, query, top_k)

        async with self._lock:
            index, metadata = self._load_user_index(user_id)

        if not metadata or index.ntotal == 0:
            return []

        try:
            query_embedding = self._embed([query])
            k = min(top_k, index.ntotal)
            distances, indices = index.search(query_embedding, k=k)

            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx < 0 or idx >= len(metadata):
                    continue
                if dist < threshold:
                    continue

                mem = dict(metadata[idx])
                mem["similarity_score"] = float(dist)

                # Filter by type if requested
                if memory_type and mem.get("memory_type") != memory_type:
                    continue

                results.append(mem)

            # Update access counts
            for mem in results:
                fid = mem.get("faiss_index_id", -1)
                if 0 <= fid < len(metadata):
                    metadata[fid]["access_count"] = metadata[fid].get("access_count", 0) + 1

            return sorted(results, key=lambda x: x["similarity_score"], reverse=True)

        except Exception as e:
            logger.error("memory_service.retrieve_error", error=str(e))
            return []

    def _fallback_retrieve(self, user_id: str, query: str, top_k: int) -> list[dict]:
        """Simple text matching fallback when FAISS is unavailable."""
        _, metadata = self._load_user_index(user_id)
        query_lower = query.lower()
        results = []
        for mem in metadata:
            text = mem.get("memory_text", "").lower()
            # Simple keyword overlap score
            words = set(query_lower.split())
            mem_words = set(text.split())
            overlap = len(words & mem_words) / max(len(words), 1)
            if overlap > 0.1:
                results.append({**mem, "similarity_score": overlap})
        return sorted(results, key=lambda x: x["similarity_score"], reverse=True)[:top_k]

    async def list_memories(self, user_id: str) -> list[dict]:
        """List all memories for a user (for API/UI)."""
        async with self._lock:
            _, metadata = self._load_user_index(user_id)
        return list(metadata)

    async def delete_memory(self, user_id: str, memory_id: str) -> bool:
        """
        Delete a memory by ID.
        Note: FAISS doesn't support deletion by ID natively.
        We mark it as deleted in metadata and rebuild the index periodically.
        """
        async with self._lock:
            _, metadata = self._load_user_index(user_id)
            before = len(metadata)
            self._metadata[user_id] = [m for m in metadata if m.get("id") != memory_id]
            if len(self._metadata[user_id]) < before:
                # Rebuild FAISS index without deleted entry
                await self._rebuild_index(user_id)
                self._save_user_index(user_id)
                return True
        return False

    async def _rebuild_index(self, user_id: str) -> None:
        """Rebuild FAISS index from current metadata (after deletions)."""
        if not FAISS_AVAILABLE:
            return
        metadata = self._metadata.get(user_id, [])
        if not metadata:
            self._indexes[user_id] = faiss.IndexFlatIP(384)
            return

        texts = [m["memory_text"] for m in metadata]
        embeddings = self._embed(texts)
        index = faiss.IndexFlatIP(384)
        index.add(embeddings)
        self._indexes[user_id] = index

        # Update faiss_index_ids
        for i, m in enumerate(metadata):
            m["faiss_index_id"] = i


@lru_cache(maxsize=1)
def get_memory_service() -> MemoryService:
    """Singleton memory service instance."""
    return MemoryService()

"""
Embedding utilities — wraps sentence-transformers for consistent embedding generation.
Used by both the RAG pipeline and the memory system.
"""
from functools import lru_cache
from typing import Callable

from sentence_transformers import SentenceTransformer

from app.core.logging import get_logger

logger = get_logger(__name__)

# MiniLM-L6-v2: 384 dimensions, fast, free, runs locally
MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    logger.info("embeddings.loading_model", model=MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


def get_embedding_function() -> Callable[[list[str]], list[list[float]]]:
    """
    Returns a callable that embeds a list of texts.
    Compatible with ChromaDB's embedding_function interface.
    """
    model = _load_model()

    def embed(texts: list[str]) -> list[list[float]]:
        embeddings = model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    return embed


def embed_single(text: str) -> list[float]:
    """Embed a single text string."""
    model = _load_model()
    return model.encode([text], normalize_embeddings=True)[0].tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts efficiently."""
    model = _load_model()
    return model.encode(texts, normalize_embeddings=True, batch_size=32).tolist()

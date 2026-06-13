"""
Long-term Memory SQLAlchemy model.
Vectors stored in FAISS (not in DB). SQLite stores metadata + text only.
"""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class Memory(UUIDMixin, TimestampMixin, Base):
    """
    Long-term memory store for user facts.
    Text + metadata stored in SQLite.
    Vector embeddings stored in a FAISS index (per user).

    Memory types:
    - "semantic"    → facts about the user (name, job, preferences)
    - "episodic"    → past conversation summaries
    - "procedural"  → agent behavior preferences
    - "working"     → current session context (ephemeral, not persisted long)
    """

    __tablename__ = "memories"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The extracted fact/insight text
    memory_text: Mapped[str] = mapped_column(Text, nullable=False)

    # FAISS vector index position for this memory
    faiss_index_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Importance score 0.0-1.0 (higher = retain longer)
    importance_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.5
    )

    # Memory type for filtering and retrieval strategy
    memory_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="semantic"
    )

    # Fine-grained category: "preference", "fact", "goal", "context", "skill"
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Which conversation originated this memory
    source_conversation_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )

    # How many times this memory was retrieved (relevance signal)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Last similarity score when retrieved (for decay management)
    last_similarity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # --- Relationships ---
    user: Mapped["User"] = relationship("User", back_populates="memories")

    def __repr__(self) -> str:
        return f"<Memory id={self.id} type={self.memory_type} category={self.category}>"

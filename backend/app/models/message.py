"""Message SQLAlchemy model — SQLite compatible."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(UUIDMixin, TimestampMixin, Base):
    """
    Individual messages within a conversation.
    role: "user" | "assistant" | "system" | "tool"
    """

    __tablename__ = "messages"

    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Token usage tracking
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Agent metadata: which agent, tools used, citations — stored as JSON string
    metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Which agent node processed this message
    agent_used: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Execution steps recorded during this response
    agent_steps: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Citations from RAG — stored as JSON string
    citations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_regenerated: Mapped[bool] = mapped_column(default=False, nullable=False)

    # --- Relationships ---
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} role={self.role}>"

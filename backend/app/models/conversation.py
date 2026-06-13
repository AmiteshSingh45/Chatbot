"""Conversation SQLAlchemy model — SQLite compatible."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.message import Message


class Conversation(UUIDMixin, TimestampMixin, Base):
    """
    Each conversation is a chat thread with its own LangGraph thread_id.
    Thread-isolated memory — different threads NEVER share state.
    """

    __tablename__ = "conversations"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(500), nullable=False, default="New Chat"
    )

    # LangGraph thread ID — maps to checkpointer thread
    thread_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Model selected for this conversation
    model: Mapped[str] = mapped_column(
        String(100), nullable=False, default="llama-3.3-70b-versatile"
    )

    # Extra metadata as JSON string (temperature, system prompt, etc.)
    meta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- Relationships ---
    user: Mapped["User"] = relationship("User", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} title={self.title!r}>"

"""UploadedFile model — SQLite compatible, local storage."""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class UploadedFile(UUIDMixin, TimestampMixin, Base):
    """
    Tracks uploaded documents for RAG.
    File stored locally on disk. FAISS index per file.
    """

    __tablename__ = "uploaded_files"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Conversation this file is attached to (optional)
    conversation_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )

    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, docx, txt, csv
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes

    # Local disk path relative to UPLOAD_DIR
    local_path: Mapped[str] = mapped_column(String(1000), nullable=False, default="")

    # FAISS index name for this file's embeddings
    faiss_index_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Processing status
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # pending | processing | ready | failed

    chunk_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Extracted document metadata (title, author, pages, etc.) as JSON string
    doc_metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Processing error if failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- Relationships ---
    user: Mapped["User"] = relationship("User", back_populates="uploaded_files")

    def __repr__(self) -> str:
        return f"<UploadedFile id={self.id} filename={self.original_filename!r} status={self.status}>"

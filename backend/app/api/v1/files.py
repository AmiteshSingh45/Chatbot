"""
Files API — upload documents, list files, delete files.
Triggers the async RAG processing pipeline.
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.db.session import get_db
from app.models.user import User
from app.services.file_service import FileService, FileRepository

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/csv": "csv",
}


def _serialize_file(f) -> dict:
    return {
        "id": str(f.id),
        "original_filename": f.original_filename,
        "file_type": f.file_type,
        "file_url": f.file_url,
        "status": f.status,
        "chunk_count": f.chunk_count,
        "file_size": f.file_size,
        "conversation_id": str(f.conversation_id) if f.conversation_id else None,
        "created_at": f.created_at.isoformat(),
    }


@router.post("/upload", status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document for RAG processing.
    Supports: PDF, DOCX, TXT, CSV (max 20MB).
    Processing is synchronous here; for production, move to a background task queue.
    """
    content_type = file.content_type or ""
    file_type = ALLOWED_CONTENT_TYPES.get(content_type)

    # Fallback: infer from filename extension
    if not file_type and file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext in {"pdf", "docx", "txt", "csv"}:
            file_type = ext

    if not file_type:
        from app.core.exceptions import UnsupportedFileTypeError
        raise UnsupportedFileTypeError(content_type)

    file_bytes = await file.read()
    service = FileService(db)
    uploaded = await service.upload_and_process(
        file_bytes=file_bytes,
        filename=file.filename or "document",
        file_type=file_type,
        user_id=str(current_user.id),
        conversation_id=conversation_id,
    )
    return _serialize_file(uploaded)


@router.get("")
async def list_files(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded files for the current user."""
    repo = FileRepository(db)
    files = await repo.get_all(user_id=current_user.id, limit=100)
    return [_serialize_file(f) for f in files]


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an uploaded file and its vector embeddings."""
    repo = FileRepository(db)
    f = await repo.get_by_id(file_id)
    if not f:
        raise NotFoundError("File", str(file_id))
    if f.user_id != current_user.id:
        raise PermissionDeniedError()

    # Delete from ChromaDB
    if f.vector_collection_id:
        try:
            import chromadb
            from app.core.config import settings
            client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
            client.delete_collection(f.vector_collection_id)
        except Exception:
            pass  # Best-effort

    await repo.delete(f)

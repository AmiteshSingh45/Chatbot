"""
Files API — upload documents, list files, delete files.
Triggers the async RAG processing pipeline (local FAISS, no ChromaDB).
"""
import json
import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.dependencies import get_current_user
from app.core.exceptions import NotFoundError, PermissionDeniedError, UnsupportedFileTypeError
from app.db.session import get_db
from app.models.uploaded_file import UploadedFile
from app.models.user import User
from app.services.file_service import FileService

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/csv": "csv",
    "text/markdown": "md",
}


def _serialize(f: UploadedFile) -> dict:
    meta = {}
    try:
        if f.doc_metadata:
            meta = json.loads(f.doc_metadata)
    except Exception:
        pass
    return {
        "id": str(f.id),
        "original_filename": f.original_filename,
        "file_type": f.file_type,
        "status": f.status,
        "chunk_count": f.chunk_count,
        "file_size": f.file_size,
        "conversation_id": str(f.conversation_id) if f.conversation_id else None,
        "faiss_index_name": f.faiss_index_name,
        "metadata": meta,
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
    Supports: PDF, DOCX, TXT, CSV, MD (max 20MB).
    Processing runs in background — poll status via GET /files.
    """
    content_type = file.content_type or ""
    file_type = ALLOWED_CONTENT_TYPES.get(content_type)

    # Fallback: infer from filename extension
    if not file_type and file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext in {"pdf", "docx", "txt", "csv", "md"}:
            file_type = ext

    if not file_type:
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
    await db.commit()
    return _serialize(uploaded)


@router.get("")
async def list_files(
    conversation_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List uploaded files for the current user."""
    query = select(UploadedFile).where(
        UploadedFile.user_id == str(current_user.id)
    )
    if conversation_id:
        query = query.where(UploadedFile.conversation_id == conversation_id)
    query = query.order_by(UploadedFile.created_at.desc()).limit(50)
    result = await db.execute(query)
    return [_serialize(f) for f in result.scalars().all()]


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get file status and metadata."""
    result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == file_id)
    )
    f = result.scalar_one_or_none()
    if not f:
        raise NotFoundError("File", file_id)
    if str(f.user_id) != str(current_user.id):
        raise PermissionDeniedError()
    return _serialize(f)


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a file and its FAISS vector embeddings."""
    result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == file_id)
    )
    f = result.scalar_one_or_none()
    if not f:
        raise NotFoundError("File", file_id)
    if str(f.user_id) != str(current_user.id):
        raise PermissionDeniedError()

    service = FileService(db)
    await service.delete_file(file_id, str(current_user.id))

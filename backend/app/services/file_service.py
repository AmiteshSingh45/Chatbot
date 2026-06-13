"""
File Service — handles local file upload, chunking, embedding, and FAISS indexing.
Replaces Cloudinary + ChromaDB with fully local storage.

RAG Pipeline:
1. Validate file type + size
2. Save to local UPLOAD_DIR
3. Parse document (PDF/DOCX/TXT/CSV)
4. Chunk with RecursiveCharacterTextSplitter (1000/200)
5. Embed with SentenceTransformers
6. Build FAISS index per file
7. Update DB record to 'ready'
"""
import asyncio
import json
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import FileUploadError, UnsupportedFileTypeError
from app.core.logging import get_logger
from app.models.uploaded_file import UploadedFile

logger = get_logger(__name__)

ALLOWED_TYPES = {"pdf", "docx", "txt", "csv", "md"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# RecursiveCharacterTextSplitter settings (as per spec)
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


class FileService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def upload_and_process(
        self,
        file_bytes: bytes,
        filename: str,
        file_type: str,
        user_id: str,
        conversation_id: Optional[str] = None,
    ) -> UploadedFile:
        """
        Full RAG ingestion pipeline:
        validate → save locally → parse → chunk → embed → FAISS index → DB update
        """
        ext = file_type.lower().lstrip(".")
        if ext not in ALLOWED_TYPES:
            raise UnsupportedFileTypeError(ext)
        if len(file_bytes) > MAX_FILE_SIZE:
            raise FileUploadError(f"File too large. Max is {MAX_FILE_SIZE // (1024*1024)}MB")

        file_id = str(uuid.uuid4())

        # 1. Save file locally
        upload_dir = settings.upload_path / user_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        local_filename = f"{file_id}_{filename}"
        local_path = upload_dir / local_filename

        async with aiofiles.open(local_path, "wb") as f:
            await f.write(file_bytes)

        # 2. Create DB record
        db_file = UploadedFile(
            id=file_id,
            user_id=user_id,
            conversation_id=conversation_id,
            original_filename=filename,
            file_type=ext,
            file_size=len(file_bytes),
            local_path=str(local_path),
            status="processing",
        )
        self.db.add(db_file)
        await self.db.flush()

        # 3. Process in background (non-blocking)
        asyncio.create_task(
            self._process_document(db_file, file_bytes, filename, ext, file_id)
        )

        return db_file

    async def _process_document(
        self,
        db_file: UploadedFile,
        file_bytes: bytes,
        filename: str,
        ext: str,
        file_id: str,
    ) -> None:
        """Background task: parse, chunk, embed, index."""
        try:
            # Parse document
            chunks = await asyncio.get_event_loop().run_in_executor(
                None, self._parse_and_chunk, file_bytes, filename, ext
            )

            if not chunks:
                raise FileUploadError("Could not extract text from document")

            # Build FAISS index
            from app.services.rag_service import get_rag_service
            rag_service = get_rag_service()
            count = await rag_service.index_document(file_id, chunks)

            # Update DB record
            from app.db.session import AsyncSessionFactory
            async with AsyncSessionFactory() as new_db:
                from sqlalchemy import select
                result = await new_db.execute(
                    select(UploadedFile).where(UploadedFile.id == file_id)
                )
                file_record = result.scalar_one_or_none()
                if file_record:
                    file_record.status = "ready"
                    file_record.chunk_count = count
                    file_record.faiss_index_name = f"doc_{file_id}"
                    file_record.doc_metadata = json.dumps({
                        "filename": filename,
                        "chunks": count,
                        "type": ext,
                    })
                    await new_db.commit()

            logger.info(
                "file_service.processed",
                file_id=file_id,
                chunks=count,
                filename=filename,
            )

        except Exception as e:
            logger.error("file_service.processing_error", error=str(e), filename=filename)
            try:
                from app.db.session import AsyncSessionFactory
                async with AsyncSessionFactory() as new_db:
                    from sqlalchemy import select
                    result = await new_db.execute(
                        select(UploadedFile).where(UploadedFile.id == file_id)
                    )
                    file_record = result.scalar_one_or_none()
                    if file_record:
                        file_record.status = "failed"
                        file_record.error_message = str(e)[:500]
                        await new_db.commit()
            except Exception:
                pass

    def _parse_and_chunk(
        self, file_bytes: bytes, filename: str, ext: str
    ) -> list[dict]:
        """
        Parse document and split into chunks using RecursiveCharacterTextSplitter.
        Returns list of {"content": str, "metadata": dict} dicts.
        """
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

        full_text = self._extract_text(file_bytes, filename, ext)
        if not full_text.strip():
            return []

        texts = splitter.split_text(full_text)
        return [
            {
                "content": t,
                "metadata": {
                    "filename": filename,
                    "page": "N/A",
                    "chunk_index": i,
                    "file_type": ext,
                },
            }
            for i, t in enumerate(texts)
        ]

    def _extract_text(self, file_bytes: bytes, filename: str, ext: str) -> str:
        """Extract plain text from various file types."""
        if ext == "pdf":
            return self._extract_pdf(file_bytes)
        elif ext == "docx":
            return self._extract_docx(file_bytes)
        elif ext in ("txt", "md"):
            return file_bytes.decode("utf-8", errors="ignore")
        elif ext == "csv":
            return self._extract_csv(file_bytes)
        return ""

    def _extract_pdf(self, file_bytes: bytes) -> str:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {i+1}]\n{text}")
        return "\n\n".join(pages)

    def _extract_docx(self, file_bytes: bytes) -> str:
        import io
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    def _extract_csv(self, file_bytes: bytes) -> str:
        import io
        import pandas as pd
        df = pd.read_csv(io.BytesIO(file_bytes))
        return df.to_string(index=False)

    async def delete_file(self, file_id: str, user_id: str) -> None:
        """Delete file from disk and remove FAISS index."""
        from sqlalchemy import select
        result = await self.db.execute(
            select(UploadedFile).where(
                UploadedFile.id == file_id,
                UploadedFile.user_id == user_id,
            )
        )
        file_record = result.scalar_one_or_none()
        if not file_record:
            return

        # Delete local file
        local_path = Path(file_record.local_path)
        if local_path.exists():
            local_path.unlink()

        # Delete FAISS index
        from app.services.rag_service import get_rag_service
        get_rag_service().delete_document_index(file_id)

        # Delete DB record
        await self.db.delete(file_record)
        await self.db.commit()

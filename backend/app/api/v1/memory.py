"""Memory API — CRUD for user long-term memories."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.user import User

logger = get_logger(__name__)
router = APIRouter(prefix="/memory", tags=["memory"])


class MemoryCreate(BaseModel):
    memory_text: str
    memory_type: str = "semantic"
    category: str = "general"
    importance_score: float = 0.5


class MemorySearch(BaseModel):
    query: str
    top_k: int = 5
    memory_type: Optional[str] = None


@router.get("")
async def list_memories(
    current_user: User = Depends(get_current_user),
    memory_type: Optional[str] = Query(None),
):
    """List all long-term memories for the current user."""
    from app.services.memory_service import get_memory_service
    mem_service = get_memory_service()
    memories = await mem_service.list_memories(str(current_user.id))

    if memory_type:
        memories = [m for m in memories if m.get("memory_type") == memory_type]

    return {
        "memories": memories,
        "total": len(memories),
    }


@router.post("", status_code=201)
async def add_memory(
    body: MemoryCreate,
    current_user: User = Depends(get_current_user),
):
    """Manually add a memory fact for the current user."""
    from app.services.memory_service import get_memory_service
    mem_service = get_memory_service()
    memory_id = await mem_service.store(
        user_id=str(current_user.id),
        memory_text=body.memory_text,
        memory_type=body.memory_type,
        category=body.category,
        importance_score=body.importance_score,
    )
    return {"id": memory_id, "status": "stored"}


@router.post("/search")
async def search_memories(
    body: MemorySearch,
    current_user: User = Depends(get_current_user),
):
    """Semantic search over user's memories."""
    from app.services.memory_service import get_memory_service
    mem_service = get_memory_service()
    results = await mem_service.retrieve(
        user_id=str(current_user.id),
        query=body.query,
        top_k=body.top_k,
        memory_type=body.memory_type,
    )
    return {"results": results, "count": len(results)}


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a specific memory by ID."""
    from app.services.memory_service import get_memory_service
    mem_service = get_memory_service()
    deleted = await mem_service.delete_memory(str(current_user.id), memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")

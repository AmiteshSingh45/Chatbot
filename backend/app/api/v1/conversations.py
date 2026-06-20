"""
Conversations API — create, list, rename, pin, archive, delete, search.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repo import ConversationRepository

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateConversationRequest(BaseModel):
    title: str = "New Chat"
    model: str = "llama-3.3-70b-versatile"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    model: Optional[str] = None


def _serialize(conv) -> dict:
    return {
        "id": str(conv.id),
        "title": conv.title,
        "thread_id": conv.thread_id,
        "model": conv.model,
        "is_pinned": conv.is_pinned,
        "is_archived": conv.is_archived,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }


@router.get("")
async def list_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for the current user (paginated)."""
    repo = ConversationRepository(db)
    convs = await repo.get_user_conversations(
        current_user.id,
        skip=skip,
        limit=limit,
        include_archived=include_archived,
    )
    return {"conversations": [_serialize(c) for c in convs], "total": len(convs)}


@router.post("", status_code=201)
async def create_conversation(
    body: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation thread."""
    from app.models.conversation import Conversation
    import uuid
    thread_id = str(uuid.uuid4())
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        thread_id=thread_id,
        title=body.title,
        model=body.model,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return _serialize(conv)


@router.get("/search")
async def search_conversations(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across conversation titles."""
    repo = ConversationRepository(db)
    results = await repo.search(current_user.id, q)
    return [_serialize(c) for c in results]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific conversation with messages."""
    repo = ConversationRepository(db)
    conv = await repo.get_with_messages(conversation_id)
    if not conv:
        raise NotFoundError("Conversation", str(conversation_id))
    if conv.user_id != current_user.id:
        raise PermissionDeniedError()

    data = _serialize(conv)
    import json
    data["messages"] = [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "agent_used": m.agent_used,
            "token_count": m.token_count,
            "metadata": m.metadata,
            "citations": json.loads(m.citations) if m.citations else [],
            "agent_steps": json.loads(m.agent_steps) if getattr(m, "agent_steps", None) else [],
            "created_at": m.created_at.isoformat(),
        }
        for m in conv.messages
    ]
    return data


@router.get("/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages for a conversation (paginated)."""
    import json
    from app.models.message import Message
    from sqlalchemy import select
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv:
        raise NotFoundError("Conversation", conversation_id)
    if str(conv.user_id) != str(current_user.id):
        raise PermissionDeniedError()

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "agent_used": m.agent_used,
                "citations": json.loads(m.citations) if m.citations else [],
                "agent_steps": json.loads(m.agent_steps) if getattr(m, "agent_steps", None) else [],
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "total": len(messages),
    }


@router.patch("/{conversation_id}")
async def update_conversation(
    conversation_id: uuid.UUID,
    body: UpdateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename, pin, archive, or change model for a conversation."""
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv:
        raise NotFoundError("Conversation", str(conversation_id))
    if conv.user_id != current_user.id:
        raise PermissionDeniedError()

    updates = body.model_dump(exclude_none=True)
    conv = await repo.update(conv, **updates)
    return _serialize(conv)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a conversation and all its messages."""
    repo = ConversationRepository(db)
    conv = await repo.get_by_id(conversation_id)
    if not conv:
        raise NotFoundError("Conversation", str(conversation_id))
    if conv.user_id != current_user.id:
        raise PermissionDeniedError()
    await repo.delete(conv)

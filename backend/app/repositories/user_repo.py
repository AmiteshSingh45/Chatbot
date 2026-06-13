"""User, Conversation, and Message repositories."""
from typing import Optional
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import Base
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_provider(self, provider: str, provider_id: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(
                User.provider == provider, User.provider_id == provider_id
            )
        )
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        result = await self.session.execute(
            select(User.id).where(User.email == email)
        )
        return result.scalar_one_or_none() is not None


class ConversationRepository(BaseRepository[Conversation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Conversation, session)

    async def get_user_conversations(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
        include_archived: bool = False,
    ) -> list[Conversation]:
        query = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.is_pinned.desc(), Conversation.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        if not include_archived:
            query = query.where(Conversation.is_archived.is_(False))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_thread_id(self, thread_id: str) -> Optional[Conversation]:
        result = await self.session.execute(
            select(Conversation).where(Conversation.thread_id == thread_id)
        )
        return result.scalar_one_or_none()

    async def search(self, user_id: UUID, query: str) -> list[Conversation]:
        result = await self.session.execute(
            select(Conversation)
            .where(
                Conversation.user_id == user_id,
                Conversation.title.ilike(f"%{query}%"),
            )
            .order_by(Conversation.updated_at.desc())
            .limit(20)
        )
        return list(result.scalars().all())

    async def get_with_messages(self, conversation_id: UUID) -> Optional[Conversation]:
        result = await self.session.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()


class MessageRepository(BaseRepository[Message]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Message, session)

    async def get_conversation_messages(
        self,
        conversation_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_latest_messages(
        self, conversation_id: UUID, count: int = 20
    ) -> list[Message]:
        """Get the N most recent messages for context window building."""
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(count)
        )
        messages = list(result.scalars().all())
        return list(reversed(messages))  # Return in chronological order

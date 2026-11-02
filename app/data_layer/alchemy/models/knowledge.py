from __future__ import annotations

from enum import Enum
from typing import Self

from pgvector.sqlalchemy import Vector
from sqlalchemy import Computed, ForeignKey, Index, String, Text, UniqueConstraint, select
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel

EMBEDDING_DIM = 1024  # must match AI_EMBEDDING_DIM and the migration


class KnowledgeDocument(BaseModel):
    """A text document an organization uploaded for the AI analyst (policies, KPI notes, ...)."""

    __tablename__ = "knowledge_documents"
    __table_args__ = (UniqueConstraint("organization_id", "content_hash"),)

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    char_count: Mapped[int] = mapped_column(nullable=False)
    chunk_count: Mapped[int] = mapped_column(nullable=False)
    vector_indexed: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    @classmethod
    async def list_for_organization(cls, session: AsyncSession, organization_id: int) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(cls.organization_id == organization_id, cls.is_deleted.is_(False))
            .order_by(cls.id.desc())
        )
        return list(result.scalars())


class KnowledgeChunk(BaseModel):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("ix_knowledge_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_knowledge_chunks_org_doc", "organization_id", "document_id"),
        Index(
            "ix_knowledge_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tsv: Mapped[str] = mapped_column(
        TSVECTOR, Computed("to_tsvector('russian', text)", persisted=True)
    )
    # Cosine-space embedding (pgvector); NULL until embedded or when no embedding key is set.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))


class ChatConversation(BaseModel):
    """Private to the user who started it, inside one organization."""

    __tablename__ = "chat_conversations"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)

    @classmethod
    async def get_for_user(
        cls, session: AsyncSession, organization_id: int, user_id: int, conversation_id: int
    ) -> Self | None:
        result = await session.execute(
            select(cls).where(
                cls.id == conversation_id,
                cls.organization_id == organization_id,
                cls.user_id == user_id,
                cls.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    @classmethod
    async def list_for_user(
        cls, session: AsyncSession, organization_id: int, user_id: int
    ) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(
                cls.organization_id == organization_id,
                cls.user_id == user_id,
                cls.is_deleted.is_(False),
            )
            .order_by(cls.id.desc())
            .limit(50)
        )
        return list(result.scalars())


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    class RoleEnum(str, Enum):
        USER = "USER"
        ASSISTANT = "ASSISTANT"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    role: Mapped[RoleEnum] = mapped_column(SqlEnum(RoleEnum, name="chat_role"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    refusal: Mapped[bool] = mapped_column(default=False, server_default="false")
    # Execution trace of the run that produced this answer (stages, timings, validation).
    trace: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    duration_ms: Mapped[int | None] = mapped_column()
    model: Mapped[str | None] = mapped_column(String(64))

    @classmethod
    async def list_for_conversation(
        cls, session: AsyncSession, conversation_id: int, limit: int = 200
    ) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(cls.conversation_id == conversation_id, cls.is_deleted.is_(False))
            .order_by(cls.id)
            .limit(limit)
        )
        return list(result.scalars())

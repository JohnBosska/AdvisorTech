from datetime import datetime
from typing import Self

from sqlalchemy import DateTime, ForeignKey, String, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class AuditEvent(BaseModel):
    """Who did what in an organization. Append-only; details never carry secrets."""

    __tablename__ = "audit_events"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    object_type: Mapped[str | None] = mapped_column(String(64))
    object_id: Mapped[str | None] = mapped_column(String(120))
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    request_id: Mapped[str | None] = mapped_column(String(64))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    @classmethod
    async def page(
        cls,
        session: AsyncSession,
        organization_id: int,
        *,
        action: str | None,
        user_id: int | None,
        before_id: int | None,
        limit: int,
    ) -> list[Self]:
        query = select(cls).where(cls.organization_id == organization_id)
        if action:
            query = query.where(cls.action == action)
        if user_id:
            query = query.where(cls.user_id == user_id)
        if before_id:
            query = query.where(cls.id < before_id)
        result = await session.execute(query.order_by(cls.id.desc()).limit(limit))
        return list(result.scalars())

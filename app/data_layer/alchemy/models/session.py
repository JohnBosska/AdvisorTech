from __future__ import annotations

from datetime import datetime
from typing import Self

from sqlalchemy import DateTime, ForeignKey, String, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class RefreshToken(BaseModel):
    """Rotating refresh token. Only the hash is stored; a reused token revokes its whole family."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @classmethod
    async def get_by_hash(
        cls, session: AsyncSession, token_hash: str, *, for_update: bool = False
    ) -> Self | None:
        statement = select(cls).where(cls.token_hash == token_hash)
        if for_update:
            statement = statement.with_for_update()
        return (await session.execute(statement)).scalar_one_or_none()

    @classmethod
    async def revoke_family(cls, session: AsyncSession, family_id: str, now: datetime) -> None:
        await session.execute(
            update(cls)
            .where(cls.family_id == family_id, cls.revoked_at.is_(None))
            .values(revoked_at=now)
        )

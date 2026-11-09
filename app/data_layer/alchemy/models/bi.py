from typing import Self

from sqlalchemy import ForeignKey, String, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class BiReport(BaseModel):
    """A saved BI report: layout/format spec plus a data snapshot. Visible to the whole organization."""

    __tablename__ = "bi_reports"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    spec: Mapped[dict] = mapped_column(JSONB, nullable=False)
    dataset: Mapped[dict | None] = mapped_column(JSONB)
    # where the snapshot came from, never with passwords: {"kind": "url", "url": ...}
    source: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    @classmethod
    async def get_in_org(
        cls, session: AsyncSession, organization_id: int, report_id: int
    ) -> Self | None:
        result = await session.execute(
            select(cls).where(
                cls.id == report_id,
                cls.organization_id == organization_id,
                cls.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    @classmethod
    async def list_in_org(cls, session: AsyncSession, organization_id: int) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(cls.organization_id == organization_id, cls.is_deleted.is_(False))
            .order_by(cls.updated_at.desc())
            .limit(200)
        )
        return list(result.scalars())

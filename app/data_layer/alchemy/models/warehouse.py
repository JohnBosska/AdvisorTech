from datetime import datetime
from typing import Self

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class RawRecord(BaseModel):
    """Raw layer of the warehouse: one source record as the agent delivered it.

    Keyed by (organization, connection, entity, record_key); re-delivery upserts the payload.
    """

    __tablename__ = "raw_records"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "connection_id", "entity", "record_key", name="uq_raw_record_key"
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("source_connections.id", ondelete="CASCADE"), nullable=False
    )
    sync_run_id: Mapped[int | None] = mapped_column(ForeignKey("sync_runs.id", ondelete="SET NULL"))
    entity: Mapped[str] = mapped_column(String(64), nullable=False)
    record_key: Mapped[str] = mapped_column(String(200), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    @classmethod
    async def entity_stats(cls, session: AsyncSession, organization_id: int) -> list[dict]:
        result = await session.execute(
            select(
                cls.connection_id,
                cls.entity,
                func.count().label("records"),
                func.max(cls.ingested_at).label("last_ingested_at"),
            )
            .where(cls.organization_id == organization_id, cls.is_deleted.is_(False))
            .group_by(cls.connection_id, cls.entity)
            .order_by(cls.connection_id, cls.entity)
        )
        return [dict(row._mapping) for row in result]

    @classmethod
    async def payloads(
        cls,
        session: AsyncSession,
        organization_id: int,
        connection_id: int,
        entity: str,
        limit: int,
    ) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(
                cls.organization_id == organization_id,
                cls.connection_id == connection_id,
                cls.entity == entity,
                cls.is_deleted.is_(False),
            )
            .order_by(cls.record_key)
            .limit(limit)
        )
        return list(result.scalars())

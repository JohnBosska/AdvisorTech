from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Self

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, select
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class SourceConnection(BaseModel):
    """A 1C information base connected to an organization. Read-only by design."""

    __tablename__ = "source_connections"

    class ConfigurationEnum(str, Enum):
        ACCOUNTING = "ACCOUNTING"
        TRADE_MANAGEMENT = "TRADE_MANAGEMENT"
        ERP = "ERP"
        OTHER = "OTHER"

    class DbmsEnum(str, Enum):
        POSTGRESQL = "POSTGRESQL"
        MSSQL = "MSSQL"

    class TransportEnum(str, Enum):
        ODATA = "ODATA"
        HTTP_SERVICE = "HTTP_SERVICE"
        EXTENSION = "EXTENSION"
        FILE_EXCHANGE = "FILE_EXCHANGE"

    class StatusEnum(str, Enum):
        DRAFT = "DRAFT"
        AWAITING_AGENT = "AWAITING_AGENT"
        CONNECTED = "CONNECTED"
        ERROR = "ERROR"
        REVOKED = "REVOKED"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    configuration: Mapped[ConfigurationEnum] = mapped_column(
        SqlEnum(ConfigurationEnum, name="onec_configuration"), nullable=False
    )
    configuration_version: Mapped[str | None] = mapped_column(String(32))
    source_dbms: Mapped[DbmsEnum] = mapped_column(
        SqlEnum(DbmsEnum, name="onec_source_dbms"), nullable=False
    )
    transport: Mapped[TransportEnum] = mapped_column(
        SqlEnum(TransportEnum, name="onec_transport"), nullable=False
    )
    status: Mapped[StatusEnum] = mapped_column(
        SqlEnum(StatusEnum, name="source_connection_status"),
        nullable=False,
        default=StatusEnum.DRAFT,
    )
    enabled_entities: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    # server-side connector (None = Connector Agent delivers data): 'postgres' | 'onec_odata'
    connector_kind: Mapped[str | None] = mapped_column(String(32))
    # per entity: {"key": column, "cursor": column | None}
    entity_config: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    schedule_minutes: Mapped[int | None] = mapped_column()
    last_successful_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @classmethod
    async def list_for_organization(cls, session: AsyncSession, organization_id: int) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(cls.organization_id == organization_id, cls.is_deleted.is_(False))
            .order_by(cls.id)
        )
        return list(result.scalars())

    @classmethod
    async def get_in_organization(
        cls, session: AsyncSession, organization_id: int, connection_id: int
    ) -> Self | None:
        result = await session.execute(
            select(cls).where(
                cls.id == connection_id,
                cls.organization_id == organization_id,
                cls.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()


class SyncRun(BaseModel):
    """One ingestion run with record counters (brief §5.7). Written by the ingestion module."""

    __tablename__ = "sync_runs"

    class ModeEnum(str, Enum):
        FULL = "FULL"
        INCREMENTAL = "INCREMENTAL"
        RECONCILIATION = "RECONCILIATION"
        RECOVERY = "RECOVERY"

    class StatusEnum(str, Enum):
        QUEUED = "QUEUED"
        RUNNING = "RUNNING"
        SUCCEEDED = "SUCCEEDED"
        FAILED = "FAILED"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("source_connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mode: Mapped[ModeEnum] = mapped_column(SqlEnum(ModeEnum, name="sync_mode"), nullable=False)
    status: Mapped[StatusEnum] = mapped_column(
        SqlEnum(StatusEnum, name="sync_status"), nullable=False, default=StatusEnum.QUEUED
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    records_received: Mapped[int] = mapped_column(default=0, server_default="0")
    records_accepted: Mapped[int] = mapped_column(default=0, server_default="0")
    records_rejected: Mapped[int] = mapped_column(default=0, server_default="0")
    records_quarantined: Mapped[int] = mapped_column(default=0, server_default="0")
    error_summary: Mapped[str | None] = mapped_column(String(500))

    @classmethod
    async def list_for_connection(
        cls, session: AsyncSession, organization_id: int, connection_id: int, limit: int = 50
    ) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(
                cls.organization_id == organization_id,
                cls.connection_id == connection_id,
                cls.is_deleted.is_(False),
            )
            .order_by(cls.id.desc())
            .limit(limit)
        )
        return list(result.scalars())


class AgentCredential(BaseModel):
    """Bearer credential of a Connector Agent, bound to exactly one connection (one tenant)."""

    __tablename__ = "agent_credentials"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("source_connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    agent_version: Mapped[str | None] = mapped_column(String(32))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @classmethod
    async def get_active_by_hash(cls, session: AsyncSession, token_hash: str) -> Self | None:
        result = await session.execute(
            select(cls).where(
                cls.token_hash == token_hash,
                cls.revoked_at.is_(None),
                cls.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    @classmethod
    async def list_active_for_connection(
        cls, session: AsyncSession, connection_id: int
    ) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(cls.connection_id == connection_id, cls.revoked_at.is_(None))
            .with_for_update()
        )
        return list(result.scalars())


class IngestionBatch(BaseModel):
    """Ledger of accepted batches. Retrying a sequence number is idempotent (brief §5.1).

    Only counters are recorded: the Data Warehouse that would store the records is not built yet.
    """

    __tablename__ = "ingestion_batches"
    __table_args__ = (UniqueConstraint("sync_run_id", "sequence"),)

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sync_run_id: Mapped[int] = mapped_column(
        ForeignKey("sync_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence: Mapped[int] = mapped_column(nullable=False)
    entity: Mapped[str] = mapped_column(String(64), nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(64))
    records_received: Mapped[int] = mapped_column(default=0)
    records_accepted: Mapped[int] = mapped_column(default=0)
    records_rejected: Mapped[int] = mapped_column(default=0)
    records_quarantined: Mapped[int] = mapped_column(default=0)

    @classmethod
    async def get_by_sequence(
        cls, session: AsyncSession, sync_run_id: int, sequence: int
    ) -> Self | None:
        result = await session.execute(
            select(cls).where(cls.sync_run_id == sync_run_id, cls.sequence == sequence)
        )
        return result.scalar_one_or_none()

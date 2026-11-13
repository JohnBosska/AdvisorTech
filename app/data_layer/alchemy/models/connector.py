from typing import Self

from sqlalchemy import ForeignKey, LargeBinary, String, UniqueConstraint, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class ConnectorCredential(BaseModel):
    """Encrypted connection parameters of a server-side connector (one per connection)."""

    __tablename__ = "connector_credentials"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("source_connections.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    key_fingerprint: Mapped[str] = mapped_column(String(16), nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    @classmethod
    async def get_for_connection(
        cls, session: AsyncSession, organization_id: int, connection_id: int
    ) -> Self | None:
        result = await session.execute(
            select(cls).where(
                cls.organization_id == organization_id,
                cls.connection_id == connection_id,
                cls.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()


class SyncCursor(BaseModel):
    """Last extracted cursor value per entity, for incremental loads."""

    __tablename__ = "sync_cursors"
    __table_args__ = (UniqueConstraint("connection_id", "entity", name="uq_sync_cursor"),)

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("source_connections.id", ondelete="CASCADE"), nullable=False
    )
    entity: Mapped[str] = mapped_column(String(64), nullable=False)
    cursor_value: Mapped[str | None] = mapped_column(String(200))

    @classmethod
    async def for_connection(
        cls, session: AsyncSession, connection_id: int
    ) -> dict[str, str | None]:
        result = await session.execute(
            select(cls.entity, cls.cursor_value).where(cls.connection_id == connection_id)
        )
        return {row.entity: row.cursor_value for row in result}

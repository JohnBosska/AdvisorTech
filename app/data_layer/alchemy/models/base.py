from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_deleted: Mapped[bool] = mapped_column(default=False)

    @classmethod
    async def delete(cls, session: AsyncSession, object_id: int) -> bool:
        instance = await cls.get_by_id(session, object_id)
        if instance is None:
            return False

        instance.is_deleted = True
        await session.flush()
        return True

    @classmethod
    async def get_by_id(cls, session: AsyncSession, object_id: int) -> Base | None:
        result = await session.execute(
            select(cls).where(cls.id == object_id, cls.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

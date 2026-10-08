from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Self

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, String, select
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, joinedload, mapped_column, relationship

from .base import BaseModel


class UserEmail(BaseModel):
    __tablename__ = "user_emails"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_code_hash: Mapped[str | None] = mapped_column(String(64))
    verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_attempts: Mapped[int] = mapped_column(default=0, server_default="0")

    user: Mapped[User] = relationship(back_populates="email_identity")

    @classmethod
    async def get_by_email(
        cls, session: AsyncSession, email: str, *, for_update: bool = False
    ) -> Self | None:
        statement = (
            select(cls)
            .join(cls.user)
            .options(joinedload(cls.user))
            .where(
                cls.email == email.casefold(),
                cls.is_deleted.is_(False),
                User.is_deleted.is_(False),
            )
        )
        if for_update:
            statement = statement.with_for_update(of=cls)
        result = await session.execute(statement)
        return result.scalar_one_or_none()


class UserTelegram(BaseModel):
    __tablename__ = "user_telegrams"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    username: Mapped[str | None] = mapped_column(String(64))

    user: Mapped[User] = relationship(back_populates="telegram_identity")

    @classmethod
    async def get_by_telegram_id(cls, session: AsyncSession, telegram_id: int) -> Self | None:
        result = await session.execute(
            select(cls)
            .join(cls.user)
            .options(joinedload(cls.user))
            .where(
                cls.telegram_id == telegram_id,
                cls.is_deleted.is_(False),
                User.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()


class User(BaseModel):
    __tablename__ = "users"

    class RoleEnum(str, Enum):
        UNVERIFIED_USER = "UNVERIFIED_USER"
        VERIFIED_USER = "VERIFIED_USER"
        ADMIN = "ADMIN"

    name: Mapped[str | None] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    birthday_date: Mapped[date | None] = mapped_column(Date)
    role: Mapped[RoleEnum] = mapped_column(
        SqlEnum(RoleEnum, name="user_role"),
        nullable=False,
        default=RoleEnum.UNVERIFIED_USER,
    )

    email_identity: Mapped[UserEmail | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    telegram_identity: Mapped[UserTelegram | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Self

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, select
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel


class Organization(BaseModel):
    """Tenant workspace: the isolation boundary for all customer data."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(255))
    tax_id: Mapped[str | None] = mapped_column(String(12))
    reporting_currency: Mapped[str] = mapped_column(String(3), default="RUB", server_default="RUB")
    uses_onec: Mapped[bool | None] = mapped_column()

    members: Mapped[list[OrganizationMember]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    subscription: Mapped[Subscription | None] = relationship(
        back_populates="organization", cascade="all, delete-orphan", uselist=False
    )


class OrganizationMember(BaseModel):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)

    class RoleEnum(str, Enum):
        OWNER = "OWNER"
        FINANCE = "FINANCE"
        ANALYST = "ANALYST"
        IT_ADMIN = "IT_ADMIN"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[RoleEnum] = mapped_column(
        SqlEnum(RoleEnum, name="organization_member_role"), nullable=False
    )

    organization: Mapped[Organization] = relationship(back_populates="members")

    @classmethod
    async def get_for_user(
        cls, session: AsyncSession, organization_id: int, user_id: int
    ) -> Self | None:
        result = await session.execute(
            select(cls).where(
                cls.organization_id == organization_id,
                cls.user_id == user_id,
                cls.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    @classmethod
    async def list_for_user(cls, session: AsyncSession, user_id: int) -> list[Self]:
        result = await session.execute(
            select(cls)
            .join(cls.organization)
            .where(
                cls.user_id == user_id,
                cls.is_deleted.is_(False),
                Organization.is_deleted.is_(False),
            )
            .order_by(cls.id)
        )
        return list(result.scalars())


class Subscription(BaseModel):
    """Plan state only. Price, trial terms and quotas are undecided (brief §12.2)."""

    __tablename__ = "subscriptions"

    class StatusEnum(str, Enum):
        PENDING = "PENDING"
        ACTIVE = "ACTIVE"
        SUSPENDED = "SUSPENDED"
        CANCELLED = "CANCELLED"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    plan: Mapped[str] = mapped_column(String(32), default="PREMIUM", server_default="PREMIUM")
    status: Mapped[StatusEnum] = mapped_column(
        SqlEnum(StatusEnum, name="subscription_status"),
        nullable=False,
        default=StatusEnum.PENDING,
    )
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship(back_populates="subscription")


class OrganizationInvitation(BaseModel):
    """Invitation to join an organization. The token is delivered by the inviter, stored hashed."""

    __tablename__ = "organization_invitations"

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[OrganizationMember.RoleEnum] = mapped_column(
        SqlEnum(OrganizationMember.RoleEnum, name="organization_member_role", create_type=False),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    invited_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @classmethod
    async def get_by_hash(
        cls, session: AsyncSession, token_hash: str, *, for_update: bool = False
    ) -> Self | None:
        statement = select(cls).where(cls.token_hash == token_hash, cls.is_deleted.is_(False))
        if for_update:
            statement = statement.with_for_update()
        return (await session.execute(statement)).scalar_one_or_none()

    @classmethod
    async def list_pending(cls, session: AsyncSession, organization_id: int) -> list[Self]:
        result = await session.execute(
            select(cls)
            .where(
                cls.organization_id == organization_id,
                cls.accepted_at.is_(None),
                cls.is_deleted.is_(False),
            )
            .order_by(cls.id.desc())
        )
        return list(result.scalars())

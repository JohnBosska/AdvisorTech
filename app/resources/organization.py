from typing import Self

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import Organization, OrganizationMember, Subscription
from app.exceptions import ForbiddenError, ObjectNotFoundError
from app.resources.base import BaseEntity
from app.schemas.organization import (
    OrganizationCreateRequest,
    OrganizationResponse,
    SubscriptionResponse,
)

# Roles allowed to manage source connections (brief §3.3: owner, IT / 1C administrator).
CONNECTION_MANAGER_ROLES = frozenset(
    {OrganizationMember.RoleEnum.OWNER, OrganizationMember.RoleEnum.IT_ADMIN}
)


def require_role(
    member: OrganizationMember, allowed: frozenset[OrganizationMember.RoleEnum]
) -> None:
    if member.role not in allowed:
        raise ForbiddenError("Insufficient role for this operation")


class OrganizationEntity(BaseEntity[Organization]):
    def __init__(self, db_object: Organization, role: OrganizationMember.RoleEnum) -> None:
        super().__init__(db_object)
        self.role = role

    @classmethod
    async def find(cls, object_id: int) -> Self:
        raise NotImplementedError("Use find_for_user: organizations are always tenant-scoped")

    @classmethod
    async def find_for_user(cls, organization_id: int, user_id: int) -> Self:
        """Tenant boundary: a non-member gets 404, never a hint that the tenant exists."""
        async with SessionFactory() as session:
            member = await OrganizationMember.get_for_user(session, organization_id, user_id)
            if member is None:
                raise ObjectNotFoundError("Organization not found")
            result = await session.execute(
                select(Organization)
                .options(selectinload(Organization.subscription))
                .where(Organization.id == organization_id, Organization.is_deleted.is_(False))
            )
            organization = result.scalar_one_or_none()
            if organization is None:
                raise ObjectNotFoundError("Organization not found")
            return cls(organization, member.role)

    @classmethod
    async def create(cls, user_id: int, payload: OrganizationCreateRequest) -> Self:
        async with SessionFactory.begin() as session:
            organization = Organization(**payload.model_dump())
            organization.subscription = Subscription(status=Subscription.StatusEnum.PENDING)
            organization.members.append(
                OrganizationMember(user_id=user_id, role=OrganizationMember.RoleEnum.OWNER)
            )
            await organization.save(session)
        return cls(organization, OrganizationMember.RoleEnum.OWNER)

    @classmethod
    async def list_for_user(cls, user_id: int) -> list[Self]:
        async with SessionFactory() as session:
            members = await OrganizationMember.list_for_user(session, user_id)
            entities: list[Self] = []
            for member in members:
                result = await session.execute(
                    select(Organization)
                    .options(selectinload(Organization.subscription))
                    .where(Organization.id == member.organization_id)
                )
                entities.append(cls(result.scalar_one(), member.role))
            return entities

    def detail(self) -> OrganizationResponse:
        organization = self.db_object
        return OrganizationResponse(
            id=organization.id,
            name=organization.name,
            legal_name=organization.legal_name,
            tax_id=organization.tax_id,
            reporting_currency=organization.reporting_currency,
            uses_onec=organization.uses_onec,
            role=self.role,
            subscription=(
                SubscriptionResponse.model_validate(organization.subscription)
                if organization.subscription
                else None
            ),
        )

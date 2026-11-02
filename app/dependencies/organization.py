from typing import Annotated

from fastapi import Depends

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.auth import get_current_user
from app.exceptions import ObjectNotFoundError
from app.resources.user import UserEntity


async def get_organization_member(
    organization_id: int,
    user: Annotated[UserEntity, Depends(get_current_user)],
) -> OrganizationMember:
    """Authorizes every organization-scoped route; the tenant id is never trusted on its own."""
    async with SessionFactory() as session:
        member = await OrganizationMember.get_for_user(session, organization_id, user.db_object.id)
    if member is None:
        raise ObjectNotFoundError("Organization not found")
    return member

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.organization import get_organization_member
from app.resources.audit import Audit
from app.schemas.audit import AuditActionResponse, AuditEventResponse
from app.services.audit import ACTIONS

router = APIRouter(prefix="/organizations/{organization_id}/audit", tags=["Audit"])
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.get("", response_model=list[AuditEventResponse])
async def list_events(
    organization_id: int,
    member: MemberDep,
    action: Annotated[str | None, Query(max_length=64)] = None,
    user_id: Annotated[int | None, Query(ge=1)] = None,
    before_id: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    """Newest first; OWNER and IT_ADMIN only. Paginate with `before_id`."""
    return await Audit.page(
        member, action=action, user_id=user_id, before_id=before_id, limit=limit
    )


@router.get("/actions", response_model=list[AuditActionResponse])
async def list_actions(organization_id: int, member: MemberDep):
    return [{"action": a, "label": label} for a, label in ACTIONS.items()]

from typing import Annotated

from fastapi import APIRouter, Depends

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.auth import get_current_user
from app.dependencies.organization import get_organization_member
from app.resources.agent import AgentManagement
from app.resources.integration import SourceConnectionEntity
from app.resources.member import MemberService
from app.resources.organization import OrganizationEntity
from app.resources.user import UserEntity
from app.schemas.integration import (
    AgentCredentialIssuedResponse,
    SourceConnectionCreateRequest,
    SourceConnectionResponse,
    SyncRunCreateRequest,
    SyncRunResponse,
)
from app.schemas.member import (
    InvitationAcceptRequest,
    InvitationCreatedResponse,
    InvitationCreateRequest,
    InvitationResponse,
    MemberResponse,
    MemberRoleUpdateRequest,
)
from app.schemas.organization import OrganizationCreateRequest, OrganizationResponse

router = APIRouter(prefix="/organizations", tags=["Organizations"])
CurrentUserDep = Annotated[UserEntity, Depends(get_current_user)]
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    payload: OrganizationCreateRequest, user: CurrentUserDep
) -> OrganizationResponse:
    entity = await OrganizationEntity.create(user.db_object.id, payload)
    return entity.detail()


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(user: CurrentUserDep) -> list[OrganizationResponse]:
    return [e.detail() for e in await OrganizationEntity.list_for_user(user.db_object.id)]


@router.post("/invitations/accept", response_model=OrganizationResponse)
async def accept_invitation(
    payload: InvitationAcceptRequest, user: CurrentUserDep
) -> OrganizationResponse:
    organization_id = await MemberService.accept(user.db_object.id, payload.token)
    entity = await OrganizationEntity.find_for_user(organization_id, user.db_object.id)
    return entity.detail()


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(organization_id: int, user: CurrentUserDep) -> OrganizationResponse:
    entity = await OrganizationEntity.find_for_user(organization_id, user.db_object.id)
    return entity.detail()


@router.get("/{organization_id}/connections", response_model=list[SourceConnectionResponse])
async def list_connections(organization_id: int, member: MemberDep):
    return await SourceConnectionEntity.list(member)


@router.post(
    "/{organization_id}/connections", response_model=SourceConnectionResponse, status_code=201
)
async def create_connection(
    organization_id: int, payload: SourceConnectionCreateRequest, member: MemberDep
):
    return await SourceConnectionEntity.create(member, payload)


@router.get(
    "/{organization_id}/connections/{connection_id}/sync-runs",
    response_model=list[SyncRunResponse],
)
async def list_sync_runs(organization_id: int, connection_id: int, member: MemberDep):
    return await SourceConnectionEntity.sync_runs(member, connection_id)


@router.get("/{organization_id}/members", response_model=list[MemberResponse])
async def list_members(organization_id: int, member: MemberDep):
    return await MemberService.list(member)


@router.patch("/{organization_id}/members/{member_id}", status_code=204)
async def change_member_role(
    organization_id: int, member_id: int, payload: MemberRoleUpdateRequest, member: MemberDep
) -> None:
    await MemberService.change_role(member, member_id, payload.role)


@router.delete("/{organization_id}/members/{member_id}", status_code=204)
async def remove_member(organization_id: int, member_id: int, member: MemberDep) -> None:
    await MemberService.remove(member, member_id)


@router.get("/{organization_id}/invitations", response_model=list[InvitationResponse])
async def list_invitations(organization_id: int, member: MemberDep):
    return await MemberService.list_invitations(member)


@router.post(
    "/{organization_id}/invitations", response_model=InvitationCreatedResponse, status_code=201
)
async def create_invitation(
    organization_id: int, payload: InvitationCreateRequest, member: MemberDep
):
    return await MemberService.invite(member, payload)


@router.delete("/{organization_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(organization_id: int, invitation_id: int, member: MemberDep) -> None:
    await MemberService.revoke_invitation(member, invitation_id)


@router.post(
    "/{organization_id}/connections/{connection_id}/sync-runs",
    response_model=SyncRunResponse,
    status_code=202,
)
async def request_sync(
    organization_id: int, connection_id: int, payload: SyncRunCreateRequest, member: MemberDep
):
    return await AgentManagement.request_sync(member, connection_id, payload)


@router.post(
    "/{organization_id}/connections/{connection_id}/agent-credentials",
    response_model=AgentCredentialIssuedResponse,
    status_code=201,
)
async def issue_agent_credential(organization_id: int, connection_id: int, member: MemberDep):
    token = await AgentManagement.issue_credential(member, connection_id)
    return AgentCredentialIssuedResponse(connection_id=connection_id, token=token)


@router.delete("/{organization_id}/connections/{connection_id}/agent-credentials", status_code=204)
async def revoke_agent_credentials(
    organization_id: int, connection_id: int, member: MemberDep
) -> None:
    await AgentManagement.revoke_credentials(member, connection_id)

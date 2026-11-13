from typing import Annotated

from fastapi import APIRouter, Depends

from app.data_layer.alchemy.models import OrganizationMember, SyncRun
from app.dependencies.organization import get_organization_member
from app.resources.connectors import Connectors
from app.schemas.connectors import (
    ColumnResponse,
    CredentialsRequest,
    CredentialsStatus,
    CursorResponse,
    EntitiesRequest,
    TableResponse,
)
from app.schemas.integration import SourceConnectionResponse, SyncRunCreateRequest, SyncRunResponse

router = APIRouter(
    prefix="/organizations/{organization_id}/connections/{connection_id}/connector",
    tags=["Server connectors"],
)
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.get("/credentials", response_model=CredentialsStatus)
async def credentials_status(organization_id: int, connection_id: int, member: MemberDep):
    """Whether credentials are stored and where they point; secrets are never returned."""
    return await Connectors.credentials_status(member, connection_id)


@router.put("/credentials", response_model=CredentialsStatus)
async def set_credentials(
    organization_id: int, connection_id: int, payload: CredentialsRequest, member: MemberDep
):
    """Tests the connection, then stores the parameters encrypted."""
    return await Connectors.set_credentials(member, connection_id, payload)


@router.post("/discover", response_model=list[TableResponse])
async def discover(organization_id: int, connection_id: int, member: MemberDep):
    return await Connectors.discover(member, connection_id)


@router.get("/tables/{table}/columns", response_model=list[ColumnResponse])
async def columns(organization_id: int, connection_id: int, table: str, member: MemberDep):
    return await Connectors.columns(member, connection_id, table)


@router.put("/entities", response_model=SourceConnectionResponse)
async def configure(
    organization_id: int, connection_id: int, payload: EntitiesRequest, member: MemberDep
):
    """Entities with key/cursor columns and an optional periodic schedule (minutes)."""
    return await Connectors.configure(member, connection_id, payload)


@router.get("/cursors", response_model=list[CursorResponse])
async def cursors(organization_id: int, connection_id: int, member: MemberDep):
    return await Connectors.cursors(member, connection_id)


@router.post("/sync", response_model=SyncRunResponse, status_code=202)
async def sync_now(
    organization_id: int,
    connection_id: int,
    member: MemberDep,
    payload: SyncRunCreateRequest | None = None,
):
    mode = payload.mode if payload else SyncRun.ModeEnum.INCREMENTAL
    return await Connectors.sync_now(member, connection_id, mode)

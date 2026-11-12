from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.organization import get_organization_member
from app.resources.warehouse import Warehouse
from app.schemas.reports import DatasetResponse, WarehouseEntity

router = APIRouter(prefix="/organizations/{organization_id}/warehouse", tags=["Warehouse"])
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.get("/entities", response_model=list[WarehouseEntity])
async def list_entities(organization_id: int, member: MemberDep):
    """Entities delivered by Connector Agents into the raw layer, with counts and freshness."""
    return await Warehouse.entities(member)


@router.get("/entities/{entity}/dataset", response_model=DatasetResponse)
async def entity_dataset(
    organization_id: int,
    entity: str,
    member: MemberDep,
    connection_id: Annotated[int, Query(ge=1)],
):
    return await Warehouse.dataset(member, connection_id, entity)

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.organization import get_organization_member
from app.exceptions import BadRequestError
from app.schemas.reports import (
    DatasetResponse,
    ReportPlanRequest,
    ReportPlanResponse,
    SourceLoadRequest,
    SourceTable,
    SourceTablesRequest,
    UrlSourceRequest,
)
from app.services import bi, bi_sources, bi_url

router = APIRouter(prefix="/organizations/{organization_id}/reports", tags=["BI reports"])
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.post("/dataset", response_model=DatasetResponse)
async def upload_dataset(
    organization_id: int,
    request: Request,
    member: MemberDep,
    filename: Annotated[str, Query(min_length=1, max_length=200)],
):
    """Raw file body (CSV/XLSX). Parsed and returned; nothing is stored on the server."""
    if int(request.headers.get("content-length") or 0) > bi.MAX_BYTES:
        raise BadRequestError("Файл больше 5 МБ")
    data = await request.body()
    return bi.parse_dataset(filename, data)


@router.post("/plan", response_model=ReportPlanResponse)
async def plan_report(organization_id: int, payload: ReportPlanRequest, member: MemberDep):
    return await bi.plan_report(payload.request, payload.columns, member.user_id)


async def _guarded(member: OrganizationMember):
    bi._rate_limit(member.user_id)


@router.post("/sources/tables", response_model=list[SourceTable])
async def source_tables(organization_id: int, payload: SourceTablesRequest, member: MemberDep):
    """Connects read-only and lists readable tables (PostgreSQL) or OData objects (1C)."""
    await _guarded(member)
    if payload.kind == "postgres" and payload.postgres:
        return await bi_sources.pg_tables(payload.postgres)
    if payload.kind == "onec" and payload.onec:
        return await bi_sources.onec_tables(payload.onec)
    raise BadRequestError("Не указаны параметры подключения")


@router.post("/sources/load", response_model=DatasetResponse)
async def source_load(organization_id: int, payload: SourceLoadRequest, member: MemberDep):
    await _guarded(member)
    if payload.kind == "postgres" and payload.postgres:
        return await bi_sources.pg_load(payload.postgres, payload.table)
    if payload.kind == "onec" and payload.onec:
        return await bi_sources.onec_load(payload.onec, payload.table)
    raise BadRequestError("Не указаны параметры подключения")


@router.post("/sources/url", response_model=DatasetResponse)
async def source_url(organization_id: int, payload: UrlSourceRequest, member: MemberDep):
    """Google Sheets / Yandex Disk public link / direct CSV or XLSX URL."""
    await _guarded(member)
    return await bi_url.load_url(payload.url)

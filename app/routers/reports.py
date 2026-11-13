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
from app.services import audit, bi, bi_sources, bi_url

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
    dataset = bi.parse_dataset(filename, data)
    await audit.record(
        organization_id,
        member.user_id,
        "bi.source.file",
        details={"filename": filename, "rows": dataset["total_rows"]},
    )
    return dataset


@router.post("/plan", response_model=ReportPlanResponse)
async def plan_report(organization_id: int, payload: ReportPlanRequest, member: MemberDep):
    plan = await bi.plan_report(payload.request, payload.columns, member.user_id)
    await audit.record(
        organization_id,
        member.user_id,
        "ai.report_plan",
        details={
            "request": payload.request,
            "columns": len(payload.columns),
            "model": plan["model"],
            "widgets": len(plan["widgets"]),
            "dropped": plan["dropped"],
        },
    )
    return plan


async def _guarded(member: OrganizationMember):
    bi._rate_limit(member.user_id)


@router.post("/sources/tables", response_model=list[SourceTable])
async def source_tables(organization_id: int, payload: SourceTablesRequest, member: MemberDep):
    """Connects read-only and lists readable tables (PostgreSQL) or OData objects (1C)."""
    await _guarded(member)
    if payload.kind == "postgres" and payload.postgres:
        tables = await bi_sources.pg_tables(payload.postgres)
        target = f"{payload.postgres.host}:{payload.postgres.port}/{payload.postgres.database}"
    elif payload.kind == "onec" and payload.onec:
        tables = await bi_sources.onec_tables(payload.onec)
        target = payload.onec.url
    else:
        raise BadRequestError("Не указаны параметры подключения")
    await audit.record(
        organization_id,
        member.user_id,
        "bi.source.tables",
        details={"kind": payload.kind, "target": target, "tables": len(tables)},
    )
    return tables


@router.post("/sources/load", response_model=DatasetResponse)
async def source_load(organization_id: int, payload: SourceLoadRequest, member: MemberDep):
    await _guarded(member)
    if payload.kind == "postgres" and payload.postgres:
        dataset = await bi_sources.pg_load(payload.postgres, payload.table)
        target = f"{payload.postgres.host}:{payload.postgres.port}/{payload.postgres.database}"
    elif payload.kind == "onec" and payload.onec:
        dataset = await bi_sources.onec_load(payload.onec, payload.table)
        target = payload.onec.url
    else:
        raise BadRequestError("Не указаны параметры подключения")
    await audit.record(
        organization_id,
        member.user_id,
        "bi.source.load",
        details={
            "kind": payload.kind,
            "target": target,
            "table": payload.table,
            "rows": dataset["total_rows"],
        },
    )
    return dataset


@router.post("/sources/url", response_model=DatasetResponse)
async def source_url(organization_id: int, payload: UrlSourceRequest, member: MemberDep):
    """Google Sheets / Yandex Disk public link / direct CSV or XLSX URL."""
    await _guarded(member)
    dataset = await bi_url.load_url(payload.url)
    await audit.record(
        organization_id,
        member.user_id,
        "bi.source.url",
        details={"url": payload.url, "rows": dataset["total_rows"]},
    )
    return dataset

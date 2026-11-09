from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.organization import get_organization_member
from app.exceptions import BadRequestError
from app.schemas.reports import DatasetResponse, ReportPlanRequest, ReportPlanResponse
from app.services import bi

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

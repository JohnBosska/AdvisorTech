from typing import Annotated

from fastapi import APIRouter, Depends

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.organization import get_organization_member
from app.resources.bi_reports import BiReports
from app.schemas.reports import BiReportResponse, BiReportSummary, BiReportWrite

router = APIRouter(prefix="/organizations/{organization_id}/bi/reports", tags=["BI reports"])
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.get("", response_model=list[BiReportSummary])
async def list_reports(organization_id: int, member: MemberDep):
    return await BiReports.list(member)


@router.post("", response_model=BiReportResponse, status_code=201)
async def create_report(organization_id: int, payload: BiReportWrite, member: MemberDep):
    return await BiReports.create(member, payload)


@router.get("/{report_id}", response_model=BiReportResponse)
async def get_report(organization_id: int, report_id: int, member: MemberDep):
    return await BiReports.get(member, report_id)


@router.put("/{report_id}", response_model=BiReportResponse)
async def update_report(
    organization_id: int, report_id: int, payload: BiReportWrite, member: MemberDep
):
    return await BiReports.update(member, report_id, payload)


@router.delete("/{report_id}", status_code=204)
async def delete_report(organization_id: int, report_id: int, member: MemberDep) -> None:
    await BiReports.delete(member, report_id)


@router.post("/{report_id}/refresh", response_model=BiReportResponse)
async def refresh_report(organization_id: int, report_id: int, member: MemberDep):
    return await BiReports.refresh(member, report_id)

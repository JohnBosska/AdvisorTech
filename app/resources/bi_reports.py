import json

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import BiReport, OrganizationMember
from app.exceptions import BadRequestError, ForbiddenError, ObjectNotFoundError
from app.schemas.reports import BiReportWrite
from app.services import bi_url

MAX_SPEC_BYTES = 300_000
MAX_DATASET_BYTES = 5_000_000
Role = OrganizationMember.RoleEnum


def _check_sizes(payload: BiReportWrite) -> tuple[dict, dict | None]:
    spec = payload.spec
    if len(json.dumps(spec, ensure_ascii=False)) > MAX_SPEC_BYTES:
        raise BadRequestError("Отчёт слишком большой")
    pages = spec.get("pages")
    if not isinstance(pages, list) or not 1 <= len(pages) <= 30:
        raise BadRequestError("В отчёте должно быть от 1 до 30 страниц")
    dataset = payload.dataset.model_dump(mode="json") if payload.dataset else None
    if dataset and len(json.dumps(dataset, ensure_ascii=False)) > MAX_DATASET_BYTES:
        raise BadRequestError("Данные отчёта больше 5 МБ: уменьшите выборку")
    return spec, dataset


def _can_edit(member: OrganizationMember, report: BiReport) -> None:
    if report.created_by != member.user_id and member.role != Role.OWNER:
        raise ForbiddenError("Изменять отчёт может автор или владелец организации")


class BiReports:
    @staticmethod
    async def list(member: OrganizationMember) -> list[BiReport]:
        async with SessionFactory() as session:
            return await BiReport.list_in_org(session, member.organization_id)

    @staticmethod
    async def get(member: OrganizationMember, report_id: int) -> BiReport:
        async with SessionFactory() as session:
            report = await BiReport.get_in_org(session, member.organization_id, report_id)
        if report is None:
            raise ObjectNotFoundError("Отчёт не найден")
        return report

    @staticmethod
    async def create(member: OrganizationMember, payload: BiReportWrite) -> BiReport:
        spec, dataset = _check_sizes(payload)
        async with SessionFactory.begin() as session:
            return await BiReport(
                organization_id=member.organization_id,
                created_by=member.user_id,
                title=payload.title,
                spec=spec,
                dataset=dataset,
                source=payload.source.model_dump(),
            ).save(session)

    @staticmethod
    async def update(
        member: OrganizationMember, report_id: int, payload: BiReportWrite
    ) -> BiReport:
        spec, dataset = _check_sizes(payload)
        async with SessionFactory.begin() as session:
            report = await BiReport.get_in_org(session, member.organization_id, report_id)
            if report is None:
                raise ObjectNotFoundError("Отчёт не найден")
            _can_edit(member, report)
            report.title, report.spec, report.dataset = payload.title, spec, dataset
            report.source = payload.source.model_dump()
            return await report.save(session)

    @staticmethod
    async def delete(member: OrganizationMember, report_id: int) -> None:
        async with SessionFactory.begin() as session:
            report = await BiReport.get_in_org(session, member.organization_id, report_id)
            if report is None:
                raise ObjectNotFoundError("Отчёт не найден")
            _can_edit(member, report)
            report.is_deleted = True
            await report.save(session)

    @staticmethod
    async def refresh(member: OrganizationMember, report_id: int) -> BiReport:
        """Re-downloads link-based data. Other sources need credentials, which are never stored."""
        report = await BiReports.get(member, report_id)
        url = (report.source or {}).get("url")
        if (report.source or {}).get("kind") != "url" or not url:
            raise BadRequestError(
                "Обновить можно только отчёт по ссылке: для 1С и PostgreSQL подключитесь заново"
            )
        dataset = await bi_url.load_url(url)
        async with SessionFactory.begin() as session:
            stored = await BiReport.get_in_org(session, member.organization_id, report_id)
            _can_edit(member, stored)
            stored.dataset = json.loads(json.dumps(dataset, default=lambda o: o.model_dump()))
            return await stored.save(session)

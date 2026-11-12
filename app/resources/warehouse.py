"""Read side of the raw warehouse layer, always scoped to the caller's organization."""

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import OrganizationMember, RawRecord, SourceConnection
from app.exceptions import ObjectNotFoundError
from app.services.bi import MAX_ROWS, build_dataset, cell


class Warehouse:
    @staticmethod
    async def entities(member: OrganizationMember) -> list[dict]:
        async with SessionFactory() as session:
            stats = await RawRecord.entity_stats(session, member.organization_id)
            connections = {
                c.id: c.name
                for c in await SourceConnection.list_for_organization(
                    session, member.organization_id
                )
            }
        return [{**s, "connection_name": connections.get(s["connection_id"], "")} for s in stats]

    @staticmethod
    async def dataset(member: OrganizationMember, connection_id: int, entity: str) -> dict:
        async with SessionFactory() as session:
            rows = await RawRecord.payloads(
                session, member.organization_id, connection_id, entity, MAX_ROWS + 1
            )
        if not rows:
            raise ObjectNotFoundError("В хранилище нет записей этой сущности")
        # scalar fields only, in first-seen order; nested parts are skipped like in OData
        header: list[str] = []
        for r in rows:
            for k, v in r.payload.items():
                if k not in header and not isinstance(v, (dict, list)):
                    header.append(k)
        header = header[:60]
        body = [[cell(r.payload.get(k)) for k in header] for r in rows]
        total = None if len(rows) > MAX_ROWS else len(rows)
        return build_dataset(entity, header, body, total_rows=total)

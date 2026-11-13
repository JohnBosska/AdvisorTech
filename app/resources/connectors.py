"""Server-side connectors: credentials, discovery, entity configuration and the sync runner."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.config.connectors import connectors as conf
from app.connectors import DEFAULT_KEY, make_connector
from app.connectors.base import cursor_text
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import (
    ConnectorCredential,
    OrganizationMember,
    SourceConnection,
    SyncCursor,
    SyncRun,
)
from app.exceptions import BadRequestError, ConflictError, ObjectNotFoundError
from app.resources.organization import CONNECTION_MANAGER_ROLES, require_role
from app.resources.raw import upsert_raw_records
from app.schemas.connectors import CredentialsRequest, EntitiesRequest
from app.services import audit, credentials
from app.services import temporal as temporal_service

logger = logging.getLogger(__name__)
ConnStatus = SourceConnection.StatusEnum
SyncStatus = SyncRun.StatusEnum


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _target(kind: str, creds: dict) -> str:
    if kind == "postgres":
        return f"{creds.get('host')}:{creds.get('port', 5432)}/{creds.get('database')}"
    return str(creds.get("url", ""))


async def _connection(session, organization_id: int, connection_id: int) -> SourceConnection:
    connection = await SourceConnection.get_in_organization(session, organization_id, connection_id)
    if connection is None:
        raise ObjectNotFoundError("Connection not found")
    return connection


async def _load_connector(organization_id: int, connection_id: int):
    """(connection, connector) with decrypted credentials, which never leave this process."""
    async with SessionFactory() as session:
        connection = await _connection(session, organization_id, connection_id)
        cred = await ConnectorCredential.get_for_connection(session, organization_id, connection_id)
    if cred is None or not connection.connector_kind:
        raise BadRequestError("Для этого подключения не заданы учётные данные коннектора")
    return connection, make_connector(cred.kind, credentials.decrypt(cred.ciphertext))


class Connectors:
    @staticmethod
    async def credentials_status(member: OrganizationMember, connection_id: int) -> dict:
        async with SessionFactory() as session:
            connection = await _connection(session, member.organization_id, connection_id)
            cred = await ConnectorCredential.get_for_connection(
                session, member.organization_id, connection_id
            )
        if cred is None:
            return {"kind": connection.connector_kind, "configured": False, "target": None}
        data = credentials.decrypt(cred.ciphertext)
        return {"kind": cred.kind, "configured": True, "target": _target(cred.kind, data)}

    @staticmethod
    async def set_credentials(
        member: OrganizationMember, connection_id: int, payload: CredentialsRequest
    ) -> dict:
        require_role(member, CONNECTION_MANAGER_ROLES)
        source = payload.postgres if payload.kind == "postgres" else payload.onec
        if source is None:
            raise BadRequestError("Не указаны параметры подключения")
        creds = source.model_dump()
        await make_connector(payload.kind, creds).test()  # fails loudly before anything is stored
        blob = credentials.encrypt(creds)
        async with SessionFactory.begin() as session:
            connection = await _connection(session, member.organization_id, connection_id)
            existing = await ConnectorCredential.get_for_connection(
                session, member.organization_id, connection_id
            )
            if existing:
                existing.kind, existing.ciphertext = payload.kind, blob
                existing.key_fingerprint, existing.created_by = (
                    credentials.key_fingerprint(),
                    member.user_id,
                )
                await existing.save(session)
            else:
                await ConnectorCredential(
                    organization_id=member.organization_id,
                    connection_id=connection_id,
                    kind=payload.kind,
                    ciphertext=blob,
                    key_fingerprint=credentials.key_fingerprint(),
                    created_by=member.user_id,
                ).save(session)
            connection.connector_kind = payload.kind
            connection.status = ConnStatus.CONNECTED
            await connection.save(session)
        await audit.record(
            member.organization_id,
            member.user_id,
            "connector.credentials.set",
            object_type="connection",
            object_id=connection_id,
            details={"kind": payload.kind, "target": _target(payload.kind, creds)},
        )
        return {"kind": payload.kind, "configured": True, "target": _target(payload.kind, creds)}

    @staticmethod
    async def discover(member: OrganizationMember, connection_id: int) -> list[dict]:
        _, connector = await _load_connector(member.organization_id, connection_id)
        return [t.__dict__ for t in await connector.discover()]

    @staticmethod
    async def columns(member: OrganizationMember, connection_id: int, table: str) -> list[dict]:
        _, connector = await _load_connector(member.organization_id, connection_id)
        return [c.__dict__ for c in await connector.columns(table)]

    @staticmethod
    async def configure(
        member: OrganizationMember, connection_id: int, payload: EntitiesRequest
    ) -> SourceConnection:
        require_role(member, CONNECTION_MANAGER_ROLES)
        async with SessionFactory.begin() as session:
            connection = await _connection(session, member.organization_id, connection_id)
            if not connection.connector_kind:
                raise BadRequestError("Сначала задайте учётные данные коннектора")
            connection.entity_config = {
                name: cfg.model_dump() for name, cfg in payload.entities.items()
            }
            connection.enabled_entities = sorted(payload.entities)
            connection.schedule_minutes = payload.schedule_minutes
            connection = await connection.save(session)
        await temporal_service.upsert_sync_schedule(
            connection_id, member.organization_id, payload.schedule_minutes
        )
        await audit.record(
            member.organization_id,
            member.user_id,
            "connector.configure",
            object_type="connection",
            object_id=connection_id,
            details={
                "entities": sorted(payload.entities),
                "schedule_minutes": payload.schedule_minutes,
            },
        )
        return connection

    @staticmethod
    async def cursors(member: OrganizationMember, connection_id: int) -> list[dict]:
        async with SessionFactory() as session:
            await _connection(session, member.organization_id, connection_id)
            values = await SyncCursor.for_connection(session, connection_id)
        return [{"entity": e, "cursor_value": v} for e, v in sorted(values.items())]

    @staticmethod
    async def sync_now(
        member: OrganizationMember, connection_id: int, mode: SyncRun.ModeEnum
    ) -> SyncRun:
        require_role(member, CONNECTION_MANAGER_ROLES)
        run = await Connectors.enqueue(member.organization_id, connection_id, mode)
        await audit.record(
            member.organization_id,
            member.user_id,
            "sync.request",
            object_type="sync_run",
            object_id=run.id,
            details={"connection_id": connection_id, "mode": mode.value, "connector": True},
        )
        try:
            await temporal_service.start_sync_workflow(
                run.id, member.organization_id, connection_id
            )
        except Exception:
            # never leave a QUEUED run behind: it would block every later sync
            await _finish(
                run.id,
                connection_id,
                SyncStatus.FAILED,
                {"received": 0, "accepted": 0},
                "Фоновый обработчик недоступен",
            )
            raise
        async with SessionFactory() as session:
            return await SyncRun.get_by_id(session, run.id)

    @staticmethod
    async def enqueue(organization_id: int, connection_id: int, mode: SyncRun.ModeEnum) -> SyncRun:
        async with SessionFactory.begin() as session:
            connection = await _connection(session, organization_id, connection_id)
            if not connection.connector_kind:
                raise BadRequestError("Для этого подключения не задан коннектор")
            if not connection.entity_config:
                raise BadRequestError("Выберите сущности для загрузки")
            active = (
                await session.execute(
                    select(SyncRun.id).where(
                        SyncRun.connection_id == connection_id,
                        SyncRun.status.in_([SyncStatus.QUEUED, SyncStatus.RUNNING]),
                    )
                )
            ).first()
            if active is not None:
                raise ConflictError("Синхронизация уже выполняется")
            return await SyncRun(
                organization_id=organization_id,
                connection_id=connection_id,
                mode=mode,
                status=SyncStatus.QUEUED,
            ).save(session)

    @staticmethod
    async def run_sync(run_id: int, organization_id: int, connection_id: int) -> dict:
        """Executed by the Temporal activity. Pages every configured entity into the raw layer,
        advancing cursors; a failure marks the run and the connection, never half-states."""
        async with SessionFactory.begin() as session:
            run = await SyncRun.get_by_id(session, run_id)
            if run is None or run.organization_id != organization_id:
                raise ObjectNotFoundError("Sync run not found")
            if run.status != SyncStatus.QUEUED:
                return {"skipped": True, "status": run.status.value}
            run.status, run.started_at = SyncStatus.RUNNING, _now()
            await run.save(session)
            connection = await _connection(session, organization_id, connection_id)
            config = dict(connection.entity_config or {})
            mode = run.mode
            cursors = await SyncCursor.for_connection(session, connection_id)

        totals = {"received": 0, "accepted": 0}
        try:
            _, connector = await _load_connector(organization_id, connection_id)
            for entity, cfg in config.items():
                key = cfg.get("key") or DEFAULT_KEY.get(connector.kind, "id")
                cursor = cfg.get("cursor") or None
                after = None if mode == SyncRun.ModeEnum.FULL else cursors.get(entity)
                offset = 0
                for _ in range(conf.max_pages_per_entity):
                    page = await connector.extract(
                        entity, key, cursor, after, offset, conf.page_size
                    )
                    rows = [(str(r.get(key)), r) for r in page.records if r.get(key) is not None]
                    totals["received"] += len(page.records)
                    totals["accepted"] += len(rows)
                    async with SessionFactory.begin() as session:
                        await upsert_raw_records(
                            session,
                            organization_id=organization_id,
                            connection_id=connection_id,
                            run_id=run_id,
                            entity=entity,
                            records=rows,
                        )
                        if cursor and page.next_cursor is not None:
                            await _save_cursor(
                                session, organization_id, connection_id, entity, page.next_cursor
                            )
                    if len(page.records) < conf.page_size:
                        break
                    if cursor:
                        after = page.next_cursor  # keyset: next page starts after the last cursor
                    else:
                        offset += conf.page_size
        except Exception as exc:
            logger.exception("sync run %s failed", run_id)
            await _finish(run_id, connection_id, SyncStatus.FAILED, totals, str(exc)[:500])
            await audit.record(
                organization_id,
                None,
                "sync.finished",
                object_type="sync_run",
                object_id=run_id,
                details={"status": "FAILED", **totals, "error": str(exc)[:300]},
            )
            raise
        await _finish(run_id, connection_id, SyncStatus.SUCCEEDED, totals, None)
        await audit.record(
            organization_id,
            None,
            "sync.finished",
            object_type="sync_run",
            object_id=run_id,
            details={"status": "SUCCEEDED", **totals},
        )
        return {"skipped": False, "status": "SUCCEEDED", **totals}


async def _save_cursor(session, organization_id, connection_id, entity, value: str) -> None:
    row = (
        await session.execute(
            select(SyncCursor).where(
                SyncCursor.connection_id == connection_id, SyncCursor.entity == entity
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = SyncCursor(
            organization_id=organization_id, connection_id=connection_id, entity=entity
        )
    row.cursor_value = cursor_text(value)
    await row.save(session)


async def _finish(run_id, connection_id, status, totals, error: str | None) -> None:
    async with SessionFactory.begin() as session:
        run = await SyncRun.get_by_id(session, run_id)
        run.status, run.finished_at, run.error_summary = status, _now(), error
        run.records_received = totals["received"]
        run.records_accepted = totals["accepted"]
        run.records_rejected = totals["received"] - totals["accepted"]
        await run.save(session)
        connection = await SourceConnection.get_by_id(session, connection_id)
        if status == SyncStatus.SUCCEEDED:
            connection.last_successful_sync_at = _now()
            connection.status = ConnStatus.CONNECTED
        else:
            connection.status = ConnStatus.ERROR
        await connection.save(session)

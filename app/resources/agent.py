from datetime import datetime, timezone

from sqlalchemy import select

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import (
    AgentCredential,
    IngestionBatch,
    OrganizationMember,
    SourceConnection,
    SyncRun,
)
from app.dependencies.agent import AgentContext
from app.exceptions import ConflictError, ObjectNotFoundError
from app.resources.organization import CONNECTION_MANAGER_ROLES, require_role
from app.resources.raw import upsert_raw_records
from app.schemas.agent import BatchRequest, FinishRequest, HeartbeatRequest
from app.schemas.integration import SyncRunCreateRequest
from app.services import audit
from app.utils.tokens import generate_opaque_token

SyncStatus = SyncRun.StatusEnum
ConnStatus = SourceConnection.StatusEnum


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _connection_for_update(
    session, organization_id: int, connection_id: int
) -> SourceConnection:
    connection = (
        await session.execute(
            select(SourceConnection)
            .where(
                SourceConnection.id == connection_id,
                SourceConnection.organization_id == organization_id,
                SourceConnection.is_deleted.is_(False),
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if connection is None:
        raise ObjectNotFoundError("Connection not found")
    return connection


class AgentManagement:
    """User-facing side: issue/revoke agent credentials, request syncs."""

    @staticmethod
    async def issue_credential(member: OrganizationMember, connection_id: int) -> str:
        require_role(member, CONNECTION_MANAGER_ROLES)
        plain, token_hash = generate_opaque_token("agt")
        async with SessionFactory.begin() as session:
            connection = await _connection_for_update(
                session, member.organization_id, connection_id
            )
            for old in await AgentCredential.list_active_for_connection(session, connection.id):
                old.revoked_at = _now()
            await AgentCredential(
                organization_id=member.organization_id,
                connection_id=connection.id,
                token_hash=token_hash,
            ).save(session)
            connection.status = ConnStatus.AWAITING_AGENT
            await connection.save(session)
        await audit.record(
            member.organization_id,
            member.user_id,
            "agent.credential.issue",
            object_type="connection",
            object_id=connection_id,
        )
        return plain

    @staticmethod
    async def revoke_credentials(member: OrganizationMember, connection_id: int) -> None:
        require_role(member, CONNECTION_MANAGER_ROLES)
        async with SessionFactory.begin() as session:
            connection = await _connection_for_update(
                session, member.organization_id, connection_id
            )
            for old in await AgentCredential.list_active_for_connection(session, connection.id):
                old.revoked_at = _now()
            connection.status = ConnStatus.REVOKED
            await connection.save(session)
        await audit.record(
            member.organization_id,
            member.user_id,
            "agent.credential.revoke",
            object_type="connection",
            object_id=connection_id,
        )

    @staticmethod
    async def request_sync(
        member: OrganizationMember, connection_id: int, payload: SyncRunCreateRequest
    ) -> SyncRun:
        require_role(member, CONNECTION_MANAGER_ROLES)
        async with SessionFactory.begin() as session:
            connection = await _connection_for_update(
                session, member.organization_id, connection_id
            )
            if connection.status != ConnStatus.CONNECTED:
                raise ConflictError("The connector agent is not connected")
            active = (
                await session.execute(
                    select(SyncRun.id).where(
                        SyncRun.connection_id == connection.id,
                        SyncRun.status.in_([SyncStatus.QUEUED, SyncStatus.RUNNING]),
                    )
                )
            ).first()
            if active is not None:
                raise ConflictError("A synchronization is already queued or running")
            run = await SyncRun(
                organization_id=member.organization_id,
                connection_id=connection.id,
                mode=payload.mode,
                status=SyncStatus.QUEUED,
            ).save(session)
        await audit.record(
            member.organization_id,
            member.user_id,
            "sync.request",
            object_type="sync_run",
            object_id=run.id,
            details={"connection_id": connection_id, "mode": payload.mode.value},
        )
        return run


class AgentSync:
    """Agent-facing side. Every query is pinned to the credential's organization and connection."""

    @staticmethod
    async def heartbeat(agent: AgentContext, payload: HeartbeatRequest) -> None:
        async with SessionFactory.begin() as session:
            connection = await _connection_for_update(
                session, agent.organization_id, agent.connection_id
            )
            credential = await AgentCredential.get_by_id(session, agent.credential_id)
            if credential is None or credential.revoked_at is not None:
                raise ObjectNotFoundError("Connection not found")
            credential.last_seen_at = _now()
            if payload.agent_version is not None:
                credential.agent_version = payload.agent_version
            if payload.enabled_entities is not None:
                connection.enabled_entities = sorted(set(payload.enabled_entities))
            connection.status = ConnStatus.CONNECTED
            await connection.save(session)

    @staticmethod
    async def pending(agent: AgentContext) -> list[SyncRun]:
        async with SessionFactory() as session:
            result = await session.execute(
                select(SyncRun)
                .where(
                    SyncRun.organization_id == agent.organization_id,
                    SyncRun.connection_id == agent.connection_id,
                    SyncRun.status == SyncStatus.QUEUED,
                )
                .order_by(SyncRun.id)
            )
            return list(result.scalars())

    @staticmethod
    async def _run_for_update(session, agent: AgentContext, run_id: int) -> SyncRun:
        run = (
            await session.execute(
                select(SyncRun)
                .where(
                    SyncRun.id == run_id,
                    SyncRun.organization_id == agent.organization_id,
                    SyncRun.connection_id == agent.connection_id,
                    SyncRun.is_deleted.is_(False),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if run is None:
            raise ObjectNotFoundError("Sync run not found")
        return run

    @classmethod
    async def start(cls, agent: AgentContext, run_id: int) -> None:
        async with SessionFactory.begin() as session:
            run = await cls._run_for_update(session, agent, run_id)
            if run.status == SyncStatus.RUNNING:
                return  # retry of a successful start
            if run.status != SyncStatus.QUEUED:
                raise ConflictError("Sync run is already finished")
            run.status = SyncStatus.RUNNING
            run.started_at = _now()
            await run.save(session)

    @classmethod
    async def add_batch(
        cls, agent: AgentContext, run_id: int, payload: BatchRequest
    ) -> tuple[int, bool]:
        """Returns (sequence, duplicate). Re-sending an identical batch changes nothing."""
        async with SessionFactory.begin() as session:
            run = await cls._run_for_update(session, agent, run_id)
            if run.status != SyncStatus.RUNNING:
                raise ConflictError("Sync run is not running")
            connection = await _connection_for_update(
                session, agent.organization_id, agent.connection_id
            )
            if connection.enabled_entities and payload.entity not in connection.enabled_entities:
                raise ConflictError("Entity is not enabled for this connection")
            existing = await IngestionBatch.get_by_sequence(session, run.id, payload.sequence)
            if existing is not None:
                same = (
                    existing.entity == payload.entity
                    and existing.checksum == payload.checksum
                    and existing.records_received == payload.records_received
                )
                if not same:
                    raise ConflictError("Batch sequence was already used with different content")
                return payload.sequence, True
            await IngestionBatch(
                organization_id=agent.organization_id,
                sync_run_id=run.id,
                **payload.model_dump(exclude={"records"}),
            ).save(session)
            if payload.records:
                await upsert_raw_records(
                    session,
                    organization_id=agent.organization_id,
                    connection_id=agent.connection_id,
                    run_id=run.id,
                    entity=payload.entity,
                    records=[(r.key, r.data) for r in payload.records],
                )
            run.records_received += payload.records_received
            run.records_accepted += payload.records_accepted
            run.records_rejected += payload.records_rejected
            run.records_quarantined += payload.records_quarantined
            await run.save(session)
            return payload.sequence, False

    @classmethod
    async def finish(cls, agent: AgentContext, run_id: int, payload: FinishRequest) -> None:
        async with SessionFactory.begin() as session:
            run = await cls._run_for_update(session, agent, run_id)
            if run.status == payload.status:
                return  # retry
            if run.status != SyncStatus.RUNNING:
                raise ConflictError("Sync run is not running")
            run.status = payload.status
            run.finished_at = _now()
            if payload.status == SyncStatus.FAILED:
                run.error_summary = payload.error_summary or "Agent reported a failure"
            await run.save(session)
            if payload.status == SyncStatus.SUCCEEDED:
                connection = await _connection_for_update(
                    session, agent.organization_id, agent.connection_id
                )
                connection.last_successful_sync_at = run.finished_at
                await connection.save(session)

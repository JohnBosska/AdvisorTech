from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import OrganizationMember, SourceConnection, SyncRun
from app.exceptions import ObjectNotFoundError
from app.resources.organization import CONNECTION_MANAGER_ROLES, require_role
from app.schemas.integration import SourceConnectionCreateRequest
from app.services import audit


class SourceConnectionEntity:
    """Connections are created as DRAFT; nothing here talks to 1C (agent/gateway not built yet)."""

    @staticmethod
    async def create(
        member: OrganizationMember, payload: SourceConnectionCreateRequest
    ) -> SourceConnection:
        require_role(member, CONNECTION_MANAGER_ROLES)
        async with SessionFactory.begin() as session:
            connection = SourceConnection(
                organization_id=member.organization_id, **payload.model_dump()
            )
            connection = await connection.save(session)
        await audit.record(
            member.organization_id,
            member.user_id,
            "connection.create",
            object_type="connection",
            object_id=connection.id,
            details={"name": connection.name, "dbms": payload.source_dbms.value},
        )
        return connection

    @staticmethod
    async def list(member: OrganizationMember) -> list[SourceConnection]:
        async with SessionFactory() as session:
            return await SourceConnection.list_for_organization(session, member.organization_id)

    @staticmethod
    async def sync_runs(member: OrganizationMember, connection_id: int) -> list[SyncRun]:
        async with SessionFactory() as session:
            connection = await SourceConnection.get_in_organization(
                session, member.organization_id, connection_id
            )
            if connection is None:
                raise ObjectNotFoundError("Connection not found")
            return await SyncRun.list_for_connection(session, member.organization_id, connection_id)

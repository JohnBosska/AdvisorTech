from sqlalchemy import select

from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import AuditEvent, OrganizationMember, User
from app.resources.organization import require_role
from app.services.audit import ACTIONS

Role = OrganizationMember.RoleEnum
AUDIT_ROLES = frozenset({Role.OWNER, Role.IT_ADMIN})


class Audit:
    @staticmethod
    async def page(
        member: OrganizationMember,
        *,
        action: str | None,
        user_id: int | None,
        before_id: int | None,
        limit: int,
    ) -> list[dict]:
        require_role(member, AUDIT_ROLES)
        async with SessionFactory() as session:
            events = await AuditEvent.page(
                session,
                member.organization_id,
                action=action,
                user_id=user_id,
                before_id=before_id,
                limit=limit,
            )
            ids = {e.user_id for e in events if e.user_id}
            names = {}
            if ids:
                rows = await session.execute(select(User.id, User.name).where(User.id.in_(ids)))
                names = {row.id: row.name for row in rows}
        return [
            {
                "id": e.id,
                "occurred_at": e.occurred_at,
                "user_id": e.user_id,
                "user_name": names.get(e.user_id) if e.user_id else None,
                "action": e.action,
                "action_label": ACTIONS.get(e.action, e.action),
                "object_type": e.object_type,
                "object_id": e.object_id,
                "details": e.details,
                "request_id": e.request_id,
            }
            for e in events
        ]

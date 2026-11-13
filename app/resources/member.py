from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config.auth import auth
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import (
    OrganizationInvitation,
    OrganizationMember,
    User,
    UserEmail,
)
from app.exceptions import BadRequestError, ConflictError, ForbiddenError, ObjectNotFoundError
from app.schemas.member import (
    InvitationCreatedResponse,
    InvitationCreateRequest,
    MemberResponse,
)
from app.services import audit
from app.utils.tokens import generate_opaque_token, hash_opaque_token

Role = OrganizationMember.RoleEnum
MEMBER_MANAGER_ROLES = frozenset({Role.OWNER})


def _require_owner(member: OrganizationMember) -> None:
    if member.role not in MEMBER_MANAGER_ROLES:
        raise ForbiddenError("Insufficient role for this operation")


async def _owner_count(session, organization_id: int, *, exclude_member_id: int) -> int:
    result = await session.execute(
        select(OrganizationMember.id)
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.role == Role.OWNER,
            OrganizationMember.is_deleted.is_(False),
            OrganizationMember.id != exclude_member_id,
        )
        .with_for_update()
    )
    return len(result.all())


class MemberService:
    @staticmethod
    async def list(member: OrganizationMember) -> list[MemberResponse]:
        async with SessionFactory() as session:
            rows = await session.execute(
                select(OrganizationMember, User, UserEmail.email)
                .join(User, User.id == OrganizationMember.user_id)
                .outerjoin(
                    UserEmail,
                    (UserEmail.user_id == User.id) & UserEmail.verified_at.is_not(None),
                )
                .where(
                    OrganizationMember.organization_id == member.organization_id,
                    OrganizationMember.is_deleted.is_(False),
                )
                .order_by(OrganizationMember.id)
            )
            return [
                MemberResponse(id=m.id, user_id=user.id, name=user.name, email=email, role=m.role)
                for m, user, email in rows.all()
            ]

    @staticmethod
    async def _get_target(session, actor: OrganizationMember, member_id: int, *, lock: bool):
        statement = select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == actor.organization_id,
            OrganizationMember.is_deleted.is_(False),
        )
        if lock:
            statement = statement.with_for_update()
        target = (await session.execute(statement)).scalar_one_or_none()
        if target is None:
            raise ObjectNotFoundError("Member not found")
        return target

    @classmethod
    async def change_role(cls, actor: OrganizationMember, member_id: int, role: Role) -> None:
        _require_owner(actor)
        async with SessionFactory.begin() as session:
            target = await cls._get_target(session, actor, member_id, lock=True)
            if (
                target.role == Role.OWNER
                and role != Role.OWNER
                and await _owner_count(session, actor.organization_id, exclude_member_id=target.id)
                == 0
            ):
                raise ConflictError("An organization must keep at least one owner")
            target.role = role
            await target.save(session)

    @classmethod
    async def remove(cls, actor: OrganizationMember, member_id: int) -> None:
        _require_owner(actor)
        async with SessionFactory.begin() as session:
            target = await cls._get_target(session, actor, member_id, lock=True)
            if (
                target.role == Role.OWNER
                and await _owner_count(session, actor.organization_id, exclude_member_id=target.id)
                == 0
            ):
                raise ConflictError("An organization must keep at least one owner")
            target.is_deleted = True
            await target.save(session)
        await audit.record(
            actor.organization_id,
            actor.user_id,
            "member.remove",
            object_type="member",
            object_id=member_id,
            details={"removed_user_id": target.user_id, "role": target.role.value},
        )

    @staticmethod
    async def invite(
        actor: OrganizationMember, payload: InvitationCreateRequest
    ) -> InvitationCreatedResponse:
        _require_owner(actor)
        plain, token_hash = generate_opaque_token("inv")
        async with SessionFactory.begin() as session:
            invitation = await OrganizationInvitation(
                organization_id=actor.organization_id,
                email=str(payload.email).casefold(),
                role=payload.role,
                token_hash=token_hash,
                invited_by_id=actor.user_id,
                expires_at=datetime.now(timezone.utc)
                + timedelta(seconds=auth.invitation_ttl_seconds),
            ).save(session)
        await audit.record(
            actor.organization_id,
            actor.user_id,
            "member.invite",
            object_type="invitation",
            object_id=invitation.id,
            details={"email": invitation.email, "role": invitation.role.value},
        )
        return InvitationCreatedResponse(
            id=invitation.id,
            email=invitation.email,
            role=invitation.role,
            expires_at=invitation.expires_at,
            token=plain,
        )

    @staticmethod
    async def list_invitations(actor: OrganizationMember) -> list[OrganizationInvitation]:
        _require_owner(actor)
        async with SessionFactory() as session:
            return await OrganizationInvitation.list_pending(session, actor.organization_id)

    @staticmethod
    async def revoke_invitation(actor: OrganizationMember, invitation_id: int) -> None:
        _require_owner(actor)
        async with SessionFactory.begin() as session:
            invitation = await OrganizationInvitation.get_by_id(session, invitation_id)
            if (
                invitation is None
                or invitation.organization_id != actor.organization_id
                or invitation.accepted_at is not None
            ):
                raise ObjectNotFoundError("Invitation not found")
            invitation.is_deleted = True
            await invitation.save(session)
        await audit.record(
            actor.organization_id,
            actor.user_id,
            "invitation.revoke",
            object_type="invitation",
            object_id=invitation_id,
        )

    @staticmethod
    async def accept(user_id: int, token: str) -> int:
        """Join the organization. The user's verified email must match the invited address."""
        now = datetime.now(timezone.utc)
        async with SessionFactory.begin() as session:
            invitation = await OrganizationInvitation.get_by_hash(
                session, hash_opaque_token(token), for_update=True
            )
            if (
                invitation is None
                or invitation.accepted_at is not None
                or invitation.expires_at <= now
            ):
                raise BadRequestError("Invalid or expired invitation")
            identity = (
                await session.execute(
                    select(UserEmail).where(
                        UserEmail.user_id == user_id, UserEmail.is_deleted.is_(False)
                    )
                )
            ).scalar_one_or_none()
            if (
                identity is None
                or identity.verified_at is None
                or identity.email != invitation.email
            ):
                # Same answer as an unknown token: do not reveal who was invited.
                raise BadRequestError("Invalid or expired invitation")
            existing = await OrganizationMember.get_for_user(
                session, invitation.organization_id, user_id
            )
            if existing is not None:
                raise ConflictError("Already a member of this organization")
            invitation.accepted_at = now
            try:
                async with session.begin_nested():
                    await OrganizationMember(
                        organization_id=invitation.organization_id,
                        user_id=user_id,
                        role=invitation.role,
                    ).save(session)
            except IntegrityError as exc:
                raise ConflictError("Already a member of this organization") from exc
            return invitation.organization_id

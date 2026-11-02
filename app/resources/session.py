import uuid
from datetime import datetime, timedelta, timezone

from app.config.auth import auth
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import RefreshToken
from app.exceptions import UnauthorizedError
from app.utils.tokens import generate_opaque_token, hash_opaque_token

_INVALID = "Invalid or expired refresh token"


class RefreshSession:
    """Opaque rotating refresh tokens; the plain value only ever lives in an HttpOnly cookie."""

    @staticmethod
    async def issue(user_id: int, family_id: str | None = None) -> str:
        plain, token_hash = generate_opaque_token("rt")
        async with SessionFactory.begin() as session:
            await RefreshToken(
                user_id=user_id,
                family_id=family_id or str(uuid.uuid4()),
                token_hash=token_hash,
                expires_at=datetime.now(timezone.utc)
                + timedelta(seconds=auth.refresh_token_ttl_seconds),
            ).save(session)
        return plain

    @staticmethod
    async def rotate(plain: str) -> tuple[int, str]:
        """Consume a refresh token and return (user_id, new refresh token)."""
        now = datetime.now(timezone.utc)
        replay = False
        async with SessionFactory.begin() as session:
            token = await RefreshToken.get_by_hash(
                session, hash_opaque_token(plain), for_update=True
            )
            if token is None:
                raise UnauthorizedError(_INVALID)
            if token.revoked_at is not None:
                # A rotated token was presented again: assume theft and kill the whole family.
                await RefreshToken.revoke_family(session, token.family_id, now)
                replay = True
            elif token.expires_at <= now:
                raise UnauthorizedError(_INVALID)
            else:
                token.revoked_at = now
                user_id, family_id = token.user_id, token.family_id
        if replay:
            raise UnauthorizedError(_INVALID)
        return user_id, await RefreshSession.issue(user_id, family_id)

    @staticmethod
    async def revoke(plain: str) -> None:
        """Logout: revoke the whole family. Unknown tokens are ignored (idempotent)."""
        now = datetime.now(timezone.utc)
        async with SessionFactory.begin() as session:
            token = await RefreshToken.get_by_hash(session, hash_opaque_token(plain))
            if token is not None:
                await RefreshToken.revoke_family(session, token.family_id, now)

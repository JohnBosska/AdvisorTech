from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.exceptions import ObjectNotFoundError, UnauthorizedError
from app.resources.user import UserEntity
from app.utils.auth import decode_access_token

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer),
    ],
) -> UserEntity:
    if credentials is None:
        raise UnauthorizedError("Invalid or missing access token")

    try:
        claims = decode_access_token(credentials.credentials)
        user_id = int(claims["sub"])
    except KeyError, TypeError, ValueError:
        raise UnauthorizedError("Invalid or missing access token") from None

    try:
        return await UserEntity.find(user_id)
    except ObjectNotFoundError:
        raise UnauthorizedError("Invalid or missing access token") from None

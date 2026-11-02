from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response

from app.config.auth import auth
from app.dependencies.auth import get_current_user
from app.exceptions import UnauthorizedError
from app.resources.session import RefreshSession
from app.resources.user import UserEntity
from app.schemas.auth import (
    AccessTokenResponse,
    AuthenticatedUserResponse,
    EmailLoginRequest,
    EmailRegisterRequest,
    EmailVerificationPendingResponse,
    EmailVerificationRequest,
    TelegramOAuthRequest,
    TelegramWebAppRequest,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
CurrentUserDep = Annotated[UserEntity, Depends(get_current_user)]

REFRESH_COOKIE = "ta_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=auth.refresh_token_ttl_seconds,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=auth.cookie_secure,
        samesite="lax",
    )


async def _with_session(response: Response, tokens: AccessTokenResponse) -> AccessTokenResponse:
    _set_refresh_cookie(response, await RefreshSession.issue(tokens.user_id))
    return tokens


@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_authenticated_user(user: CurrentUserDep) -> AuthenticatedUserResponse:
    return user.detail()


@router.post("/email/register", response_model=EmailVerificationPendingResponse, status_code=201)
async def register_with_email(
    payload: EmailRegisterRequest,
) -> EmailVerificationPendingResponse:
    return await UserEntity.register_with_email(payload)


@router.post("/email/login", response_model=AccessTokenResponse)
async def login_with_email(
    payload: EmailLoginRequest,
    response: Response,
) -> AccessTokenResponse:
    return await _with_session(response, await UserEntity.login_with_email(payload))


@router.post("/telegram/oauth", response_model=AccessTokenResponse)
async def login_with_telegram_oauth(
    payload: TelegramOAuthRequest,
    response: Response,
) -> AccessTokenResponse:
    return await _with_session(
        response, await UserEntity.login_with_telegram_oauth(payload.id_token)
    )


@router.post("/telegram/webapp", response_model=AccessTokenResponse)
async def login_with_telegram_webapp(
    payload: TelegramWebAppRequest,
    response: Response,
) -> AccessTokenResponse:
    return await _with_session(
        response, await UserEntity.login_with_telegram_webapp(payload.init_data)
    )


@router.post("/email/verify", response_model=AccessTokenResponse)
async def verify_email(
    payload: EmailVerificationRequest,
    response: Response,
) -> AccessTokenResponse:
    return await _with_session(response, await UserEntity.verify_email(payload))


@router.post("/email/resend", response_model=EmailVerificationPendingResponse, status_code=202)
async def resend_email_verification(payload: EmailLoginRequest) -> EmailVerificationPendingResponse:
    return await UserEntity.resend_email_verification(payload)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_access_token(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> AccessTokenResponse:
    if not refresh_token:
        raise UnauthorizedError("Invalid or expired refresh token")
    user_id, new_token = await RefreshSession.rotate(refresh_token)
    user = await UserEntity.find(user_id)
    _set_refresh_cookie(response, new_token)
    return user.create_access_token()


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> None:
    if refresh_token:
        await RefreshSession.revoke(refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)

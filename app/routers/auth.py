from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
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
) -> AccessTokenResponse:
    return await UserEntity.login_with_email(payload)


@router.post("/telegram/oauth", response_model=AccessTokenResponse)
async def login_with_telegram_oauth(
    payload: TelegramOAuthRequest,
) -> AccessTokenResponse:
    return await UserEntity.login_with_telegram_oauth(payload.id_token)


@router.post("/telegram/webapp", response_model=AccessTokenResponse)
async def login_with_telegram_webapp(
    payload: TelegramWebAppRequest,
) -> AccessTokenResponse:
    return await UserEntity.login_with_telegram_webapp(payload.init_data)


@router.post("/email/verify", response_model=AccessTokenResponse)
async def verify_email(payload: EmailVerificationRequest) -> AccessTokenResponse:
    return await UserEntity.verify_email(payload)


@router.post("/email/resend", response_model=EmailVerificationPendingResponse, status_code=202)
async def resend_email_verification(payload: EmailLoginRequest) -> EmailVerificationPendingResponse:
    return await UserEntity.resend_email_verification(payload)

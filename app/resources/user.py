import hmac
from datetime import datetime, timedelta, timezone
from typing import Self

from sqlalchemy.exc import IntegrityError

from app.config.auth import auth
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import User, UserEmail, UserTelegram
from app.exceptions import (
    AuthConfigurationError,
    BadRequestError,
    ConflictError,
    EmailDeliveryError,
    ForbiddenError,
    ServiceUnavailableError,
    TelegramAPIError,
    TooManyRequestsError,
    UnauthorizedError,
)
from app.resources.base import BaseEntity
from app.schemas.auth import (
    AccessTokenResponse,
    AuthenticatedUserResponse,
    EmailLoginRequest,
    EmailRegisterRequest,
    EmailVerificationPendingResponse,
    EmailVerificationRequest,
)
from app.schemas.email import EmailPayload
from app.services.telegram import (
    verify_telegram_oauth_token,
    verify_telegram_webapp_data,
)
from app.services.temporal import schedule_email
from app.utils.auth import create_access_token, generate_email_code, hash_email_code
from app.utils.passwords import hash_password, verify_password


class UserEntity(BaseEntity[User]):
    @classmethod
    async def find(cls, object_id: int) -> Self:
        async with SessionFactory() as session:
            return cls._create_from_db_object(await User.get_by_id(session, object_id))

    def detail(self) -> AuthenticatedUserResponse:
        return AuthenticatedUserResponse.model_validate(self.db_object)

    def create_access_token(self) -> AccessTokenResponse:
        return AccessTokenResponse(
            access_token=create_access_token(self.db_object),
            user_id=self.db_object.id,
        )

    @classmethod
    async def register_with_email(
        cls,
        payload: EmailRegisterRequest,
    ) -> EmailVerificationPendingResponse:
        password_hash = await hash_password(payload.password)
        code = generate_email_code()
        try:
            async with SessionFactory.begin() as session:
                user = User(name=payload.name)
                user.email_identity = UserEmail(
                    email=str(payload.email).casefold(),
                    password_hash=password_hash,
                )
                cls._set_email_code(user.email_identity, code)
                await user.save(session)
        except IntegrityError as exc:
            raise ConflictError("Email is already registered") from exc

        await cls._send_verification_email(str(payload.email).casefold(), code)
        return EmailVerificationPendingResponse()

    @classmethod
    async def login_with_email(
        cls,
        payload: EmailLoginRequest,
    ) -> AccessTokenResponse:
        async with SessionFactory() as session:
            identity = await UserEmail.get_by_email(session, str(payload.email))
            if identity is None or not await verify_password(
                payload.password, identity.password_hash
            ):
                raise UnauthorizedError("Invalid email or password")

            if identity.verified_at is None:
                raise ForbiddenError("Email verification required")
            return cls(identity.user).create_access_token()

    @classmethod
    async def login_with_telegram_oauth(
        cls,
        id_token: str,
    ) -> AccessTokenResponse:
        try:
            telegram_user = await verify_telegram_oauth_token(id_token)
            if not telegram_user.get("sub"):
                raise ValueError("Telegram OAuth token has no subject")
            telegram_user["id"] = int(telegram_user["sub"])
        except AuthConfigurationError as exc:
            raise ServiceUnavailableError("Telegram OAuth is not configured") from exc
        except TelegramAPIError as exc:
            raise ServiceUnavailableError("Telegram OAuth is unavailable") from exc
        except (ValueError, TypeError) as exc:
            raise UnauthorizedError("Invalid Telegram OAuth token") from exc

        return await cls._telegram_access_token(telegram_user)

    @classmethod
    async def login_with_telegram_webapp(
        cls,
        init_data: str,
    ) -> AccessTokenResponse:
        try:
            telegram_user = verify_telegram_webapp_data(init_data)
        except AuthConfigurationError as exc:
            raise ServiceUnavailableError(
                "Telegram WebApp authentication is not configured"
            ) from exc
        except ValueError as exc:
            raise UnauthorizedError("Invalid Telegram WebApp data") from exc

        return await cls._telegram_access_token(telegram_user)

    @classmethod
    async def _telegram_access_token(
        cls,
        telegram_user: dict[str, object],
    ) -> AccessTokenResponse:
        telegram_id = int(telegram_user["id"])
        try:
            async with SessionFactory.begin() as session:
                identity = await UserTelegram.get_by_telegram_id(session, telegram_id)
                first_name = telegram_user.get("first_name") or telegram_user.get("given_name")
                username = telegram_user.get("username") or telegram_user.get("preferred_username")

                if identity is None:
                    user = User(name=str(first_name) if first_name else None)
                    user.telegram_identity = UserTelegram(
                        telegram_id=telegram_id,
                        username=str(username) if username else None,
                    )
                else:
                    user = identity.user
                    identity.username = str(username) if username else identity.username
                    if not user.name and first_name:
                        user.name = str(first_name)

                await user.save(session)
                response = cls(user).create_access_token()
        except IntegrityError:
            async with SessionFactory() as session:
                identity = await UserTelegram.get_by_telegram_id(session, telegram_id)
                if identity is None:
                    raise ConflictError("Could not create Telegram account") from None
                user = identity.user
                response = cls(user).create_access_token()

        return response

    @staticmethod
    def _set_email_code(identity: UserEmail, code: str) -> None:
        now = datetime.now(timezone.utc)
        identity.verification_code_hash = hash_email_code(identity.email, code)
        identity.verification_expires_at = now + timedelta(
            seconds=auth.email_verification_ttl_seconds
        )
        identity.verification_sent_at = now
        identity.verification_attempts = 0

    @staticmethod
    async def _send_verification_email(email: str, code: str) -> None:
        try:
            await schedule_email(
                EmailPayload(
                    recipient=email,
                    subject="Подтверждение email — Salon Booking",
                    text_body=(
                        f"Код подтверждения: {code}\n"
                        f"Срок действия: {auth.email_verification_ttl_seconds} секунд.\n"
                        "Если вы не регистрировались, проигнорируйте это письмо."
                    ),
                )
            )
        except EmailDeliveryError as exc:
            raise ServiceUnavailableError(
                "Email could not be queued; please request a new verification code"
            ) from exc

    @classmethod
    async def resend_email_verification(
        cls,
        payload: EmailLoginRequest,
    ) -> EmailVerificationPendingResponse:
        async with SessionFactory.begin() as session:
            identity = await UserEmail.get_by_email(session, str(payload.email), for_update=True)
            if identity is None or not await verify_password(
                payload.password, identity.password_hash
            ):
                raise UnauthorizedError("Invalid email or password")
            if identity.verified_at is not None:
                raise ConflictError("Email is already verified")
            now = datetime.now(timezone.utc)
            if identity.verification_sent_at is not None:
                retry_after = auth.email_verification_resend_seconds - int(
                    (now - identity.verification_sent_at).total_seconds()
                )
                if retry_after > 0:
                    raise TooManyRequestsError(
                        "Please wait before requesting another code",
                        headers={"Retry-After": str(retry_after)},
                    )
            code = generate_email_code()
            cls._set_email_code(identity, code)
            await identity.save(session)
        await cls._send_verification_email(identity.email, code)
        return EmailVerificationPendingResponse()

    @classmethod
    async def verify_email(cls, payload: EmailVerificationRequest) -> AccessTokenResponse:
        invalid_code = False
        async with SessionFactory.begin() as session:
            identity = await UserEmail.get_by_email(session, str(payload.email), for_update=True)
            if identity is None or not await verify_password(
                payload.password, identity.password_hash
            ):
                raise UnauthorizedError("Invalid email or password")
            if (
                identity.verified_at is not None
                or identity.verification_code_hash is None
                or identity.verification_expires_at is None
                or identity.verification_expires_at <= datetime.now(timezone.utc)
                or identity.verification_attempts >= auth.email_verification_max_attempts
            ):
                raise BadRequestError("Invalid or expired verification code")
            if not hmac.compare_digest(
                identity.verification_code_hash,
                hash_email_code(identity.email, payload.code),
            ):
                identity.verification_attempts += 1
                await identity.save(session)
                invalid_code = True
            else:
                identity.verified_at = datetime.now(timezone.utc)
                identity.verification_code_hash = None
                identity.verification_expires_at = None
                if identity.user.role == User.RoleEnum.UNVERIFIED_USER:
                    identity.user.role = User.RoleEnum.VERIFIED_USER
                await identity.save(session)
                response = cls(identity.user).create_access_token()
        # Raise after committing, so failed attempts cannot be rolled back.
        if invalid_code:
            raise BadRequestError("Invalid or expired verification code")
        return response

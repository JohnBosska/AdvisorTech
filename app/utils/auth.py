import hashlib
import hmac
import secrets
import time

import jwt
from jwt.exceptions import PyJWTError

from app.config.auth import auth
from app.data_layer.alchemy.models import User
from app.exceptions import AuthConfigurationError, InvalidTokenError


def _get_jwt_secret() -> str:
    secret = auth.jwt_secret.get_secret_value()
    if len(secret.encode("utf-8")) < 32:
        raise AuthConfigurationError("AUTH_JWT_SECRET must contain at least 32 bytes")
    return secret


def create_access_token(user: User) -> str:
    secret = _get_jwt_secret()

    now = int(time.time())
    return jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "iat": now,
            "exp": now + auth.access_token_ttl_seconds,
            "iss": "salon-booking-api",
        },
        secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict[str, object]:
    secret = _get_jwt_secret()

    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer="salon-booking-api",
        )
    except PyJWTError as exc:
        raise InvalidTokenError("Invalid access token") from exc


def generate_email_code() -> str:
    return f"{secrets.randbelow(100_000_000):08d}"


def hash_email_code(email: str, code: str) -> str:
    return hmac.new(
        _get_jwt_secret().encode("utf-8"),
        f"email-verification:{email.casefold()}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

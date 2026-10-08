import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

import aiohttp
import jwt
from jwt.algorithms import RSAAlgorithm
from jwt.exceptions import PyJWTError

from app.config.telegram import telegram
from app.exceptions import AuthConfigurationError, InvalidTokenError, TelegramAPIError

_TELEGRAM_OIDC_ISSUER = "https://oauth.telegram.org"
_TELEGRAM_JWKS_URL = f"{_TELEGRAM_OIDC_ISSUER}/.well-known/jwks.json"
_JWKS_CACHE_TTL_SECONDS = 3600
_telegram_jwks: dict[str, object] = {}
_telegram_jwks_fetched_at = 0.0


async def verify_telegram_oauth_token(id_token: str) -> dict[str, object]:
    if not telegram.client_id:
        raise AuthConfigurationError("TELEGRAM_CLIENT_ID is not configured")

    try:
        header = jwt.get_unverified_header(id_token)
        key_id = header.get("kid")
        if not isinstance(key_id, str):
            raise InvalidTokenError("Telegram OAuth token has no key ID")

        jwks = await _get_telegram_jwks()
        keys = jwks.get("keys")
        if not isinstance(keys, list):
            raise TelegramAPIError("Invalid Telegram JWKS")
        jwk = next(
            (key for key in keys if isinstance(key, dict) and key.get("kid") == key_id),
            None,
        )
        if jwk is None:
            raise InvalidTokenError("Telegram OAuth signing key was not found")

        signing_key = RSAAlgorithm.from_jwk(json.dumps(jwk))
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256"],
            audience=telegram.client_id,
            issuer=_TELEGRAM_OIDC_ISSUER,
        )
        issued_at = claims.get("iat")
        now = int(time.time())
        if (
            not isinstance(issued_at, int)
            or issued_at > now + 30
            or now - issued_at > telegram.auth_data_max_age_seconds
        ):
            raise InvalidTokenError("Expired Telegram OAuth token")
    except PyJWTError as exc:
        raise InvalidTokenError("Invalid Telegram OAuth token") from exc

    return claims


async def _get_telegram_jwks() -> dict[str, object]:
    global _telegram_jwks, _telegram_jwks_fetched_at

    now = time.monotonic()
    if _telegram_jwks and now - _telegram_jwks_fetched_at < _JWKS_CACHE_TTL_SECONDS:
        return _telegram_jwks

    timeout = aiohttp.ClientTimeout(total=5)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as http_session:
            async with http_session.get(_TELEGRAM_JWKS_URL) as response:
                response.raise_for_status()
                jwks = await response.json()
    except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
        raise TelegramAPIError("Could not fetch Telegram signing keys") from exc

    if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
        raise TelegramAPIError("Invalid Telegram JWKS")

    _telegram_jwks = jwks
    _telegram_jwks_fetched_at = time.monotonic()
    return jwks


def verify_telegram_webapp_data(init_data: str) -> dict[str, object]:
    if telegram.bot_token is None or not telegram.bot_token.get_secret_value():
        raise AuthConfigurationError("TELEGRAM_BOT_TOKEN is not configured")

    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
        data = dict(pairs)
        if len(data) != len(pairs):
            raise InvalidTokenError("Duplicate Telegram initData fields")
        received_hash = data.pop("hash")
        auth_date = int(data["auth_date"])
        user_data = json.loads(data["user"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise InvalidTokenError("Malformed Telegram initData") from exc

    now = int(time.time())
    if auth_date > now + 30 or now - auth_date > telegram.auth_data_max_age_seconds:
        raise InvalidTokenError("Expired Telegram initData")

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(data.items()))
    secret_key = hmac.new(
        b"WebAppData",
        telegram.bot_token.get_secret_value().encode("utf-8"),
        hashlib.sha256,
    ).digest()
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(calculated_hash, received_hash):
        raise InvalidTokenError("Invalid Telegram initData signature")

    if not isinstance(user_data, dict) or not isinstance(user_data.get("id"), int):
        raise InvalidTokenError("Telegram initData has no user identity")
    return user_data

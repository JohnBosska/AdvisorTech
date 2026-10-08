import asyncio

import bcrypt

_BCRYPT_MAX_PASSWORD_BYTES = 72


def _hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if not password_bytes or len(password_bytes) > _BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError("Password must contain between 1 and 72 UTF-8 bytes")

    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("ascii")


def _verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")
    if not password_bytes or len(password_bytes) > _BCRYPT_MAX_PASSWORD_BYTES:
        return False

    try:
        return bcrypt.checkpw(password_bytes, password_hash.encode("ascii"))
    except ValueError, UnicodeEncodeError:
        return False


async def hash_password(password: str) -> str:
    # TODO: refactor
    return await asyncio.to_thread(_hash_password, password)


async def verify_password(password: str, password_hash: str) -> bool:
    # TODO: refactor
    return await asyncio.to_thread(_verify_password, password, password_hash)

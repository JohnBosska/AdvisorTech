import hashlib
import secrets


def generate_opaque_token(prefix: str) -> tuple[str, str]:
    """Return (plain token shown once, sha256 hash stored). Tokens carry 256 bits of entropy."""
    plain = f"{prefix}_{secrets.token_urlsafe(32)}"
    return plain, hash_opaque_token(plain)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

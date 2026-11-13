"""Credential encryption at rest (Fernet, key derived from CONNECTOR_SECRET)."""

import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken

from app.config.connectors import connectors
from app.exceptions import ServiceUnavailableError


def _fernet() -> Fernet:
    if not connectors.configured:
        raise ServiceUnavailableError("CONNECTOR_SECRET is not configured on the server")
    key = hashlib.sha256(connectors.secret.get_secret_value().encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def key_fingerprint() -> str:
    return hashlib.sha256(connectors.secret.get_secret_value().encode()).hexdigest()[:12]


def encrypt(data: dict) -> bytes:
    return _fernet().encrypt(json.dumps(data, ensure_ascii=False).encode())


def decrypt(blob: bytes) -> dict:
    try:
        return json.loads(_fernet().decrypt(bytes(blob)))
    except InvalidToken as exc:
        raise ServiceUnavailableError(
            "Stored credentials cannot be decrypted: CONNECTOR_SECRET changed"
        ) from exc

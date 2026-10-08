from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.config.auth import auth
from app.data_layer.alchemy.models import UserEmail
from app.resources.user import UserEntity
from app.schemas.auth import EmailVerificationPendingResponse, EmailVerificationRequest
from app.utils.auth import generate_email_code, hash_email_code


def test_email_verification_request_requires_eight_digit_code() -> None:
    payload = {
        "email": "user@example.com",
        "password": "correct-horse-battery",
        "code": "01234567",
    }
    assert EmailVerificationRequest(**payload).code == "01234567"

    with pytest.raises(ValidationError):
        EmailVerificationRequest(**(payload | {"code": "1234"}))


def test_verification_code_is_random_and_hash_is_bound_to_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth, "jwt_secret", type(auth.jwt_secret)("x" * 32))
    code = generate_email_code()
    assert len(code) == 8
    assert code.isdigit()
    assert hash_email_code("user@example.com", code) == hash_email_code("USER@example.com", code)
    assert hash_email_code("other@example.com", code) != hash_email_code("user@example.com", code)


def test_setting_code_stores_only_hash_and_enforces_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "jwt_secret", type(auth.jwt_secret)("x" * 32))
    monkeypatch.setattr(auth, "email_verification_ttl_seconds", 600)
    identity = UserEmail(email="user@example.com", password_hash="password-hash")

    UserEntity._set_email_code(identity, "01234567")

    assert identity.verification_code_hash == hash_email_code(identity.email, "01234567")
    assert identity.verification_code_hash != "01234567"
    assert identity.verification_expires_at is not None
    assert identity.verification_expires_at > datetime.now(timezone.utc) + timedelta(minutes=9)
    assert identity.verification_attempts == 0


def test_pending_registration_response_does_not_contain_access_token() -> None:
    response = EmailVerificationPendingResponse()
    assert response.model_dump() == {"detail": "Email verification required"}
    assert "access_token" not in EmailVerificationPendingResponse.model_fields

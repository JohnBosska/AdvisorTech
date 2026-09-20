from uuid import uuid4

from fastapi import APIRouter

from app import schemas

router = APIRouter(prefix="/api/v1/auth", tags=["Auth (после MVP)"])


@router.post("/telegram", response_model=schemas.AuthResponse)
def auth_via_telegram(payload: schemas.AuthTelegramRequest):
    """Авторизация через Telegram WebApp initData."""
    return schemas.AuthResponse(access_token=f"stub-token-{uuid4().hex}", guest_id=uuid4())


@router.post("/phone/request-code", status_code=202)
def request_phone_code(payload: schemas.AuthPhoneRequestCode):
    """Отправить код подтверждения на номер телефона (SMS)."""
    return {"status": "code_sent"}


@router.post("/phone/verify", response_model=schemas.AuthResponse)
def verify_phone_code(payload: schemas.AuthPhoneVerify):
    """Подтвердить код и авторизовать по номеру телефона."""
    return schemas.AuthResponse(access_token=f"stub-token-{uuid4().hex}", guest_id=uuid4())

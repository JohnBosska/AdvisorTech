from fastapi import APIRouter

from app import schemas

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.post("/pwa/subscribe", status_code=201)
def subscribe_pwa_push(payload: schemas.PwaPushSubscribeRequest):
    """Зарегистрировать push-подписку PWA-клиента (Web Push API)."""
    return {"status": "subscribed"}

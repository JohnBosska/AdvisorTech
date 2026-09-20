from fastapi import APIRouter, Depends

from app import schemas
from app.security import require_admin

router = APIRouter(
    prefix="/api/v1/admin/notifications",
    tags=["Admin · Notifications"],
    dependencies=[Depends(require_admin)],
)


@router.post("/send", response_model=schemas.NotificationSendResponse, status_code=202)
def send_notification(payload: schemas.NotificationSendRequest):
    """Отправить рассылку.

    - telegram/max: сообщение с редиректом на WebApp (redirect_url).
    - pwa_push: push-уведомление подписанному PWA-клиенту.
    """
    return schemas.NotificationSendResponse()

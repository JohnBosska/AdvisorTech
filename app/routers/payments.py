from uuid import UUID

from fastapi import APIRouter, HTTPException

from app import schemas, storage

router = APIRouter(prefix="/api/v1/payments", tags=["Payments (ЮKassa)"])


@router.post("", response_model=schemas.Payment, status_code=201)
def create_payment(payload: schemas.PaymentCreate):
    """Создать платёж в ЮKassa для брони и вернуть ссылку на форму оплаты."""
    if payload.booking_id not in storage.bookings:
        raise HTTPException(status_code=404, detail="Booking not found")

    payment = schemas.Payment(
        booking_id=payload.booking_id,
        amount=payload.amount,
        currency=payload.currency,
        confirmation_url=f"https://yookassa.ru/pay/stub-{payload.booking_id}",
    )
    storage.payments[payment.id] = payment.model_dump()
    return payment


@router.get("/{payment_id}", response_model=schemas.Payment)
def get_payment(payment_id: UUID):
    payment = storage.payments.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/webhook/yookassa", status_code=200)
def yookassa_webhook(event: schemas.YooKassaWebhookEvent):
    """Приём webhook-уведомлений об изменении статуса платежа от ЮKassa."""
    payment_id = event.object.get("id")
    if payment_id and payment_id in storage.payments:
        storage.payments[payment_id]["status"] = event.object.get("status", "pending")
    return {"received": True}

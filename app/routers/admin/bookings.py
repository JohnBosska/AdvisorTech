from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app import schemas, storage
from app.security import require_admin

router = APIRouter(
    prefix="/api/v1/admin/bookings",
    tags=["Admin · Bookings"],
    dependencies=[Depends(require_admin)],
)


@router.patch("/{booking_id}/status", response_model=schemas.Booking)
def set_booking_status(booking_id: UUID, payload: schemas.BookingStatusUpdate):
    """Персонал подтверждает / закрывает / отменяет запись клиента."""
    booking = storage.bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking["status"] = payload.status
    storage.bookings[booking_id] = booking
    return booking

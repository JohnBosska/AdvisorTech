from uuid import UUID

from fastapi import APIRouter, HTTPException

from app import schemas, storage

router = APIRouter(prefix="/api/v1/bookings", tags=["Bookings"])


@router.post("", response_model=schemas.Booking, status_code=201)
def create_booking(payload: schemas.BookingCreate):
    """Создать запись на услугу через лендинг или WebApp (Telegram/Max)."""
    if payload.service_id not in storage.services:
        raise HTTPException(status_code=404, detail="Service not found")
    if payload.place_id not in storage.places:
        raise HTTPException(status_code=404, detail="Place not found")

    booking = schemas.Booking(
        service_id=payload.service_id,
        place_id=payload.place_id,
        channel=payload.channel,
        scheduled_at=payload.scheduled_at,
    )
    storage.bookings[booking.id] = booking.model_dump()
    return booking


@router.get("", response_model=list[schemas.Booking])
def list_bookings(guest_id: UUID | None = None, status: schemas.BookingStatus | None = None):
    result = list(storage.bookings.values())
    if guest_id:
        result = [b for b in result if b.get("guest_id") == guest_id]
    if status:
        result = [b for b in result if b.get("status") == status]
    return result


@router.get("/{booking_id}", response_model=schemas.Booking)
def get_booking(booking_id: UUID):
    booking = storage.bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.patch("/{booking_id}/reschedule", response_model=schemas.Booking)
def reschedule_booking(booking_id: UUID, payload: schemas.BookingReschedule):
    """Клиент переносит собственную запись на другое время."""
    booking = storage.bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking["scheduled_at"] = payload.scheduled_at
    storage.bookings[booking_id] = booking
    return booking


@router.delete("/{booking_id}", status_code=204)
def cancel_booking(booking_id: UUID):
    """Клиент отменяет собственную запись."""
    booking = storage.bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking["status"] = schemas.BookingStatus.cancelled
    storage.bookings[booking_id] = booking

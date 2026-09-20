from uuid import UUID

from fastapi import APIRouter, HTTPException

from app import schemas, storage

router = APIRouter(prefix="/api/v1/guests", tags=["Guests (после MVP)"])


@router.get("/{guest_id}", response_model=schemas.Guest)
def get_guest(guest_id: UUID):
    guest = storage.guests.get(guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return guest


@router.get("/{guest_id}/history", response_model=list[schemas.GuestHistoryItem])
def get_guest_history(guest_id: UUID):
    """Карта гостя: какие услуги (стрижки, коктейли и т.д.) заказывал ранее."""
    if guest_id not in storage.guests:
        raise HTTPException(status_code=404, detail="Guest not found")
    # Заглушка: интеграция с картой гостя появится после MVP.
    return []

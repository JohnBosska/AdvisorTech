from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# --- Enums ---------------------------------------------------------------

class BookingChannel(str, Enum):
    landing = "landing"
    telegram_webapp = "telegram_webapp"
    max_webapp = "max_webapp"


class BookingStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class NotificationChannel(str, Enum):
    telegram = "telegram"
    max = "max"
    pwa_push = "pwa_push"


class PaymentStatus(str, Enum):
    pending = "pending"
    succeeded = "succeeded"
    canceled = "canceled"


# --- Catalog ---------------------------------------------------------------

class Location(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(examples=["Барбершоп на Тверской"])
    address: str = Field(examples=["Москва, ул. Тверская, 1"])
    city: str | None = Field(default=None, examples=["Москва"])


class LocationCreate(BaseModel):
    name: str
    address: str
    city: str | None = None


class Service(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    location_id: UUID
    name: str = Field(examples=["Стрижка машинкой"])
    description: str | None = None
    price: float = Field(examples=[1500])
    duration_minutes: int = Field(examples=[40])


class ServiceCreate(BaseModel):
    location_id: UUID
    name: str
    description: str | None = None
    price: float
    duration_minutes: int


class Place(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(examples=["Кресло №2"])
    description: str | None = None
    capacity: int = Field(default=1, ge=1)


class PlaceCreate(BaseModel):
    name: str
    description: str | None = None
    capacity: int = 1


# --- Guests / карта гостя (после MVP) --------------------------------------

class Guest(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str | None = None
    phone: str | None = None
    telegram_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GuestHistoryItem(BaseModel):
    service_id: UUID
    service_name: str
    visited_at: datetime
    price: float


# --- Auth (после MVP) -------------------------------------------------------

class AuthTelegramRequest(BaseModel):
    init_data: str = Field(description="Telegram WebApp initData string")


class AuthPhoneRequestCode(BaseModel):
    phone: str = Field(examples=["+79991234567"])


class AuthPhoneVerify(BaseModel):
    phone: str
    code: str = Field(examples=["1234"])


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    guest_id: UUID


# --- Bookings ----------------------------------------------------------------

class BookingCreate(BaseModel):
    service_id: UUID
    place_id: UUID
    channel: BookingChannel
    scheduled_at: datetime
    guest_phone: str | None = Field(default=None, examples=["+79991234567"])
    guest_telegram_id: str | None = None


class BookingReschedule(BaseModel):
    scheduled_at: datetime


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


class Booking(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    guest_id: UUID | None = None
    service_id: UUID
    place_id: UUID
    channel: BookingChannel
    scheduled_at: datetime
    status: BookingStatus = BookingStatus.pending
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- Payments (ЮKassa) ------------------------------------------------------

class PaymentCreate(BaseModel):
    booking_id: UUID
    amount: float
    currency: str = "RUB"


class Payment(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    booking_id: UUID
    amount: float
    currency: str = "RUB"
    status: PaymentStatus = PaymentStatus.pending
    confirmation_url: str | None = Field(
        default=None, description="Ссылка на форму оплаты ЮKassa"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class YooKassaWebhookEvent(BaseModel):
    event: str = Field(examples=["payment.succeeded"])
    object: dict


# --- Notifications -----------------------------------------------------------

class NotificationSendRequest(BaseModel):
    guest_id: UUID
    channel: NotificationChannel
    message: str
    redirect_url: str | None = Field(
        default=None,
        description="Для telegram/max: ссылка-редирект на WebApp внутри сообщения",
    )


class NotificationSendResponse(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    status: str = "queued"


class PwaPushSubscribeRequest(BaseModel):
    guest_id: UUID
    endpoint: str
    keys: dict = Field(examples=[{"p256dh": "...", "auth": "..."}])


# --- Statistics ---------------------------------------------------------------

class PopularService(BaseModel):
    service_id: UUID
    service_name: str
    order_count: int


class UserStats(BaseModel):
    guest_id: UUID
    total_bookings: int
    favorite_services: list[str]
    total_spent: float


# --- 1С интеграция -------------------------------------------------------------

class OneCOrderExport(BaseModel):
    order_id: UUID = Field(default_factory=uuid4)
    booking_id: UUID
    amount: float
    status: PaymentStatus
    created_at: datetime


class OneCSyncResponse(BaseModel):
    synced_count: int
    synced_at: datetime = Field(default_factory=datetime.utcnow)

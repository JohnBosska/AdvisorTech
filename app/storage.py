"""In-memory хранилище для демонстрации API через Swagger.

Не для продакшена — заменяется на реальную БД при разработке.
"""
from uuid import UUID

locations: dict[UUID, dict] = {}
services: dict[UUID, dict] = {}
places: dict[UUID, dict] = {}
guests: dict[UUID, dict] = {}
bookings: dict[UUID, dict] = {}
payments: dict[UUID, dict] = {}

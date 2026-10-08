from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

from app.config.logging import configure_logging
from app.data_layer.alchemy.api_db import engine
from app.middleware import RequestContextMiddleware
from app.routers import auth, bookings, catalog, guests, notifications, payments
from app.routers.admin import bookings as admin_bookings
from app.routers.admin import catalog as admin_catalog
from app.routers.admin import integration_1c as admin_integration_1c
from app.routers.admin import notifications as admin_notifications
from app.routers.admin import stats as admin_stats

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await engine.dispose()


tags_metadata = [
    {"name": "Catalog", "description": "Просмотр локаций, услуг и мест (кресла/зоны) — доступно клиенту."},
    {"name": "Bookings", "description": "Клиент создаёт, переносит и отменяет свою запись через лендинг/WebApp."},
    {"name": "Guests (после MVP)", "description": "Карта гостя — история заказанных услуг."},
    {"name": "Auth (после MVP)", "description": "Авторизация через Telegram или номер телефона."},
    {"name": "Payments (ЮKassa)", "description": "Оплата бронирования клиентом через ЮKassa."},
    {
        "name": "Notifications",
        "description": "Клиент подписывается на push-уведомления в PWA.",
    },
    {
        "name": "Admin · Catalog",
        "description": "Управление каталогом: локации, услуги, места. Требует X-Admin-Api-Key.",
    },
    {
        "name": "Admin · Bookings",
        "description": "Подтверждение/отмена/завершение записей персоналом. Требует X-Admin-Api-Key.",
    },
    {
        "name": "Admin · Notifications",
        "description": "Ручные рассылки: сообщения с редиректом на WebApp (Telegram/Max) и PWA push. Требует X-Admin-Api-Key.",
    },
    {
        "name": "Admin · Statistics",
        "description": "Статистика по пользователям и популярным услугам. Требует X-Admin-Api-Key.",
    },
    {
        "name": "Admin · 1C Integration (после MVP)",
        "description": "Агрегация заказов и синхронизация с 1С через API 1С. Требует X-Admin-Api-Key.",
    },
]

app = FastAPI(
    title="Salon Booking API",
    description=(
        "API онлайн-записи и учёта заказов для салона/барбершопа: бронирование, "
        "оплата (ЮKassa), рассылки (Telegram/Max WebApp, PWA push), статистика "
        "и интеграция с 1С. Монолит на Python, взаимодействие компонентов через API.\n\n"
        "Права разделены на клиентские (без авторизации в MVP) и админские "
        "(`/api/v1/admin/...`, требуют заголовок `X-Admin-Api-Key`)."
    ),
    version="0.2.0",
    openapi_tags=tags_metadata,
    docs_url=None,
    lifespan=lifespan,
)
app.add_middleware(RequestContextMiddleware)

# Swagger UI по умолчанию не задаёт фон страницы, поэтому в браузере с тёмной
# системной темой просвечивает тёмный фон окна. Явно закрепляем светлую тему.
_LIGHT_THEME_OVERRIDE = """
<style>
  :root { color-scheme: light; }
  html, body { background: #ffffff !important; }
</style>
"""


@app.get("/docs", include_in_schema=False)
def custom_swagger_ui_html():
    response = get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Swagger UI",
    )
    html = response.body.decode()
    html = html.replace("</head>", _LIGHT_THEME_OVERRIDE + "</head>")
    return HTMLResponse(html)


# Клиентские роуты
app.include_router(catalog.router)
app.include_router(bookings.router)
app.include_router(guests.router)
app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(notifications.router)

# Админские роуты (/api/v1/admin/...)
app.include_router(admin_catalog.router)
app.include_router(admin_bookings.router)
app.include_router(admin_notifications.router)
app.include_router(admin_stats.router)
app.include_router(admin_integration_1c.router)


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}

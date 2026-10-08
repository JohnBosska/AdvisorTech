from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse

from app.config.logging import configure_logging
from app.data_layer.alchemy.api_db import engine
from app.middleware import RequestContextMiddleware


configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await engine.dispose()


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
    lifespan=lifespan,
)
app.add_middleware(RequestContextMiddleware)


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}

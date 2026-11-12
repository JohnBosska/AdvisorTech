import argparse
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.config.logging import configure_logging
from app.data_layer.alchemy.api_db import engine
from app.exception_handlers import (
    handle_api_error,
    handle_auth_configuration_error,
    handle_unexpected_error,
    handle_validation_error,
)
from app.exceptions import APIError, AuthConfigurationError
from app.middleware import RequestContextMiddleware
from app.routers.agent import router as agent_router
from app.routers.auth import router as auth_router
from app.routers.bi_reports import router as bi_reports_router
from app.routers.knowledge import router as knowledge_router
from app.routers.organizations import router as organizations_router
from app.routers.reports import router as reports_router
from app.routers.warehouse import router as warehouse_router

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(
    title="Tech Adviser API",
    version="0.5.0",
    lifespan=lifespan,
    exception_handlers={
        APIError: handle_api_error,
        AuthConfigurationError: handle_auth_configuration_error,
        RequestValidationError: handle_validation_error,
        Exception: handle_unexpected_error,
    },
)
app.add_middleware(RequestContextMiddleware)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")
app.include_router(organizations_router, prefix="/api/v1")
app.include_router(knowledge_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(bi_reports_router, prefix="/api/v1")
app.include_router(warehouse_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Tech Adviser API")
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=os.getenv("PORT", "8000"))
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()

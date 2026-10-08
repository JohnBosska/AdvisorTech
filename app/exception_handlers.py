import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.exceptions import APIError, AuthConfigurationError

logger = logging.getLogger(__name__)


async def handle_api_error(_: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


async def handle_auth_configuration_error(
    _: Request,
    exc: AuthConfigurationError,
) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": "Authentication is not configured"})


async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default response includes input values, including passwords and tokens.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {"loc": error["loc"], "type": error["type"], "msg": "Invalid value"}
                for error in exc.errors()
            ]
        },
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.error("Unhandled request error", exc_info=exc, extra={"request_id": request_id})
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"X-Request-ID": request_id} if request_id else None,
    )

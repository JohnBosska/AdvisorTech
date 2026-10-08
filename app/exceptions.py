class APIError(Exception):
    status_code = 500

    def __init__(self, detail: str, *, headers: dict[str, str] | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.headers = headers


class UnauthorizedError(APIError):
    status_code = 401

    def __init__(self, detail: str) -> None:
        super().__init__(detail, headers={"WWW-Authenticate": "Bearer"})


class ObjectNotFoundError(APIError):
    status_code = 404


class ConflictError(APIError):
    status_code = 409


class ServiceUnavailableError(APIError):
    status_code = 503


class InvalidTokenError(ValueError):
    """The supplied authentication token is invalid."""


class AuthConfigurationError(RuntimeError):
    """Authentication settings are missing or invalid."""


class TelegramAPIError(Exception):
    """Telegram signing keys could not be retrieved."""


class EmailConfigurationError(RuntimeError):
    """Email settings are incomplete."""


class BadRequestError(APIError):
    status_code = 400


class ForbiddenError(APIError):
    status_code = 403


class TooManyRequestsError(APIError):
    status_code = 429


class EmailDeliveryError(Exception):
    """The email workflow could not be scheduled."""

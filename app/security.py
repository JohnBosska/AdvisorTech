import os

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "admin-secret-key")

admin_api_key_header = APIKeyHeader(name="X-Admin-Api-Key", auto_error=False)


def require_admin(api_key: str | None = Security(admin_api_key_header)) -> None:
    """Доступ только для админа: заголовок X-Admin-Api-Key."""
    if api_key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required (X-Admin-Api-Key)",
        )

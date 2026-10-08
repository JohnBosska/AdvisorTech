from email.message import EmailMessage

import aiosmtplib

from app.config.email import email as settings
from app.exceptions import EmailConfigurationError
from app.schemas.email import EmailPayload


async def send_email(payload: EmailPayload) -> None:
    if not settings.host or not settings.sender:
        raise EmailConfigurationError("EMAIL_HOST and EMAIL_SENDER must be configured")

    message = EmailMessage()
    message["From"] = settings.sender
    message["To"] = payload.recipient
    message["Subject"] = payload.subject
    message.set_content(payload.text_body)

    await aiosmtplib.send(
        message,
        hostname=settings.host,
        port=settings.port,
        username=settings.username or None,
        password=(
            settings.password.get_secret_value() or None if settings.password is not None else None
        ),
        start_tls=settings.start_tls,
        use_tls=settings.use_tls,
    )

from temporalio import activity

from app.schemas.email import EmailPayload
from app.services import email


@activity.defn(name="send_email")
async def send_email(payload: EmailPayload) -> None:
    await email.send_email(payload)

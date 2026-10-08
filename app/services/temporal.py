import asyncio
from datetime import timedelta
from uuid import uuid4

from temporalio.client import Client
from temporalio.service import RPCError

from app.config.temporal import temporal
from app.exceptions import EmailDeliveryError
from app.schemas.email import EmailPayload
from app.temporal.workflows.email import SendEmailWorkflow


async def schedule_email(payload: EmailPayload) -> None:
    try:
        async with asyncio.timeout(15):
            client = await Client.connect(temporal.address, namespace=temporal.namespace)
            await client.start_workflow(
                SendEmailWorkflow.run,
                payload,
                id=f"email-{uuid4()}",
                task_queue=temporal.task_queue,
                rpc_timeout=timedelta(seconds=10),
            )
    except (RPCError, RuntimeError, TimeoutError, OSError) as exc:
        raise EmailDeliveryError("Could not schedule email") from exc

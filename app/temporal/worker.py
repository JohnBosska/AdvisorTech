from temporalio.client import Client
from temporalio.worker import Worker

from app.config.temporal import temporal
from app.temporal.activities.connectors import run_connector_sync
from app.temporal.activities.email import send_email
from app.temporal.workflows.connectors import ConnectorSyncWorkflow
from app.temporal.workflows.email import SendEmailWorkflow


async def run_worker() -> None:
    client = await Client.connect(
        temporal.address,
        namespace=temporal.namespace,
    )
    worker = Worker(
        client,
        task_queue=temporal.task_queue,
        workflows=[SendEmailWorkflow, ConnectorSyncWorkflow],
        activities=[send_email, run_connector_sync],
    )
    await worker.run()

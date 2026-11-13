import asyncio
from datetime import timedelta
from uuid import uuid4

from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleIntervalSpec,
    ScheduleSpec,
    ScheduleUpdate,
    ScheduleUpdateInput,
)
from temporalio.service import RPCError

from app.config.temporal import temporal
from app.data_layer.alchemy.models import SyncRun
from app.exceptions import EmailDeliveryError, ServiceUnavailableError
from app.schemas.email import EmailPayload
from app.schemas.sync import SyncJob
from app.temporal.workflows.connectors import ConnectorSyncWorkflow
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


async def _client() -> Client:
    async with asyncio.timeout(15):
        return await Client.connect(temporal.address, namespace=temporal.namespace)


async def start_sync_workflow(run_id: int, organization_id: int, connection_id: int) -> None:
    """Runs a queued sync in the worker. Monkeypatched in tests to run inline."""
    try:
        client = await _client()
        await client.start_workflow(
            ConnectorSyncWorkflow.run,
            SyncJob(run_id=run_id, organization_id=organization_id, connection_id=connection_id),
            id=f"sync-run-{run_id}",
            task_queue=temporal.task_queue,
            rpc_timeout=timedelta(seconds=10),
        )
    except (RPCError, RuntimeError, TimeoutError, OSError) as exc:
        raise ServiceUnavailableError("Фоновый обработчик недоступен: попробуйте позже") from exc


async def upsert_sync_schedule(
    connection_id: int, organization_id: int, minutes: int | None
) -> None:
    """Creates, updates or removes the periodic incremental sync of a connection."""
    schedule_id = f"sync-schedule-{connection_id}"
    try:
        client = await _client()
        handle = client.get_schedule_handle(schedule_id)
        if minutes is None:
            try:
                await handle.delete()
            except RPCError:
                pass
            return
        action = ScheduleActionStartWorkflow(
            ConnectorSyncWorkflow.run,
            SyncJob(
                run_id=None,
                organization_id=organization_id,
                connection_id=connection_id,
                mode=SyncRun.ModeEnum.INCREMENTAL.value,
            ),
            id=f"sync-scheduled-{connection_id}",
            task_queue=temporal.task_queue,
        )
        spec = ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=minutes))])
        try:
            await client.create_schedule(schedule_id, Schedule(action=action, spec=spec))
        except RPCError:  # already exists: update in place

            async def _update(_: ScheduleUpdateInput) -> ScheduleUpdate:
                return ScheduleUpdate(schedule=Schedule(action=action, spec=spec))

            await handle.update(_update)
    except (RPCError, RuntimeError, TimeoutError, OSError) as exc:
        raise ServiceUnavailableError(
            "Фоновый обработчик недоступен: расписание не сохранено"
        ) from exc

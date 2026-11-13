from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.schemas.sync import SyncJob


@workflow.defn(name="connector-sync")
class ConnectorSyncWorkflow:
    @workflow.run
    async def run(self, job: SyncJob) -> dict:
        return await workflow.execute_activity(
            "run_connector_sync",
            job,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=RetryPolicy(maximum_attempts=1),  # the run itself records failure
        )

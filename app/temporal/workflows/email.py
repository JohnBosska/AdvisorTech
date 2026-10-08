from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.schemas.email import EmailPayload


@workflow.defn(name="send-email")
class SendEmailWorkflow:
    @workflow.run
    async def run(self, payload: EmailPayload) -> None:
        await workflow.execute_activity(
            "send_email",
            payload,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=5),
        )

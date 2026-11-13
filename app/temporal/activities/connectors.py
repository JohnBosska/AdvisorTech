from temporalio import activity

from app.data_layer.alchemy.models import SyncRun
from app.resources.connectors import Connectors
from app.schemas.sync import SyncJob


@activity.defn(name="run_connector_sync")
async def run_connector_sync(job: SyncJob) -> dict:
    run_id = job.run_id
    if run_id is None:  # scheduled run: create the run first (skips if one is active)
        try:
            run_id = (
                await Connectors.enqueue(
                    job.organization_id, job.connection_id, SyncRun.ModeEnum(job.mode)
                )
            ).id
        except Exception as exc:  # another run active or connector unconfigured
            return {"skipped": True, "reason": str(exc)[:200]}
    return await Connectors.run_sync(run_id, job.organization_id, job.connection_id)

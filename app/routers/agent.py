"""Connector Agent API. Authenticated by an agent token, not by a user; read-only toward 1C."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies.agent import AgentContext, get_agent
from app.resources.agent import AgentSync
from app.schemas.agent import (
    BatchRequest,
    BatchResponse,
    FinishRequest,
    HeartbeatRequest,
    HeartbeatResponse,
    PendingSyncRun,
)

router = APIRouter(prefix="/agent", tags=["Connector Agent"])
AgentDep = Annotated[AgentContext, Depends(get_agent)]


@router.post("/heartbeat", response_model=HeartbeatResponse)
async def heartbeat(payload: HeartbeatRequest, agent: AgentDep) -> HeartbeatResponse:
    await AgentSync.heartbeat(agent, payload)
    return HeartbeatResponse(connection_id=agent.connection_id)


@router.get("/sync-runs/pending", response_model=list[PendingSyncRun])
async def pending_sync_runs(agent: AgentDep):
    return [PendingSyncRun(id=r.id, mode=r.mode) for r in await AgentSync.pending(agent)]


@router.post("/sync-runs/{run_id}/start", status_code=204)
async def start_sync_run(run_id: int, agent: AgentDep) -> None:
    await AgentSync.start(agent, run_id)


@router.post("/sync-runs/{run_id}/batches", response_model=BatchResponse)
async def add_batch(run_id: int, payload: BatchRequest, agent: AgentDep) -> BatchResponse:
    sequence, duplicate = await AgentSync.add_batch(agent, run_id, payload)
    return BatchResponse(sequence=sequence, duplicate=duplicate)


@router.post("/sync-runs/{run_id}/finish", status_code=204)
async def finish_sync_run(run_id: int, payload: FinishRequest, agent: AgentDep) -> None:
    await AgentSync.finish(agent, run_id, payload)

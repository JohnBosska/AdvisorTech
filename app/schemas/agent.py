from typing import Self

from pydantic import BaseModel, Field, model_validator

from app.data_layer.alchemy.models import SyncRun


class HeartbeatRequest(BaseModel):
    agent_version: str | None = Field(default=None, max_length=32)
    enabled_entities: list[str] | None = Field(default=None, max_length=200)


class HeartbeatResponse(BaseModel):
    connection_id: int
    read_only: bool = True


class PendingSyncRun(BaseModel):
    id: int
    mode: SyncRun.ModeEnum


class BatchRequest(BaseModel):
    sequence: int = Field(ge=1)
    entity: str = Field(min_length=1, max_length=64)
    checksum: str | None = Field(default=None, max_length=64)
    records_received: int = Field(ge=0)
    records_accepted: int = Field(ge=0)
    records_rejected: int = Field(default=0, ge=0)
    records_quarantined: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def counters_must_add_up(self) -> Self:
        outcome = self.records_accepted + self.records_rejected + self.records_quarantined
        if outcome != self.records_received:
            raise ValueError("accepted + rejected + quarantined must equal received")
        return self


class BatchResponse(BaseModel):
    sequence: int
    duplicate: bool


class FinishRequest(BaseModel):
    status: SyncRun.StatusEnum
    error_summary: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def only_final_status(self) -> Self:
        if self.status not in {SyncRun.StatusEnum.SUCCEEDED, SyncRun.StatusEnum.FAILED}:
            raise ValueError("status must be SUCCEEDED or FAILED")
        return self

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.data_layer.alchemy.models import SourceConnection, SyncRun


class SourceConnectionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    configuration: SourceConnection.ConfigurationEnum
    configuration_version: str | None = Field(default=None, max_length=32)
    source_dbms: SourceConnection.DbmsEnum
    transport: SourceConnection.TransportEnum


class SourceConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    configuration: SourceConnection.ConfigurationEnum
    configuration_version: str | None
    source_dbms: SourceConnection.DbmsEnum
    transport: SourceConnection.TransportEnum
    status: SourceConnection.StatusEnum
    enabled_entities: list[str]
    connector_kind: str | None = None
    entity_config: dict = {}
    schedule_minutes: int | None = None
    last_successful_sync_at: datetime | None
    read_only: bool = True


class SyncRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mode: SyncRun.ModeEnum
    status: SyncRun.StatusEnum
    started_at: datetime | None
    finished_at: datetime | None
    records_received: int
    records_accepted: int
    records_rejected: int
    records_quarantined: int
    error_summary: str | None


class AgentCredentialIssuedResponse(BaseModel):
    """The token is shown once; only its hash is stored."""

    connection_id: int
    token: str


class SyncRunCreateRequest(BaseModel):
    mode: SyncRun.ModeEnum = SyncRun.ModeEnum.INCREMENTAL

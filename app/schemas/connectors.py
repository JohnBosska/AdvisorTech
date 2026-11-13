from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.reports import ODataSource, PostgresSource

ConnectorKind = Literal["postgres", "onec_odata"]


class CredentialsRequest(BaseModel):
    kind: ConnectorKind
    postgres: PostgresSource | None = None
    onec: ODataSource | None = None


class CredentialsStatus(BaseModel):
    kind: str | None
    configured: bool
    target: str | None  # host/db or URL, never secrets


class EntityConfig(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    cursor: str | None = Field(default=None, max_length=120)


class EntitiesRequest(BaseModel):
    entities: dict[str, EntityConfig] = Field(max_length=200)
    schedule_minutes: int | None = Field(default=None, ge=5, le=10080)

    @field_validator("entities")
    @classmethod
    def names(cls, value: dict[str, EntityConfig]) -> dict[str, EntityConfig]:
        for name in value:
            if not name or len(name) > 64:
                raise ValueError("entity names must be 1..64 characters")
        return value


class TableResponse(BaseModel):
    name: str
    label: str
    rows: int | None


class ColumnResponse(BaseModel):
    name: str
    type: str


class CursorResponse(BaseModel):
    entity: str
    cursor_value: str | None

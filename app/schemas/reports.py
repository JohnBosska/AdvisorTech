from typing import Literal

from pydantic import BaseModel, Field, field_validator

ColumnType = Literal["number", "text", "date"]
WidgetType = Literal["kpi", "bar", "line", "pie", "table"]
Aggregation = Literal["sum", "avg", "count", "min", "max"]


class DatasetColumn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: ColumnType
    samples: list[str] = Field(default_factory=list, max_length=5)


class DatasetResponse(BaseModel):
    filename: str
    columns: list[DatasetColumn]
    rows: list[dict[str, str | float | None]]
    total_rows: int | None  # None: source has more rows than were read
    truncated: bool


class Widget(BaseModel):
    type: WidgetType
    title: str = Field(min_length=1, max_length=120)
    x: str | None = None  # grouping column (bar/line/pie/table)
    y: str | None = None  # measure column; optional only for count
    agg: Aggregation = "sum"
    limit: int = Field(default=12, ge=1, le=50)


class ReportSpec(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    widgets: list[Widget] = Field(min_length=1, max_length=6)


class ReportPlanRequest(BaseModel):
    request: str = Field(min_length=3, max_length=1000)
    columns: list[DatasetColumn] = Field(min_length=1, max_length=60)

    @field_validator("request")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class ReportPlanResponse(ReportSpec):
    model: str
    dropped: int = 0  # widgets the model proposed that failed validation


class PostgresSource(BaseModel):
    host: str = Field(min_length=1, max_length=253)
    port: int = Field(default=5432, ge=1, le=65535)
    database: str = Field(min_length=1, max_length=63)
    user: str = Field(min_length=1, max_length=63)
    password: str = Field(default="", max_length=256)
    ssl: bool = True


class ODataSource(BaseModel):
    url: str = Field(min_length=8, max_length=500, pattern=r"^https?://")
    user: str = Field(default="", max_length=120)
    password: str = Field(default="", max_length=256)


class SourceTablesRequest(BaseModel):
    kind: Literal["postgres", "onec"]
    postgres: PostgresSource | None = None
    onec: ODataSource | None = None


class SourceTable(BaseModel):
    name: str
    label: str
    rows: int | None = None


class SourceLoadRequest(SourceTablesRequest):
    table: str = Field(min_length=1, max_length=300)


class UrlSourceRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2000, pattern=r"^https?://")

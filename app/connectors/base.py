"""Server-side connector interface. Every implementation is read-only and reads in pages."""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol
from uuid import UUID


@dataclass
class TableInfo:
    name: str
    label: str
    rows: int | None = None


@dataclass
class ColumnInfo:
    name: str
    type: str  # 'number' | 'date' | 'text'


@dataclass
class Page:
    records: list[dict[str, Any]] = field(default_factory=list)
    next_cursor: str | None = None  # value to persist after this page


class Connector(Protocol):
    kind: str

    async def test(self) -> None: ...
    async def discover(self) -> list[TableInfo]: ...
    async def columns(self, table: str) -> list[ColumnInfo]: ...
    async def extract(
        self,
        table: str,
        key: str,
        cursor: str | None,
        after: str | None,
        offset: int,
        limit: int,
    ) -> Page: ...


def jsonable(value: Any) -> Any:
    """Source values → JSON-storable values (JSONB payloads must round-trip)."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return (
            value.date().isoformat() if value.time() == datetime.min.time() else value.isoformat()
        )
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "0x" + bytes(value)[:16].hex()
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return str(value)


def cursor_text(value: Any) -> str | None:
    if value is None:
        return None
    v = jsonable(value)
    return v if isinstance(v, str) else str(v)

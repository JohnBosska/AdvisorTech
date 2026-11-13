"""1C standard OData interface as a connector: discover objects, read in pages, incremental by a
cursor field (for example a date or a version counter). Key defaults to Ref_Key."""

import re
from urllib.parse import quote

from app.connectors.base import ColumnInfo, Page, TableInfo, jsonable
from app.exceptions import BadRequestError
from app.schemas.reports import ODataSource
from app.services.bi_sources import _ODATA_NAME, _odata_base, _odata_get, onec_tables

_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$")
_NUMBER = re.compile(r"^-?\d+(\.\d+)?$")
_FIELD = re.compile(r"^[A-Za-zА-Яа-яЁё0-9_]+$")


def _literal(value: str) -> str:
    if _DATETIME.match(value):
        return f"datetime'{value if 'T' in value else value + 'T00:00:00'}'"
    if _NUMBER.match(value):
        return value
    return "'" + value.replace("'", "''") + "'"


def _kind(value) -> str:
    if isinstance(value, bool):
        return "text"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str) and _DATETIME.match(value[:19]):
        return "date"
    return "text"


class OneCODataConnector:
    kind = "onec_odata"

    def __init__(self, creds: dict) -> None:
        self.source = ODataSource.model_validate(creds)

    async def test(self) -> None:
        await _odata_get(self.source, f"{_odata_base(self.source)}?$format=json")

    async def discover(self) -> list[TableInfo]:
        return [TableInfo(**t) for t in await onec_tables(self.source)]

    async def columns(self, table: str) -> list[ColumnInfo]:
        page = await self.extract(table, "Ref_Key", None, None, 0, 1)
        if not page.records:
            raise BadRequestError("В объекте 1С нет записей")
        return [ColumnInfo(name=k, type=_kind(v)) for k, v in page.records[0].items()]

    async def extract(
        self, table: str, key: str, cursor: str | None, after: str | None, offset: int, limit: int
    ) -> Page:
        if (
            not _ODATA_NAME.match(table)
            or not _FIELD.match(key)
            or (cursor and not _FIELD.match(cursor))
        ):
            raise BadRequestError("Некорректное имя объекта или поля 1С")
        params = ["$format=json", f"$top={int(limit)}"]
        if cursor:
            params.append(f"$orderby={quote(cursor)}")
            if after is not None:
                literal = quote(_literal(after), safe="'")
                params.append(f"$filter={quote(cursor)} gt {literal}")
        if offset:
            params.append(f"$skip={int(offset)}")
        url = f"{_odata_base(self.source)}/{quote(table)}?{'&'.join(params)}"
        data = await _odata_get(self.source, url)
        raw = [r for r in data.get("value", []) if isinstance(r, dict)]
        records = [
            {
                k: jsonable(v)
                for k, v in r.items()
                if "@" not in k and not isinstance(v, (dict, list))
            }
            for r in raw
        ]
        nxt = (
            str(raw[-1].get(cursor)) if cursor and raw and raw[-1].get(cursor) is not None else None
        )
        return Page(records=records, next_cursor=nxt)

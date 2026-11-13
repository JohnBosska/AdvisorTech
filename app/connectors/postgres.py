"""PostgreSQL connector: catalogue-validated identifiers, READ ONLY, keyset-paged extraction."""

import asyncpg

from app.connectors.base import ColumnInfo, Page, TableInfo, cursor_text, jsonable
from app.exceptions import BadRequestError
from app.schemas.reports import PostgresSource
from app.services.bi_sources import _TABLES_SQL, _pg_connect

_NUMERIC = {"smallint", "integer", "bigint", "numeric", "real", "double precision", "money"}
_DATES = {"date", "timestamp without time zone", "timestamp with time zone"}


def _kind(data_type: str) -> str:
    if data_type in _NUMERIC:
        return "number"
    if data_type in _DATES:
        return "date"
    return "text"


class PostgresConnector:
    kind = "postgres"

    def __init__(self, creds: dict) -> None:
        self.source = PostgresSource.model_validate(creds)

    async def _conn(self) -> asyncpg.Connection:
        return await _pg_connect(self.source)

    async def test(self) -> None:
        conn = await self._conn()
        try:
            await conn.fetchval("SELECT 1")
        finally:
            await conn.close()

    async def discover(self) -> list[TableInfo]:
        conn = await self._conn()
        try:
            rows = await conn.fetch(_TABLES_SQL)
        finally:
            await conn.close()
        return [
            TableInfo(
                name=f"{r['schema']}.{r['name']}",
                label=r["name"] if r["schema"] == "public" else f"{r['schema']}.{r['name']}",
                rows=r["rows"] if r["rows"] >= 0 else None,
            )
            for r in rows
        ]

    @staticmethod
    def _split(table: str) -> tuple[str, str]:
        schema, _, name = table.partition(".")
        if not name:
            raise BadRequestError("Укажите таблицу в виде схема.таблица")
        return schema, name

    async def _columns(self, conn: asyncpg.Connection, table: str) -> dict[str, str]:
        schema, name = self._split(table)
        rows = await conn.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
            schema,
            name,
        )
        if not rows:
            raise BadRequestError("Таблица не найдена или нет прав на чтение")
        return {r["column_name"]: r["data_type"] for r in rows}

    async def columns(self, table: str) -> list[ColumnInfo]:
        conn = await self._conn()
        try:
            cols = await self._columns(conn, table)
        finally:
            await conn.close()
        return [ColumnInfo(name=n, type=_kind(t)) for n, t in cols.items()]

    async def extract(
        self, table: str, key: str, cursor: str | None, after: str | None, offset: int, limit: int
    ) -> Page:
        conn = await self._conn()
        try:
            cols = await self._columns(conn, table)
            if key not in cols or (cursor and cursor not in cols):
                raise BadRequestError("Ключ или колонка курсора не найдены в таблице")
            schema, name = self._split(table)
            q = lambda ident: '"' + ident.replace('"', '""') + '"'  # noqa: E731
            sql = f"SELECT * FROM {q(schema)}.{q(name)}"
            params: list = []
            if cursor and after is not None:
                sql += f" WHERE {q(cursor)} > $1::text::{cols[cursor]}"  # text in, typed compare
                params.append(after)
            order = f"{q(cursor)}, {q(key)}" if cursor else q(key)
            sql += f" ORDER BY {order} LIMIT {int(limit)} OFFSET {int(offset)}"
            async with conn.transaction(readonly=True):
                rows = await conn.fetch(sql, *params)
        finally:
            await conn.close()
        records = [{k: jsonable(v) for k, v in dict(r).items()} for r in rows]
        nxt = cursor_text(rows[-1][cursor]) if cursor and rows else None
        return Page(records=records, next_cursor=nxt)

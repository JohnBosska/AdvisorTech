"""Read-only BI data sources: 1C through its standard OData interface and PostgreSQL.

Nothing is stored: connection details arrive with each request and are dropped afterwards.
The model never writes SQL. The user picks a table from a server-built list and the server reads
it with a fixed, quoted query and a row limit, inside a READ ONLY transaction.
"""

import asyncio
import ipaddress
import re
import socket
from urllib.parse import quote

import aiohttp
import asyncpg
from aiohttp.abc import AbstractResolver, ResolveResult
from aiohttp.resolver import DefaultResolver

from app.config.ai import ai
from app.exceptions import BadRequestError, ServiceUnavailableError
from app.schemas.reports import ODataSource, PostgresSource
from app.services.bi import MAX_ROWS, build_dataset, cell

TIMEOUT_S = 20


# ---------------------------------------------------------------- network guard (SSRF)


def _is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


async def resolve_public(host: str, port: int) -> str:
    """Returns one vetted IP. Refuses internal addresses so the platform's own services stay out of reach."""
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise BadRequestError(f"Не удалось найти сервер «{host}»") from exc
    ips = sorted({info[4][0] for info in infos})
    if not ips:
        raise BadRequestError(f"Не удалось найти сервер «{host}»")
    if not ai.bi_allow_private_hosts and not all(_is_public(ip) for ip in ips):
        raise BadRequestError(
            "Внутренние и локальные адреса недоступны: укажите публичный адрес сервера"
        )
    return ips[0]


class _PublicResolver(AbstractResolver):
    """aiohttp resolver that applies the same rule on every connection, redirects included."""

    def __init__(self) -> None:
        self._inner = DefaultResolver()

    async def resolve(
        self, host: str, port: int = 0, family: int = socket.AF_INET
    ) -> list[ResolveResult]:
        results = await self._inner.resolve(host, port, family)
        if not ai.bi_allow_private_hosts and not all(_is_public(r["host"]) for r in results):
            raise OSError("private address refused")  # aiohttp turns this into a connector error
        return results

    async def close(self) -> None:
        await self._inner.close()


# ---------------------------------------------------------------- 1C OData


def _odata_base(source: ODataSource) -> str:
    url = source.url.strip().rstrip("/")
    if not url.lower().endswith("standard.odata"):
        url += "/odata/standard.odata" if "/odata" not in url.lower() else ""
    return url


_PREFIXES = {
    "Catalog_": "Справочник",
    "Document_": "Документ",
    "AccumulationRegister_": "Регистр накопления",
    "InformationRegister_": "Регистр сведений",
    "AccountingRegister_": "Регистр бухгалтерии",
    "ChartOfAccounts_": "План счетов",
    "ChartOfCharacteristicTypes_": "План видов характеристик",
    "DocumentJournal_": "Журнал документов",
}


def _odata_label(name: str) -> str:
    for prefix, label in _PREFIXES.items():
        if name.startswith(prefix):
            rest = name[len(prefix) :].replace("_", ": ", 1).replace("_", " ")
            return f"{label}: {rest}"
    return name


async def _odata_get(source: ODataSource, url: str) -> dict:
    headers = {"Accept": "application/json"}
    if source.user:
        headers["Authorization"] = aiohttp.encode_basic_auth(source.user, source.password)
    connector = aiohttp.TCPConnector(resolver=_PublicResolver())
    try:
        async with aiohttp.ClientSession(
            connector=connector, timeout=aiohttp.ClientTimeout(total=TIMEOUT_S)
        ) as http:
            async with http.get(url, headers=headers, allow_redirects=False) as r:
                if r.status in (401, 403):
                    raise BadRequestError("1С отклонила логин или пароль")
                if r.status == 404:
                    raise BadRequestError("Публикация OData не найдена: проверьте адрес")
                if r.status != 200:
                    raise BadRequestError(f"1С ответила кодом {r.status}")
                return await r.json(content_type=None)
    except aiohttp.ClientConnectorError as exc:
        raise BadRequestError("Нет соединения с 1С (или адрес внутренний)") from exc
    except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
        raise ServiceUnavailableError("1С не ответила вовремя") from exc
    except ValueError as exc:
        raise BadRequestError("1С вернула не JSON: проверьте адрес публикации OData") from exc


async def onec_tables(source: ODataSource) -> list[dict]:
    data = await _odata_get(source, f"{_odata_base(source)}?$format=json")
    names = [
        item.get("name") or item.get("url")
        for item in data.get("value", [])
        if isinstance(item, dict)
    ]
    names = [n for n in names if n and "_RecordType" not in n]
    return [{"name": n, "label": _odata_label(n), "rows": None} for n in sorted(names)][:3000]


_ODATA_NAME = re.compile(r"^[A-Za-zА-Яа-яЁё0-9_]+$")
_EMPTY_DATE = "0001-01-01"


def _odata_cell(value) -> str:
    if isinstance(value, str) and value.startswith(_EMPTY_DATE):
        return ""
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}T00:00:00$", value):
        return value[:10]
    if value == "00000000-0000-0000-0000-000000000000":
        return ""
    return cell(value)


async def onec_load(source: ODataSource, entity: str) -> dict:
    if not _ODATA_NAME.match(entity):
        raise BadRequestError("Некорректное имя объекта 1С")
    url = f"{_odata_base(source)}/{quote(entity)}?$format=json&$top={MAX_ROWS + 1}"
    data = await _odata_get(source, url)
    records = [r for r in data.get("value", []) if isinstance(r, dict)]
    if not records:
        raise BadRequestError("В объекте 1С нет записей")
    # scalar fields only: nested tabular parts and navigation links are skipped
    header = [k for k, v in records[0].items() if not isinstance(v, (dict, list)) and "@" not in k]
    body = [[_odata_cell(r.get(k)) for k in header] for r in records]
    total = None if len(records) > MAX_ROWS else len(records)
    return build_dataset(_odata_label(entity), header, body, total_rows=total)


# ---------------------------------------------------------------- PostgreSQL


async def _pg_connect(source: PostgresSource) -> asyncpg.Connection:
    ip = await resolve_public(source.host, source.port)
    try:
        conn = await asyncpg.connect(
            host=ip,
            port=source.port,
            user=source.user,
            password=source.password,
            database=source.database,
            ssl="prefer" if source.ssl else False,
            timeout=TIMEOUT_S,
            command_timeout=TIMEOUT_S,
            server_settings={
                "default_transaction_read_only": "on",
                "statement_timeout": "15000",
                "application_name": "techadviser-bi",
            },
        )
    except (asyncpg.InvalidPasswordError, asyncpg.InvalidAuthorizationSpecificationError) as exc:
        raise BadRequestError("PostgreSQL отклонил логин или пароль") from exc
    except asyncpg.InvalidCatalogNameError as exc:
        raise BadRequestError("Такой базы данных нет") from exc
    except (OSError, asyncio.TimeoutError, asyncpg.PostgresError) as exc:
        raise BadRequestError("Нет соединения с PostgreSQL") from exc
    return conn


_TABLES_SQL = """
SELECT n.nspname AS schema, c.relname AS name, c.relkind, GREATEST(c.reltuples, -1)::bigint AS rows
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'v', 'm', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%%'
  AND has_table_privilege(c.oid, 'SELECT')
ORDER BY n.nspname, c.relname
LIMIT 3000
"""


async def pg_tables(source: PostgresSource) -> list[dict]:
    conn = await _pg_connect(source)
    try:
        rows = await conn.fetch(_TABLES_SQL)
    finally:
        await conn.close()
    return [
        {
            "name": f"{r['schema']}.{r['name']}",
            "label": r["name"] if r["schema"] == "public" else f"{r['schema']}.{r['name']}",
            "rows": r["rows"] if r["rows"] >= 0 else None,
        }
        for r in rows
    ]


async def pg_load(source: PostgresSource, table: str) -> dict:
    schema, _, name = table.partition(".")
    if not name:
        raise BadRequestError("Укажите таблицу в виде схема.таблица")
    conn = await _pg_connect(source)
    try:
        # identifiers are checked against the catalogue, then quoted: no user text reaches SQL as code
        exists = await conn.fetchval(
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r','v','m','p') "
            "AND has_table_privilege(c.oid, 'SELECT')",
            schema,
            name,
        )
        if not exists:
            raise BadRequestError("Таблица не найдена или нет прав на чтение")
        ident = '"' + schema.replace('"', '""') + '"."' + name.replace('"', '""') + '"'
        async with conn.transaction(readonly=True):
            stmt = await conn.prepare(f"SELECT * FROM {ident} LIMIT {MAX_ROWS + 1}")
            header = [a.name for a in stmt.get_attributes()]
            records = await stmt.fetch()
    except asyncpg.PostgresError as exc:
        raise BadRequestError("PostgreSQL не смог прочитать таблицу") from exc
    finally:
        await conn.close()
    if not records:
        raise BadRequestError("Таблица пустая")
    body = [[cell(v) for v in r] for r in records]
    total = None if len(records) > MAX_ROWS else len(records)
    label = name if schema == "public" else table
    return build_dataset(label, header, body, total_rows=total)

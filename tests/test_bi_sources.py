"""BI sources: 1C OData against a local fake, PostgreSQL against the test database, SSRF guard."""

import asyncio
import os

import asyncpg
import pytest
from aiohttp import web

from app.config.ai import ai
from app.exceptions import BadRequestError
from app.schemas.reports import ODataSource, PostgresSource
from app.services import bi_sources


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.0.0.5",
        "172.18.0.2",
        "192.168.1.1",
        "169.254.169.254",
        "::1",
        "::ffff:127.0.0.1",
    ],
)
def test_private_addresses_are_not_public(ip: str) -> None:
    assert not bi_sources._is_public(ip)


def test_public_address_is_allowed() -> None:
    assert bi_sources._is_public("213.159.209.139")


def test_resolve_refuses_loopback_by_default(monkeypatch) -> None:
    monkeypatch.setattr(ai, "bi_allow_private_hosts", False)
    with pytest.raises(BadRequestError, match="Внутренние"):
        asyncio.run(bi_sources.resolve_public("localhost", 5432))


def test_odata_refuses_loopback_by_default(monkeypatch) -> None:
    monkeypatch.setattr(ai, "bi_allow_private_hosts", False)
    with pytest.raises(BadRequestError):
        asyncio.run(bi_sources.onec_tables(ODataSource(url="http://127.0.0.1:9/base")))


def _odata_app() -> web.Application:
    async def root(request):
        assert request.headers.get("Authorization", "").startswith("Basic ")
        return web.json_response(
            {
                "value": [
                    {"name": "Catalog_Номенклатура"},
                    {"name": "AccumulationRegister_Продажи_RecordType"},
                    {"name": "AccumulationRegister_Продажи"},
                ]
            }
        )

    async def entity(request):
        return web.json_response(
            {
                "value": [
                    {
                        "Period": "2026-01-15T00:00:00",
                        "Номенклатура_Key": "00000000-0000-0000-0000-000000000000",
                        "Сумма": 1200.5,
                        "Склад": "Москва",
                        "Recorder@navigationLinkUrl": "x",
                        "Товары": [{"a": 1}],
                    },
                    {
                        "Period": "0001-01-01T00:00:00",
                        "Номенклатура_Key": "abc",
                        "Сумма": 300,
                        "Склад": "Казань",
                    },
                ]
            }
        )

    app = web.Application()
    app.router.add_get("/base/odata/standard.odata", root)
    app.router.add_get("/base/odata/standard.odata/{name}", entity)
    return app


def test_odata_lists_objects_and_loads_scalar_fields(monkeypatch) -> None:
    monkeypatch.setattr(ai, "bi_allow_private_hosts", True)

    async def main():
        runner = web.AppRunner(_odata_app())
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 0)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        src = ODataSource(url=f"http://127.0.0.1:{port}/base", user="u", password="p")
        try:
            return await bi_sources.onec_tables(src), await bi_sources.onec_load(
                src, "AccumulationRegister_Продажи"
            )
        finally:
            await runner.cleanup()

    tables, data = asyncio.run(main())
    assert [t["label"] for t in tables] == [
        "Регистр накопления: Продажи",
        "Справочник: Номенклатура",
    ]
    assert [c.name for c in data["columns"]] == ["Period", "Номенклатура_Key", "Сумма", "Склад"]
    assert [c.type for c in data["columns"]][0] == "date" and data["columns"][2].type == "number"
    assert data["rows"][1]["Period"] is None  # 0001-01-01 is 1C's empty date
    assert data["total_rows"] == 2


def test_odata_rejects_odd_entity_names(monkeypatch) -> None:
    with pytest.raises(BadRequestError):
        asyncio.run(
            bi_sources.onec_load(ODataSource(url="https://example.com/base"), "Catalog_X?$filter=1")
        )


def _pg_source() -> PostgresSource:
    return PostgresSource(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ.get("POSTGRES_DB", "techadviser"),
        user=os.environ.get("POSTGRES_USER", "techadviser"),
        password=os.environ.get("POSTGRES_PASSWORD", ""),
        ssl=False,
    )


def _pg_ready() -> bool:
    async def probe():
        s = _pg_source()
        try:
            conn = await asyncpg.connect(
                host=s.host,
                port=s.port,
                user=s.user,
                password=s.password,
                database=s.database,
                timeout=3,
            )
            await conn.close()
            return True
        except Exception:
            return False

    return asyncio.run(probe())


@pytest.mark.skipif(not _pg_ready(), reason="PostgreSQL not available")
def test_postgres_lists_and_reads_read_only(monkeypatch) -> None:
    monkeypatch.setattr(ai, "bi_allow_private_hosts", True)
    src = _pg_source()

    async def main():
        conn = await asyncpg.connect(
            host=src.host,
            port=src.port,
            user=src.user,
            password=src.password,
            database=src.database,
        )
        await conn.execute(
            "DROP TABLE IF EXISTS bi_probe; CREATE TABLE bi_probe (\"Месяц\" date, \"Группа\" text, \"Выручка\" numeric); INSERT INTO bi_probe VALUES ('2026-01-01', 'A', 10.5), ('2026-02-01', 'B', 20)"
        )
        try:
            tables = await bi_sources.pg_tables(src)
            data = await bi_sources.pg_load(src, "public.bi_probe")
            with pytest.raises(BadRequestError):
                await bi_sources.pg_load(src, 'public.bi_probe"; DROP TABLE bi_probe; --')
            return tables, data
        finally:
            await conn.execute("DROP TABLE IF EXISTS bi_probe")
            await conn.close()

    tables, data = asyncio.run(main())
    assert "public.bi_probe" in [t["name"] for t in tables]
    assert [c.type for c in data["columns"]] == ["date", "text", "number"]
    assert data["rows"][0]["Выручка"] == 10.5

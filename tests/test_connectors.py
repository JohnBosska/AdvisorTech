"""Server-side connectors: credential encryption, the PostgreSQL connector, and the full sync
flow over HTTP (credentials → discover → configure → sync → raw layer + cursors)."""

import asyncio
import importlib.util
import os
import uuid

import asyncpg
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text

from app.config.ai import ai
from app.config.connectors import connectors as conf
from app.connectors.postgres import PostgresConnector
from app.data_layer.alchemy.api_db import SessionFactory, engine
from app.data_layer.alchemy.models import Organization, OrganizationMember, User
from app.exceptions import ServiceUnavailableError
from app.resources import connectors as res
from app.services import credentials
from app.services import temporal as temporal_service
from app.utils.auth import create_access_token


def _pg() -> dict:
    return {
        "host": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "port": int(os.environ.get("POSTGRES_PORT", "5432")),
        "database": os.environ.get("POSTGRES_DB", "techadviser"),
        "user": os.environ.get("POSTGRES_USER", "techadviser"),
        "password": os.environ.get("POSTGRES_PASSWORD", ""),
        "ssl": False,
    }


def _db_ready() -> bool:
    async def probe() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("select 1 from sync_cursors limit 1"))
            return True
        except Exception:
            return False
        finally:
            await engine.dispose()

    return asyncio.run(probe())


pytestmark = pytest.mark.skipif(not _db_ready(), reason="PostgreSQL with migrations not available")


@pytest.fixture
def secret(monkeypatch):
    monkeypatch.setattr(conf, "secret", SecretStr("unit-test-secret-key-0123456789"))
    monkeypatch.setattr(ai, "bi_allow_private_hosts", True)


def test_credentials_roundtrip_and_key_change(monkeypatch) -> None:
    monkeypatch.setattr(conf, "secret", SecretStr(""))
    with pytest.raises(ServiceUnavailableError):
        credentials.encrypt({"a": 1})
    monkeypatch.setattr(conf, "secret", SecretStr("unit-test-secret-key-0123456789"))
    blob = credentials.encrypt({"password": "p4ss", "host": "h"})
    assert b"p4ss" not in blob and credentials.decrypt(blob) == {"password": "p4ss", "host": "h"}
    monkeypatch.setattr(conf, "secret", SecretStr("another-secret-key-9876543210"))
    with pytest.raises(ServiceUnavailableError, match="CONNECTOR_SECRET changed"):
        credentials.decrypt(blob)


def _seed_sql() -> str:
    return (
        'DROP TABLE IF EXISTS conn_probe; CREATE TABLE conn_probe (id int primary key, "Дата" date, '
        'updated_at timestamptz, "Сумма" numeric, note text);'
        "INSERT INTO conn_probe VALUES (1,'2026-01-01','2026-01-01T10:00:00Z',10.5,'a'),"
        "(2,'2026-01-02','2026-01-02T10:00:00Z',20,'b'),(3,'2026-01-03','2026-01-03T10:00:00Z',30,NULL)"
    )


def test_postgres_connector_discovers_and_pages_incrementally(secret) -> None:
    async def main():
        pg = _pg()
        conn = await asyncpg.connect(
            host=pg["host"],
            port=pg["port"],
            user=pg["user"],
            password=pg["password"],
            database=pg["database"],
        )
        await conn.execute(_seed_sql())
        try:
            c = PostgresConnector(pg)
            await c.test()
            assert "public.conn_probe" in [t.name for t in await c.discover()]
            cols = {x.name: x.type for x in await c.columns("public.conn_probe")}
            assert cols == {
                "id": "number",
                "Дата": "date",
                "updated_at": "date",
                "Сумма": "number",
                "note": "text",
            }
            first = await c.extract("public.conn_probe", "id", "updated_at", None, 0, 2)
            assert [r["id"] for r in first.records] == [1, 2] and first.records[0]["Сумма"] == 10.5
            assert first.next_cursor == "2026-01-02T10:00:00+00:00"
            second = await c.extract(
                "public.conn_probe", "id", "updated_at", first.next_cursor, 0, 2
            )
            assert [r["id"] for r in second.records] == [3] and second.records[0]["note"] is None
            with pytest.raises(Exception):
                await c.extract(
                    'public.conn_probe"; DROP TABLE conn_probe; --', "id", None, None, 0, 5
                )
        finally:
            await conn.execute("DROP TABLE IF EXISTS conn_probe")
            await conn.close()

    asyncio.run(main())


def _app():
    spec = importlib.util.spec_from_file_location("appmain", "app.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def test_full_sync_flow_over_http(secret, monkeypatch) -> None:
    schedules: list = []

    async def fake_schedule(connection_id, organization_id, minutes):
        schedules.append((connection_id, minutes))

    async def inline_start(run_id, organization_id, connection_id):
        await res.Connectors.run_sync(run_id, organization_id, connection_id)

    monkeypatch.setattr(temporal_service, "upsert_sync_schedule", fake_schedule)
    monkeypatch.setattr(temporal_service, "start_sync_workflow", inline_start)
    monkeypatch.setattr(conf, "page_size", 50)

    pg = _pg()

    async def sql(
        statement: str,
    ) -> None:  # fresh connection per call: each asyncio.run is a new loop
        conn = await asyncpg.connect(
            host=pg["host"],
            port=pg["port"],
            user=pg["user"],
            password=pg["password"],
            database=pg["database"],
        )
        try:
            await conn.execute(statement)
        finally:
            await conn.close()

    asyncio.run(sql(_seed_sql()))
    try:
        with TestClient(_app()) as client:

            async def setup():
                async with SessionFactory.begin() as s:
                    org = await Organization(name=f"o-{uuid.uuid4().hex[:6]}").save(s)
                    other = await Organization(name="other").save(s)
                    admin, analyst, stranger = [await User(name=n).save(s) for n in ("i", "a", "s")]
                    R = OrganizationMember.RoleEnum
                    await OrganizationMember(
                        organization_id=org.id, user_id=admin.id, role=R.IT_ADMIN
                    ).save(s)
                    await OrganizationMember(
                        organization_id=org.id, user_id=analyst.id, role=R.ANALYST
                    ).save(s)
                    await OrganizationMember(
                        organization_id=other.id, user_id=stranger.id, role=R.OWNER
                    ).save(s)
                    return org.id, other.id, admin, analyst, stranger

            org_id, other_id, admin, analyst, stranger = client.portal.call(setup)
            h = lambda u: {"Authorization": f"Bearer {create_access_token(u)}"}  # noqa: E731
            org = f"/api/v1/organizations/{org_id}"
            cid = client.post(
                f"{org}/connections",
                json={
                    "name": "УТ на PG",
                    "configuration": "TRADE_MANAGEMENT",
                    "source_dbms": "POSTGRESQL",
                    "transport": "EXTENSION",
                },
                headers=h(admin),
            ).json()["id"]
            base = f"{org}/connections/{cid}/connector"

            assert client.get(f"{base}/credentials", headers=h(admin)).json() == {
                "kind": None,
                "configured": False,
                "target": None,
            }
            # analysts cannot store credentials; a bad password fails before anything is stored
            assert (
                client.put(
                    f"{base}/credentials",
                    json={"kind": "postgres", "postgres": pg},
                    headers=h(analyst),
                ).status_code
                == 403
            )
            bad = client.put(
                f"{base}/credentials",
                json={"kind": "postgres", "postgres": {**pg, "password": "wrong"}},
                headers=h(admin),
            )
            assert (
                bad.status_code == 400
                and client.get(f"{base}/credentials", headers=h(admin)).json()["configured"]
                is False
            )
            ok = client.put(
                f"{base}/credentials", json={"kind": "postgres", "postgres": pg}, headers=h(admin)
            )
            assert ok.status_code == 200, ok.text
            assert (
                ok.json()["target"] == f"{pg['host']}:{pg['port']}/{pg['database']}"
                and '"password"' not in ok.text
            )
            assert (
                client.get(f"{org}/connections", headers=h(admin)).json()[0]["status"]
                == "CONNECTED"
            )

            tables = client.post(f"{base}/discover", headers=h(admin)).json()
            assert "public.conn_probe" in [t["name"] for t in tables]
            cols = client.get(f"{base}/tables/public.conn_probe/columns", headers=h(admin)).json()
            assert {"name": "updated_at", "type": "date"} in cols

            cfg = {
                "entities": {"public.conn_probe": {"key": "id", "cursor": "updated_at"}},
                "schedule_minutes": 60,
            }
            r = client.put(f"{base}/entities", json=cfg, headers=h(admin))
            assert (
                r.status_code == 200
                and r.json()["schedule_minutes"] == 60
                and schedules == [(cid, 60)]
            )

            run = client.post(f"{base}/sync", json={"mode": "FULL"}, headers=h(admin))
            assert run.status_code == 202, run.text
            runs = client.get(f"{org}/connections/{cid}/sync-runs", headers=h(admin)).json()
            assert runs[0]["status"] == "SUCCEEDED" and runs[0]["records_accepted"] == 3
            assert client.get(f"{base}/cursors", headers=h(admin)).json() == [
                {"entity": "public.conn_probe", "cursor_value": "2026-01-03T10:00:00+00:00"}
            ]
            ents = client.get(f"{org}/warehouse/entities", headers=h(admin)).json()
            assert [(e["entity"], e["records"]) for e in ents] == [("public.conn_probe", 3)]

            # incremental: only the new row travels; an updated old row is caught by its cursor
            asyncio.run(
                sql(
                    "INSERT INTO conn_probe VALUES (4,'2026-01-04','2026-01-04T10:00:00Z',40,'d'); UPDATE conn_probe SET \"Сумма\"=99, updated_at='2026-01-05T10:00:00Z' WHERE id=1"
                )
            )
            client.post(f"{base}/sync", headers=h(admin))
            runs = client.get(f"{org}/connections/{cid}/sync-runs", headers=h(admin)).json()
            assert runs[0]["records_accepted"] == 2
            ds = client.get(
                f"{org}/warehouse/entities/public.conn_probe/dataset?connection_id={cid}",
                headers=h(admin),
            ).json()
            assert ds["total_rows"] == 4 and {r["id"]: r["Сумма"] for r in ds["rows"]}[1] == 99

            # sync.finished landed in the audit without a user; tenants are isolated
            events = client.get(f"{org}/audit?action=sync.finished", headers=h(admin)).json()
            assert (
                len(events) == 2
                and events[0]["user_id"] is None
                and events[0]["details"]["status"] == "SUCCEEDED"
            )
            assert (
                client.get(
                    f"/api/v1/organizations/{other_id}/connections/{cid}/connector/credentials",
                    headers=h(stranger),
                ).status_code
                == 404
            )
    finally:
        asyncio.run(sql("DROP TABLE IF EXISTS conn_probe"))


def test_scheduled_job_payload_round_trips_through_temporal_converter() -> None:
    from temporalio.converter import DataConverter

    from app.schemas.sync import SyncJob

    job = SyncJob(run_id=None, organization_id=1, connection_id=2, mode="INCREMENTAL")
    conv = DataConverter.default
    payloads = asyncio.run(conv.encode([job]))
    assert asyncio.run(conv.decode(payloads, [SyncJob])) == [job]


def test_unavailable_worker_fails_the_run_instead_of_blocking(secret, monkeypatch) -> None:
    async def down(*_):
        raise ServiceUnavailableError("worker down")

    monkeypatch.setattr(temporal_service, "start_sync_workflow", down)

    async def scenario():
        async with SessionFactory.begin() as s:
            org = await Organization(name=f"o-{uuid.uuid4().hex[:6]}").save(s)
            user = await User(name="u").save(s)
            member = await OrganizationMember(
                organization_id=org.id, user_id=user.id, role=OrganizationMember.RoleEnum.OWNER
            ).save(s)
            from app.data_layer.alchemy.models import SourceConnection

            conn = await SourceConnection(
                organization_id=org.id,
                name="c",
                configuration=SourceConnection.ConfigurationEnum.ERP,
                source_dbms=SourceConnection.DbmsEnum.POSTGRESQL,
                transport=SourceConnection.TransportEnum.ODATA,
                connector_kind="postgres",
                entity_config={"public.t": {"key": "id", "cursor": None}},
            ).save(s)
        with pytest.raises(ServiceUnavailableError):
            await res.Connectors.sync_now(member, conn.id, res.SyncRun.ModeEnum.FULL)
        async with SessionFactory() as s:
            from app.data_layer.alchemy.models import SyncRun

            runs = await SyncRun.list_for_connection(s, org.id, conn.id)
        assert [r.status for r in runs] == [SyncRun.StatusEnum.FAILED]
        # and a new sync can be queued right away
        assert (
            await res.Connectors.enqueue(org.id, conn.id, SyncRun.ModeEnum.FULL)
        ).status == SyncRun.StatusEnum.QUEUED
        await engine.dispose()

    asyncio.run(scenario())

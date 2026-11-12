"""Raw warehouse layer end to end over HTTP: agent delivers records, the organization reads them
back as a dataset, re-delivery upserts, other tenants see nothing (needs PostgreSQL)."""

import asyncio
import importlib.util
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.data_layer.alchemy.api_db import SessionFactory, engine
from app.data_layer.alchemy.models import Organization, OrganizationMember, User
from app.schemas.agent import BatchRequest
from app.utils.auth import create_access_token


def _db_ready() -> bool:
    async def probe() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("select 1 from raw_records limit 1"))
            return True
        except Exception:
            return False
        finally:
            await engine.dispose()

    return asyncio.run(probe())


pytestmark = pytest.mark.skipif(not _db_ready(), reason="PostgreSQL with migrations not available")


def _app():
    spec = importlib.util.spec_from_file_location("appmain", "app.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def test_batch_records_must_match_counts() -> None:
    with pytest.raises(ValueError, match="records_accepted"):
        BatchRequest(
            sequence=1,
            entity="e",
            records_received=2,
            records_accepted=2,
            records=[{"key": "a", "data": {}}],
        )
    with pytest.raises(ValueError, match="unique"):
        BatchRequest(
            sequence=1,
            entity="e",
            records_received=2,
            records_accepted=2,
            records=[{"key": "a", "data": {}}, {"key": "a", "data": {}}],
        )


def _batch(seq: int, records: list[dict], entity: str = "Document_Sale") -> dict:
    return {
        "sequence": seq,
        "entity": entity,
        "records_received": len(records),
        "records_accepted": len(records),
        "records": records,
    }


def test_agent_records_land_in_the_raw_layer_and_are_readable() -> None:
    with TestClient(_app()) as client:

        async def setup():
            async with SessionFactory.begin() as s:
                org = await Organization(name=f"o-{uuid.uuid4().hex[:6]}").save(s)
                other = await Organization(name="other").save(s)
                owner, stranger = await User(name="o").save(s), await User(name="s").save(s)
                await OrganizationMember(
                    organization_id=org.id, user_id=owner.id, role=OrganizationMember.RoleEnum.OWNER
                ).save(s)
                await OrganizationMember(
                    organization_id=other.id,
                    user_id=stranger.id,
                    role=OrganizationMember.RoleEnum.OWNER,
                ).save(s)
                return org.id, other.id, owner, stranger

        org_id, other_id, owner, stranger = client.portal.call(setup)
        h = {"Authorization": f"Bearer {create_access_token(owner)}"}
        org = f"/api/v1/organizations/{org_id}"

        conn = client.post(
            f"{org}/connections",
            json={
                "name": "УТ",
                "configuration": "TRADE_MANAGEMENT",
                "source_dbms": "POSTGRESQL",
                "transport": "EXTENSION",
            },
            headers=h,
        ).json()
        token = client.post(f"{org}/connections/{conn['id']}/agent-credentials", headers=h).json()[
            "token"
        ]
        ah = {"Authorization": f"Bearer {token}"}
        # the connection becomes CONNECTED on the agent's first heartbeat
        hb = client.post("/api/v1/agent/heartbeat", json={"agent_version": "0.1"}, headers=ah)
        assert hb.status_code == 200, hb.text
        run = client.post(
            f"{org}/connections/{conn['id']}/sync-runs", json={"mode": "FULL"}, headers=h
        ).json()
        assert (
            client.post(f"/api/v1/agent/sync-runs/{run['id']}/start", headers=ah).status_code == 204
        )

        batch = _batch(
            1,
            [
                {
                    "key": "doc-1",
                    "data": {
                        "Дата": "2026-01-10",
                        "Контрагент": "Ромашка",
                        "Сумма": 1200.5,
                        "Товары": [{"a": 1}],
                    },
                },
                {
                    "key": "doc-2",
                    "data": {"Дата": "2026-01-11", "Контрагент": "Лютик", "Сумма": 300},
                },
            ],
        )
        r = client.post(f"/api/v1/agent/sync-runs/{run['id']}/batches", json=batch, headers=ah)
        assert r.status_code == 200 and r.json()["duplicate"] is False
        # same batch again: idempotent, nothing doubles
        assert (
            client.post(
                f"/api/v1/agent/sync-runs/{run['id']}/batches", json=batch, headers=ah
            ).json()["duplicate"]
            is True
        )

        ents = client.get(f"{org}/warehouse/entities", headers=h).json()
        assert [(e["entity"], e["records"], e["connection_name"]) for e in ents] == [
            ("Document_Sale", 2, "УТ")
        ]
        ds = client.get(
            f"{org}/warehouse/entities/Document_Sale/dataset?connection_id={conn['id']}", headers=h
        ).json()
        # JSONB does not keep key order, so compare as a mapping; the nested part is skipped
        assert {c["name"]: c["type"] for c in ds["columns"]} == {
            "Дата": "date",
            "Контрагент": "text",
            "Сумма": "number",
        }
        assert ds["total_rows"] == 2 and ds["rows"][0]["Сумма"] == 1200.5

        # a later run re-delivers doc-1 with a new amount: upsert, still 2 records
        assert (
            client.post(
                f"/api/v1/agent/sync-runs/{run['id']}/finish",
                json={"status": "SUCCEEDED"},
                headers=ah,
            ).status_code
            == 204
        )
        run2 = client.post(
            f"{org}/connections/{conn['id']}/sync-runs", json={"mode": "INCREMENTAL"}, headers=h
        ).json()
        client.post(f"/api/v1/agent/sync-runs/{run2['id']}/start", headers=ah)
        client.post(
            f"/api/v1/agent/sync-runs/{run2['id']}/batches",
            json=_batch(
                1,
                [
                    {
                        "key": "doc-1",
                        "data": {"Дата": "2026-01-10", "Контрагент": "Ромашка", "Сумма": 999},
                    }
                ],
            ),
            headers=ah,
        )
        ds = client.get(
            f"{org}/warehouse/entities/Document_Sale/dataset?connection_id={conn['id']}", headers=h
        ).json()
        assert ds["total_rows"] == 2 and sorted(r["Сумма"] for r in ds["rows"]) == [300, 999]

        # tenant isolation: the other organization sees no entities and cannot read by id
        sh = {"Authorization": f"Bearer {create_access_token(stranger)}"}
        assert (
            client.get(f"/api/v1/organizations/{other_id}/warehouse/entities", headers=sh).json()
            == []
        )
        assert (
            client.get(
                f"/api/v1/organizations/{other_id}/warehouse/entities/Document_Sale/dataset?connection_id={conn['id']}",
                headers=sh,
            ).status_code
            == 404
        )
        assert client.get(f"{org}/warehouse/entities", headers=sh).status_code == 404

        # a saved BI report on the warehouse can be refreshed without credentials
        spec = {
            "version": 1,
            "theme": "neon",
            "pages": [{"id": "p", "name": "p", "visuals": [], "filters": []}],
            "filters": [],
        }
        rep = client.post(
            f"{org}/bi/reports",
            json={
                "title": "Склад",
                "spec": spec,
                "dataset": ds,
                "source": {
                    "kind": "warehouse",
                    "label": "УТ: Document_Sale",
                    "connection_id": conn["id"],
                    "entity": "Document_Sale",
                },
            },
            headers=h,
        )
        assert rep.status_code == 201, rep.text
        assert (
            client.post(f"{org}/bi/reports/{rep.json()['id']}/refresh", headers=h).json()[
                "dataset"
            ]["total_rows"]
            == 2
        )

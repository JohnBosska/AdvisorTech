"""Saved BI reports: CRUD over HTTP, tenant isolation, edit rights, limits (needs PostgreSQL)."""

import asyncio
import importlib.util
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.data_layer.alchemy.api_db import SessionFactory, engine
from app.data_layer.alchemy.models import Organization, OrganizationMember, User
from app.utils.auth import create_access_token


def _db_ready() -> bool:
    async def probe() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("select 1 from bi_reports limit 1"))
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


SPEC = {"version": 1, "theme": "neon", "pages": [{"id": "p1", "name": "Страница 1", "visuals": []}]}
DATASET = {
    "filename": "s.csv",
    "columns": [
        {"name": "Группа", "type": "text", "samples": []},
        {"name": "Выручка", "type": "number", "samples": []},
    ],
    "rows": [{"Группа": "A", "Выручка": 1}],
    "total_rows": 1,
    "truncated": False,
}


def test_saved_reports_crud_isolation_and_rights() -> None:
    with TestClient(_app()) as client:

        async def setup():
            async with SessionFactory.begin() as s:
                org = await Organization(name=f"o-{uuid.uuid4().hex[:6]}").save(s)
                other_org = await Organization(name="other").save(s)
                users = [await User(name=n).save(s) for n in ("owner", "analyst", "stranger")]
                roles = [OrganizationMember.RoleEnum.OWNER, OrganizationMember.RoleEnum.ANALYST]
                for u, r in zip(users[:2], roles, strict=True):
                    await OrganizationMember(organization_id=org.id, user_id=u.id, role=r).save(s)
                await OrganizationMember(
                    organization_id=other_org.id,
                    user_id=users[2].id,
                    role=OrganizationMember.RoleEnum.OWNER,
                ).save(s)
                return org.id, users

        org_id, (owner, analyst, stranger) = client.portal.call(setup)
        h = lambda u: {"Authorization": f"Bearer {create_access_token(u)}"}  # noqa: E731
        base = f"/api/v1/organizations/{org_id}/bi/reports"

        r = client.post(
            base,
            json={
                "title": "Продажи",
                "spec": SPEC,
                "dataset": DATASET,
                "source": {"kind": "url", "url": "https://example.com/s.csv"},
            },
            headers=h(analyst),
        )
        assert r.status_code == 201, r.text
        rid = r.json()["id"]
        assert client.get(base, headers=h(owner)).json()[0]["title"] == "Продажи"
        assert (
            client.get(f"{base}/{rid}", headers=h(owner)).json()["dataset"]["rows"][0]["Выручка"]
            == 1
        )

        # another tenant sees nothing
        assert client.get(f"{base}/{rid}", headers=h(stranger)).status_code == 404

        # analyst (author) can edit; owner can edit; nobody else in org exists here, so check a second report
        assert (
            client.put(
                f"{base}/{rid}", json={"title": "Продажи v2", "spec": SPEC}, headers=h(analyst)
            ).status_code
            == 200
        )
        r2 = client.post(base, json={"title": "Владельца", "spec": SPEC}, headers=h(owner)).json()[
            "id"
        ]
        assert (
            client.put(
                f"{base}/{r2}", json={"title": "x", "spec": SPEC}, headers=h(analyst)
            ).status_code
            == 403
        )
        assert client.delete(f"{base}/{r2}", headers=h(analyst)).status_code == 403
        assert client.delete(f"{base}/{rid}", headers=h(owner)).status_code == 204
        assert client.get(f"{base}/{rid}", headers=h(owner)).status_code == 404

        # validation: no pages, oversize spec, refresh of a non-link report
        assert (
            client.post(
                base, json={"title": "bad", "spec": {"pages": []}}, headers=h(owner)
            ).status_code
            == 400
        )
        big = {"pages": [{"id": "p", "visuals": [], "pad": "x" * 400_000}]}
        assert (
            client.post(base, json={"title": "big", "spec": big}, headers=h(owner)).status_code
            == 400
        )
        assert client.post(f"{base}/{r2}/refresh", headers=h(owner)).status_code == 400

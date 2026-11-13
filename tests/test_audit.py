"""Audit log: actions produce events, only OWNER/IT_ADMIN read them, tenants are isolated,
details never carry credentials (needs PostgreSQL)."""

import asyncio
import importlib.util
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.data_layer.alchemy.api_db import SessionFactory, engine
from app.data_layer.alchemy.models import Organization, OrganizationMember, User
from app.services import audit
from app.utils.auth import create_access_token


def _db_ready() -> bool:
    async def probe() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("select 1 from audit_events limit 1"))
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


def test_unknown_action_is_rejected_and_secrets_are_stripped() -> None:
    with pytest.raises(ValueError):
        asyncio.run(audit.record(1, 1, "not.an.action"))
    assert audit._trim({"password": "x", "nested": {"token": "y", "ok": 1}, "long": "a" * 400}) == {
        "nested": {"ok": 1},
        "long": "a" * 300 + "…",
    }


def test_actions_are_audited_with_roles_and_isolation() -> None:
    with TestClient(_app()) as client:

        async def setup():
            async with SessionFactory.begin() as s:
                org = await Organization(name=f"o-{uuid.uuid4().hex[:6]}").save(s)
                other = await Organization(name="other").save(s)
                owner, analyst, admin, stranger = [
                    await User(name=n).save(s) for n in ("o", "a", "i", "s")
                ]
                R = OrganizationMember.RoleEnum
                for u, r in ((owner, R.OWNER), (analyst, R.ANALYST), (admin, R.IT_ADMIN)):
                    await OrganizationMember(organization_id=org.id, user_id=u.id, role=r).save(s)
                await OrganizationMember(
                    organization_id=other.id, user_id=stranger.id, role=R.OWNER
                ).save(s)
                return org.id, other.id, owner, analyst, admin, stranger

        org_id, other_id, owner, analyst, admin, stranger = client.portal.call(setup)
        h = lambda u: {"Authorization": f"Bearer {create_access_token(u)}"}  # noqa: E731
        org = f"/api/v1/organizations/{org_id}"

        # a few audited actions by different users
        doc = client.post(
            f"{org}/knowledge/documents",
            json={"title": "Регламент", "content": "Скидка 7%. " + uuid.uuid4().hex},
            headers=h(owner),
        )
        assert doc.status_code == 201
        client.post(
            f"{org}/connections",
            json={
                "name": "УТ",
                "configuration": "ERP",
                "source_dbms": "MSSQL",
                "transport": "ODATA",
            },
            headers=h(admin),
        )
        client.post(
            f"{org}/invitations",
            json={"email": "new@example.com", "role": "ANALYST"},
            headers=h(owner),
        )
        spec = {
            "version": 1,
            "theme": "neon",
            "pages": [{"id": "p", "name": "p", "visuals": [], "filters": []}],
            "filters": [],
        }
        rep = client.post(
            f"{org}/bi/reports", json={"title": "Отчёт", "spec": spec}, headers=h(analyst)
        ).json()
        client.delete(f"{org}/bi/reports/{rep['id']}", headers=h(analyst))
        # a source connection attempt with a password: fails (private host) but must not leak anyway
        client.post(
            f"{org}/reports/sources/tables",
            json={
                "kind": "postgres",
                "postgres": {
                    "host": "127.0.0.1",
                    "port": 5432,
                    "database": "d",
                    "user": "u",
                    "password": "p4ss",
                    "ssl": False,
                },
            },
            headers=h(analyst),
        )

        # only OWNER / IT_ADMIN can read
        assert client.get(f"{org}/audit", headers=h(analyst)).status_code == 403
        events = client.get(f"{org}/audit", headers=h(owner)).json()
        actions = [e["action"] for e in events]
        assert actions[:5] == [
            "bi.report.delete",
            "bi.report.create",
            "member.invite",
            "connection.create",
            "knowledge.add",
        ]
        assert client.get(f"{org}/audit", headers=h(admin)).status_code == 200
        by_user = {e["action"]: e["user_name"] for e in events}
        assert (
            by_user["knowledge.add"] == "o"
            and by_user["bi.report.create"] == "a"
            and by_user["connection.create"] == "i"
        )
        assert "p4ss" not in str(events)
        invite = next(e for e in events if e["action"] == "member.invite")
        assert (
            invite["details"] == {"email": "new@example.com", "role": "ANALYST"}
            and invite["request_id"]
        )

        # filters and paging
        assert [
            e["action"]
            for e in client.get(f"{org}/audit?action=knowledge.add", headers=h(owner)).json()
        ] == ["knowledge.add"]
        first = client.get(f"{org}/audit?limit=2", headers=h(owner)).json()
        rest = client.get(f"{org}/audit?before_id={first[-1]['id']}", headers=h(owner)).json()
        assert len(first) == 2 and all(e["id"] < first[-1]["id"] for e in rest) and len(rest) >= 3
        assert {
            a["action"] for a in client.get(f"{org}/audit/actions", headers=h(owner)).json()
        } == set(audit.ACTIONS)

        # tenant isolation
        assert (
            client.get(f"/api/v1/organizations/{other_id}/audit", headers=h(stranger)).json() == []
        )
        assert client.get(f"{org}/audit", headers=h(stranger)).status_code == 404

"""HTTP-level check of the streaming pipeline and the XLSX download (needs PostgreSQL)."""

import asyncio
import importlib.util
import json
import uuid
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import text

from app.data_layer.alchemy.api_db import SessionFactory, engine
from app.data_layer.alchemy.models import Organization, OrganizationMember, User
from app.services import llm as llm_service
from app.services.llm_types import LLMResult
from app.utils.auth import create_access_token


def _db_ready() -> bool:
    async def probe() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("select trace from chat_messages limit 1"))
            return True
        except Exception:
            return False
        finally:
            await engine.dispose()

    return asyncio.run(probe())


pytestmark = pytest.mark.skipif(not _db_ready(), reason="PostgreSQL with migrations not available")


def _load_app():
    spec = importlib.util.spec_from_file_location("appmain", "app.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


class FakeLLM:
    async def complete(self, system, messages):
        return LLMResult(text="Скидка выше 10% требует согласования [1].", model="fake")


def test_stream_emits_ordered_stage_events_and_report_downloads(monkeypatch) -> None:
    monkeypatch.setattr(llm_service, "get_llm", lambda: FakeLLM())

    with TestClient(_load_app()) as client:

        async def setup():
            async with SessionFactory.begin() as session:
                user = await User(name="sse").save(session)
                org = await Organization(name="SSE org").save(session)
                await OrganizationMember(
                    organization_id=org.id, user_id=user.id, role=OrganizationMember.RoleEnum.OWNER
                ).save(session)
                return user, org.id

        user, org_id = client.portal.call(setup)
        headers = {"Authorization": f"Bearer {create_access_token(user)}"}
        base = f"/api/v1/organizations/{org_id}"

        doc = {
            "title": "Регламент",
            "content": f"Скидка выше 10% требует согласования. {uuid.uuid4().hex}",
        }
        assert (
            client.post(f"{base}/knowledge/documents", json=doc, headers=headers).status_code == 201
        )
        conversation = client.post(f"{base}/chat/conversations", headers=headers).json()["id"]

        events = []
        with client.stream(
            "POST",
            f"{base}/chat/conversations/{conversation}/messages/stream",
            json={"content": "Какая скидка требует согласования?"},
            headers=headers,
        ) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            assert response.headers["x-accel-buffering"] == "no"
            for line in response.iter_lines():
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))

        assert events[-1]["type"] == "done"
        started = [
            e["stage"]["id"]
            for e in events
            if e["type"] == "stage" and e["stage"]["status"] == "running"
        ]
        assert (
            started.index("query_analysis")
            < started.index("llm_generation")
            < started.index("validation")
        )
        answer = events[-1]["answer"]["assistant_message"]
        assert answer["sources"][0]["title"] == "Регламент" and len(answer["trace"]) == 10

        report = client.get(
            f"{base}/chat/conversations/{conversation}/messages/{answer['id']}/report.xlsx",
            headers=headers,
        )
        assert report.status_code == 200 and "spreadsheetml" in report.headers["content-type"]
        assert load_workbook(BytesIO(report.content)).sheetnames == [
            "Сводка",
            "Источники",
            "Допущения",
            "Трасса",
        ]

        other = client.get(
            f"/api/v1/organizations/{org_id + 999}/chat/conversations", headers=headers
        )
        assert other.status_code == 404  # not a member of that organization

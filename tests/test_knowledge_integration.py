"""End-to-end checks of the knowledge base and chat against a real PostgreSQL with pgvector.

Skipped when the database is not reachable (set POSTGRES_* and run `alembic upgrade head`).
"""

import asyncio
import hashlib
import uuid

import pytest
from sqlalchemy import text

from app.config.ai import ai
from app.data_layer.alchemy.api_db import SessionFactory, engine
from app.data_layer.alchemy.models import (
    Organization,
    OrganizationMember,
    User,
)
from app.exceptions import ConflictError, ForbiddenError, ObjectNotFoundError
from app.resources.chat import Chat
from app.resources.knowledge import KnowledgeBase
from app.schemas.knowledge import DocumentCreateRequest
from app.services import embeddings
from app.services import llm as llm_service
from app.services.llm_types import LLMResult


def _db_ready() -> bool:
    async def probe() -> bool:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("select 1 from knowledge_chunks limit 1"))
            return True
        except Exception:
            return False
        finally:
            await engine.dispose()

    return asyncio.run(probe())


pytestmark = pytest.mark.skipif(not _db_ready(), reason="PostgreSQL with migrations not available")


async def _member(role=OrganizationMember.RoleEnum.OWNER, org_id=None):
    async with SessionFactory.begin() as session:
        user = await User(name="t").save(session)
        if org_id is None:
            org_id = (await Organization(name=f"org-{uuid.uuid4().hex[:6]}").save(session)).id
        member = await OrganizationMember(organization_id=org_id, user_id=user.id, role=role).save(
            session
        )
    return member


class FakeLLM:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[dict]]] = []

    async def complete(self, system, messages):
        self.calls.append((system, messages))
        return LLMResult(text="Маржа указана в регламенте [1].", model="fake")


def run(coro_fn):
    async def wrapper():
        try:
            return await coro_fn()
        finally:
            await engine.dispose()

    return asyncio.run(wrapper())


def test_fulltext_retrieval_is_tenant_isolated_and_deduplicated() -> None:
    async def scenario():
        a, b = await _member(), await _member()
        text_a = (
            "Регламент: валовая маржа считается как выручка минус себестоимость. "
            + uuid.uuid4().hex
        )
        doc = await KnowledgeBase.add(a, DocumentCreateRequest(title="Регламент А", content=text_a))
        assert doc.chunk_count >= 1

        hits = await KnowledgeBase.retrieve(a.organization_id, "как считается валовая маржа?")
        assert hits and hits[0].title == "Регламент А" and hits[0].ref == 1
        assert await KnowledgeBase.retrieve(b.organization_id, "как считается валовая маржа?") == []

        with pytest.raises(ConflictError):
            await KnowledgeBase.add(a, DocumentCreateRequest(title="копия", content=text_a))
        viewer = await _member(OrganizationMember.RoleEnum.ANALYST, a.organization_id)
        with pytest.raises(ForbiddenError):
            await KnowledgeBase.add(viewer, DocumentCreateRequest(title="x", content="y"))
        with pytest.raises(ObjectNotFoundError):  # another tenant cannot delete it
            await KnowledgeBase.remove(b, doc.id)

        await KnowledgeBase.remove(a, doc.id)
        assert await KnowledgeBase.retrieve(a.organization_id, "валовая маржа") == []

    run(scenario)


def test_vector_path_uses_pgvector_and_filters_by_organization(monkeypatch) -> None:
    def fake_vector(word: str) -> list[float]:
        v = [0.0] * ai.embedding_dim
        v[int(hashlib.sha256(word.encode()).hexdigest(), 16) % ai.embedding_dim] = 1.0
        return v

    async def fake_embed(texts, *, input_type):
        return [fake_vector("alpha" if "alpha" in t else "beta") for t in texts]

    monkeypatch.setattr(embeddings, "embed", fake_embed)
    monkeypatch.setattr(type(ai), "vector_configured", property(lambda self: True))

    async def scenario():
        a, b = await _member(), await _member()
        marker = uuid.uuid4().hex
        doc_a = await KnowledgeBase.add(
            a, DocumentCreateRequest(title="Doc A", content=f"alpha {marker} политика запасов")
        )
        await KnowledgeBase.add(
            b, DocumentCreateRequest(title="Doc B", content=f"alpha {marker} чужая политика")
        )
        assert doc_a.vector_indexed is True
        # Question shares no words with the text, so only the vector branch can find it.
        hits = await KnowledgeBase.retrieve(a.organization_id, "alpha")
        assert [h.title for h in hits] == ["Doc A"]

    run(scenario)


def test_vector_search_ignores_weakly_similar_chunks(monkeypatch) -> None:
    def unit(i: int) -> list[float]:
        v = [0.0] * ai.embedding_dim
        v[i] = 1.0
        return v

    def near(i: int, j: int, weight: float) -> list[float]:  # cosine to unit(i) ~ weight
        v = unit(i)
        v[i], v[j] = weight, (1 - weight**2) ** 0.5
        return v

    async def fake_embed(texts, *, input_type):
        return [
            unit(0)
            if t.startswith("документ")
            else near(0, 1, 0.05)
            if "далёкий" in t
            else near(0, 2, 0.5)
            for t in texts
        ]

    monkeypatch.setattr(embeddings, "embed", fake_embed)
    monkeypatch.setattr(type(ai), "vector_configured", property(lambda self: True))

    async def scenario():
        owner = await _member()
        await KnowledgeBase.add(
            owner, DocumentCreateRequest(title="Doc", content=f"документ {uuid.uuid4().hex}")
        )
        assert (
            await KnowledgeBase.vector_ids(owner.organization_id, "близкий вопрос") != []
        )  # cos 0.5
        assert (
            await KnowledgeBase.vector_ids(owner.organization_id, "далёкий вопрос") == []
        )  # cos 0.05

    run(scenario)


def test_chat_answers_with_sources_and_refuses_without_context(monkeypatch) -> None:
    fake = FakeLLM()
    monkeypatch.setattr(llm_service, "get_llm", lambda: fake)

    async def scenario():
        owner = await _member()
        other = await _member(OrganizationMember.RoleEnum.ANALYST, owner.organization_id)
        conversation = await Chat.create_conversation(owner)

        empty = await Chat.ask(owner, conversation.id, "Какая у нас политика скидок?")
        assert empty.assistant_message.refusal is True and not fake.calls  # no LLM call

        await KnowledgeBase.add(
            owner,
            DocumentCreateRequest(
                title="Политика скидок",
                content="Политика скидок: скидок выше 10% требует согласования собственника. "
                + uuid.uuid4().hex,
            ),
        )
        answer = await Chat.ask(owner, conversation.id, "Какая политика скидок?")
        assert answer.assistant_message.refusal is False
        assert answer.assistant_message.sources[0].title == "Политика скидок"
        system, messages = fake.calls[0]
        assert '<source id="1"' in messages[-1]["content"] and "недоверенные" in system

        trace = {s.id: s for s in answer.assistant_message.trace}
        assert trace["fulltext_retrieval"].status == "completed"
        assert trace["vector_retrieval"].status == "skipped"  # no embeddings configured here
        assert trace["sql_analytics"].status == "skipped"  # no data warehouse
        assert (
            trace["llm_generation"].status == "completed"
            and trace["final_answer"].status == "completed"
        )
        assert trace["validation"].status in {"completed", "warning"}
        assert empty.assistant_message.trace[7].status == "skipped"  # llm_generation on refusal

        events = [
            e
            async for e in Chat.stream(
                await Chat.prepare(owner, conversation.id, "Какая политика скидок?")
            )
        ]
        stage_ids = [e["stage"]["id"] for e in events if e["type"] == "stage"]
        assert (
            stage_ids.index("query_analysis")
            < stage_ids.index("reranking")
            < stage_ids.index("llm_generation")
        )
        assert events[-1]["type"] == "done"

        history = await Chat.messages(owner, conversation.id)
        assert [m.role.value for m in history][:4] == ["USER", "ASSISTANT", "USER", "ASSISTANT"]
        with pytest.raises(ObjectNotFoundError):  # conversations are private to their author
            await Chat.messages(other, conversation.id)

    run(scenario)

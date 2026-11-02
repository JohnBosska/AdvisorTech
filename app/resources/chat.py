import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.config.ai import ai
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import ChatConversation, ChatMessage, OrganizationMember
from app.exceptions import (
    APIError,
    BadRequestError,
    ObjectNotFoundError,
    ServiceUnavailableError,
    TooManyRequestsError,
)
from app.resources.knowledge import KnowledgeBase
from app.schemas.knowledge import AnswerResponse, MessageResponse
from app.services import llm as llm_service
from app.services.llm_types import LLM
from app.utils.rag import (
    NO_CONTEXT_ANSWER,
    SYSTEM_PROMPT,
    Passage,
    build_or_tsquery,
    cited_refs,
    render_context,
    validate_answer,
)

logger = logging.getLogger(__name__)
HISTORY_LIMIT = 10
SNIPPET_CHARS = 240
NEW_TITLE = "Новый диалог"

# Fixed pipeline order. The UI draws exactly these nodes.
STAGES = [
    "query_analysis",
    "access_control",
    "fulltext_retrieval",
    "vector_retrieval",
    "sql_analytics",
    "reranking",
    "context_assembly",
    "llm_generation",
    "validation",
    "final_answer",
]


@dataclass
class Trace:
    """Execution record of one question. Every status here reflects work that really happened."""

    stages: dict[str, dict] = field(
        default_factory=lambda: {s: {"id": s, "status": "idle"} for s in STAGES}
    )
    _t0: dict[str, float] = field(default_factory=dict)

    def start(self, stage: str) -> dict:
        self._t0[stage] = time.perf_counter()
        self.stages[stage] = {"id": stage, "status": "running"}
        return {"type": "stage", "stage": self.stages[stage]}

    def finish(self, stage: str, status: str, summary: str, count: int | None = None) -> dict:
        began = self._t0.get(stage)
        duration = int((time.perf_counter() - began) * 1000) if began is not None else 0
        self.stages[stage] = {
            "id": stage,
            "status": status,
            "summary": summary,
            "duration_ms": duration,
            "count": count,
        }
        return {"type": "stage", "stage": self.stages[stage]}

    def skip(self, stage: str, summary: str) -> dict:
        self.stages[stage] = {"id": stage, "status": "skipped", "summary": summary}
        return {"type": "stage", "stage": self.stages[stage]}

    def as_list(self) -> list[dict]:
        return [self.stages[s] for s in STAGES]


@dataclass
class Prepared:
    member: OrganizationMember
    conversation_id: int
    question: str
    model: LLM
    history: list[ChatMessage]


class Chat:
    @staticmethod
    async def create_conversation(member: OrganizationMember) -> ChatConversation:
        async with SessionFactory.begin() as session:
            return await ChatConversation(
                organization_id=member.organization_id,
                user_id=member.user_id,
                title=NEW_TITLE,
            ).save(session)

    @staticmethod
    async def list_conversations(member: OrganizationMember) -> list[ChatConversation]:
        async with SessionFactory() as session:
            return await ChatConversation.list_for_user(
                session, member.organization_id, member.user_id
            )

    @staticmethod
    async def messages(member: OrganizationMember, conversation_id: int) -> list[ChatMessage]:
        async with SessionFactory() as session:
            await Chat._conversation(session, member, conversation_id)
            return await ChatMessage.list_for_conversation(session, conversation_id)

    @staticmethod
    async def message(
        member: OrganizationMember, conversation_id: int, message_id: int
    ) -> tuple[ChatConversation, ChatMessage, ChatMessage | None]:
        """An assistant message with its conversation and the question that preceded it."""
        async with SessionFactory() as session:
            conversation = await Chat._conversation(session, member, conversation_id)
            history = await ChatMessage.list_for_conversation(session, conversation_id)
        for index, item in enumerate(history):
            if item.id == message_id and item.role == ChatMessage.RoleEnum.ASSISTANT:
                question = history[index - 1] if index > 0 else None
                return conversation, item, question
        raise ObjectNotFoundError("Message not found")

    @staticmethod
    async def _conversation(session, member: OrganizationMember, conversation_id: int):
        conversation = await ChatConversation.get_for_user(
            session, member.organization_id, member.user_id, conversation_id
        )
        if conversation is None:
            raise ObjectNotFoundError("Conversation not found")
        return conversation

    @staticmethod
    async def prepare(member: OrganizationMember, conversation_id: int, question: str) -> Prepared:
        """Everything that must fail with a normal HTTP status before any streaming starts."""
        if len(question) > ai.max_question_chars:
            raise BadRequestError(f"Question is longer than {ai.max_question_chars} characters")
        model = llm_service.get_llm()  # 503 if the AI is not configured
        async with SessionFactory() as session:
            await Chat._conversation(session, member, conversation_id)
            recent = await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.user_id == member.user_id,
                    ChatMessage.role == ChatMessage.RoleEnum.USER,
                    ChatMessage.created_at > datetime.now(timezone.utc) - timedelta(seconds=60),
                )
            )
            if (recent or 0) >= ai.messages_per_minute:
                raise TooManyRequestsError(
                    "Too many questions, try again shortly", headers={"Retry-After": "30"}
                )
            history = await ChatMessage.list_for_conversation(session, conversation_id)
        return Prepared(member, conversation_id, question, model, history)

    @staticmethod
    async def stream(run: Prepared) -> AsyncIterator[dict]:
        """Run the pipeline, yielding a stage event whenever a stage changes, then `done`."""
        member, question = run.member, run.question
        org = member.organization_id
        trace = Trace()
        t_run = time.perf_counter()

        # 1. query analysis
        yield trace.start("query_analysis")
        tsquery = build_or_tsquery(question)
        keywords = len(tsquery.split(" | ")) if tsquery else 0
        yield trace.finish(
            "query_analysis",
            "completed" if keywords else "warning",
            f"Ключевых слов для поиска: {keywords}"
            if keywords
            else "В вопросе нет слов для поиска; будет использован только векторный поиск",
            keywords,
        )

        # 2. access control (membership was verified by the request dependency)
        yield trace.start("access_control")
        yield trace.finish(
            "access_control",
            "completed",
            f"Доступ подтверждён: участник организации, роль {member.role.value}",
        )

        # 3. retrieval: full-text and vector run concurrently
        yield trace.start("fulltext_retrieval")
        tasks: dict[str, asyncio.Task] = {
            "fulltext_retrieval": asyncio.create_task(KnowledgeBase.fulltext_ids(org, question))
        }
        if ai.vector_configured:
            yield trace.start("vector_retrieval")
            tasks["vector_retrieval"] = asyncio.create_task(KnowledgeBase.vector_ids(org, question))
        else:
            yield trace.skip(
                "vector_retrieval", "Векторный поиск не настроен: не задан ключ эмбеддингов"
            )
        yield trace.skip(
            "sql_analytics", "Хранилище данных 1С не подключено: расчёты по данным недоступны"
        )

        rankings: list[list[int]] = []
        pending = {task: name for name, task in tasks.items()}
        while pending:
            done, _ = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                name = pending.pop(task)
                label = "Полнотекстовый" if name == "fulltext_retrieval" else "Векторный"
                if task.exception() is not None:
                    yield trace.finish(name, "warning", f"{label} поиск не выполнен (ошибка)")
                else:
                    ids = task.result()
                    rankings.append(ids)
                    yield trace.finish(
                        name, "completed", f"{label} поиск: найдено {len(ids)}", len(ids)
                    )

        # 4. rerank, 5. assemble context
        yield trace.start("reranking")
        ranked = KnowledgeBase.rerank(rankings)
        yield trace.finish(
            "reranking",
            "completed" if ranked else "warning",
            f"Объединено и отобрано фрагментов: {len(ranked)}",
            len(ranked),
        )
        yield trace.start("context_assembly")
        passages: list[Passage] = await KnowledgeBase.load_passages(org, ranked)
        yield trace.finish(
            "context_assembly",
            "completed" if passages else "warning",
            f"Источников в контексте: {len(passages)}"
            if passages
            else "Подходящих документов не найдено",
            len(passages),
        )

        refusal = not passages
        sources: list[dict] = []
        model_name: str | None = None
        if refusal:
            answer = NO_CONTEXT_ANSWER
            yield trace.skip("llm_generation", "Пропущено: нет источников, модель не вызывалась")
            yield trace.skip("validation", "Пропущено: нет ответа модели")
        else:
            # 6. generation
            yield trace.start("llm_generation")
            prior = [
                {
                    "role": "user" if m.role == ChatMessage.RoleEnum.USER else "assistant",
                    "content": m.content,
                }
                for m in run.history[-HISTORY_LIMIT:]
            ]
            while prior and prior[0]["role"] != "user":
                prior.pop(0)
            prompt = f"Источники:\n{render_context(passages)}\n\nВопрос собственника: {question}"
            try:
                result = await run.model.complete(
                    SYSTEM_PROMPT, [*prior, {"role": "user", "content": prompt}]
                )
            except APIError as exc:
                yield trace.finish("llm_generation", "failed", "Модель недоступна")
                yield {
                    "type": "error",
                    "stage": "llm_generation",
                    "message": exc.detail,
                    "trace": trace.as_list(),
                }
                return
            answer, model_name = result.text, result.model
            yield trace.finish(
                "llm_generation", "completed", f"Ответ получен от модели {model_name}"
            )

            # 7. validation (deterministic checks on the answer)
            yield trace.start("validation")
            status, summary = validate_answer(answer, passages)
            yield trace.finish("validation", status, summary)

            used = set(cited_refs(answer, {p.ref for p in passages}))
            chosen = [p for p in passages if p.ref in used] or passages
            sources = [
                {
                    "ref": p.ref,
                    "document_id": p.document_id,
                    "title": p.title,
                    "snippet": p.text[:SNIPPET_CHARS],
                    "uploaded_at": p.uploaded_at,
                }
                for p in chosen
            ]

        # 8. persist and finish
        yield trace.start("final_answer")
        duration_ms = int((time.perf_counter() - t_run) * 1000)
        trace.finish("final_answer", "completed", "Ответ сформирован")
        async with SessionFactory.begin() as session:
            conversation = await Chat._conversation(session, member, run.conversation_id)
            if conversation.title == NEW_TITLE:
                conversation.title = question[:60]
                await conversation.save(session)
            user_message = await ChatMessage(
                organization_id=org,
                conversation_id=run.conversation_id,
                user_id=member.user_id,
                role=ChatMessage.RoleEnum.USER,
                content=question,
            ).save(session)
            assistant_message = await ChatMessage(
                organization_id=org,
                conversation_id=run.conversation_id,
                role=ChatMessage.RoleEnum.ASSISTANT,
                content=answer,
                sources=sources,
                refusal=refusal,
                model=model_name,
                trace=trace.as_list(),
                duration_ms=duration_ms,
            ).save(session)
        response = AnswerResponse(
            user_message=MessageResponse.model_validate(user_message),
            assistant_message=MessageResponse.model_validate(assistant_message),
        )
        yield {"type": "stage", "stage": trace.stages["final_answer"]}
        yield {"type": "done", "answer": response.model_dump(mode="json")}

    @staticmethod
    async def ask(
        member: OrganizationMember, conversation_id: int, question: str
    ) -> AnswerResponse:
        run = await Chat.prepare(member, conversation_id, question)
        async for event in Chat.stream(run):
            if event["type"] == "error":
                raise ServiceUnavailableError(event["message"])
            if event["type"] == "done":
                return AnswerResponse.model_validate(event["answer"])
        raise RuntimeError("pipeline ended without a result")

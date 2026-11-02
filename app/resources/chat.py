from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.config.ai import ai
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import ChatConversation, ChatMessage, OrganizationMember
from app.exceptions import BadRequestError, ObjectNotFoundError, TooManyRequestsError
from app.resources.knowledge import KnowledgeBase
from app.schemas.knowledge import AnswerResponse, MessageResponse
from app.services import llm as llm_service
from app.utils.rag import NO_CONTEXT_ANSWER, SYSTEM_PROMPT, cited_refs, render_context

HISTORY_LIMIT = 10
SNIPPET_CHARS = 240


class Chat:
    @staticmethod
    async def create_conversation(member: OrganizationMember) -> ChatConversation:
        async with SessionFactory.begin() as session:
            return await ChatConversation(
                organization_id=member.organization_id,
                user_id=member.user_id,
                title="Новый диалог",
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
    async def _conversation(session, member: OrganizationMember, conversation_id: int):
        conversation = await ChatConversation.get_for_user(
            session, member.organization_id, member.user_id, conversation_id
        )
        if conversation is None:
            raise ObjectNotFoundError("Conversation not found")
        return conversation

    @staticmethod
    async def ask(
        member: OrganizationMember, conversation_id: int, question: str
    ) -> AnswerResponse:
        if len(question) > ai.max_question_chars:
            raise BadRequestError(f"Question is longer than {ai.max_question_chars} characters")
        model = llm_service.get_llm()  # 503 before any work if the AI is not configured

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

        passages = await KnowledgeBase.retrieve(member.organization_id, question)
        refusal = not passages
        sources: list[dict] = []
        model_name: str | None = None
        if refusal:
            answer = NO_CONTEXT_ANSWER
        else:
            prior = [
                {
                    "role": "user" if m.role == ChatMessage.RoleEnum.USER else "assistant",
                    "content": m.content,
                }
                for m in history[-HISTORY_LIMIT:]
            ]
            while prior and prior[0]["role"] != "user":
                prior.pop(0)
            prompt = f"Источники:\n{render_context(passages)}\n\nВопрос собственника: {question}"
            result = await model.complete(
                SYSTEM_PROMPT, [*prior, {"role": "user", "content": prompt}]
            )
            answer, model_name = result.text, result.model
            used = set(cited_refs(answer, {p.ref for p in passages}))
            chosen = [p for p in passages if p.ref in used] or passages
            sources = [
                {
                    "ref": p.ref,
                    "document_id": p.document_id,
                    "title": p.title,
                    "snippet": p.text[:SNIPPET_CHARS],
                }
                for p in chosen
            ]

        async with SessionFactory.begin() as session:
            conversation = await Chat._conversation(session, member, conversation_id)
            if conversation.title == "Новый диалог":
                conversation.title = question[:60]
                await conversation.save(session)
            user_message = await ChatMessage(
                organization_id=member.organization_id,
                conversation_id=conversation_id,
                user_id=member.user_id,
                role=ChatMessage.RoleEnum.USER,
                content=question,
            ).save(session)
            assistant_message = await ChatMessage(
                organization_id=member.organization_id,
                conversation_id=conversation_id,
                role=ChatMessage.RoleEnum.ASSISTANT,
                content=answer,
                sources=sources,
                refusal=refusal,
                model=model_name,
            ).save(session)
        return AnswerResponse(
            user_message=MessageResponse.model_validate(user_message),
            assistant_message=MessageResponse.model_validate(assistant_message),
        )

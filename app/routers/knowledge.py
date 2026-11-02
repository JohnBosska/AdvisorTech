from typing import Annotated

from fastapi import APIRouter, Depends

from app.data_layer.alchemy.models import OrganizationMember
from app.dependencies.organization import get_organization_member
from app.resources.chat import Chat
from app.resources.knowledge import KnowledgeBase
from app.schemas.knowledge import (
    AIStatusResponse,
    AnswerResponse,
    ConversationResponse,
    DocumentCreateRequest,
    DocumentResponse,
    MessageCreateRequest,
    MessageResponse,
)

router = APIRouter(prefix="/organizations/{organization_id}", tags=["AI analyst"])
MemberDep = Annotated[OrganizationMember, Depends(get_organization_member)]


@router.get("/ai/status", response_model=AIStatusResponse)
async def ai_status(organization_id: int, member: MemberDep):
    return await KnowledgeBase.status(member)


@router.get("/knowledge/documents", response_model=list[DocumentResponse])
async def list_documents(organization_id: int, member: MemberDep):
    return await KnowledgeBase.list(member)


@router.post("/knowledge/documents", response_model=DocumentResponse, status_code=201)
async def add_document(organization_id: int, payload: DocumentCreateRequest, member: MemberDep):
    return await KnowledgeBase.add(member, payload)


@router.delete("/knowledge/documents/{document_id}", status_code=204)
async def delete_document(organization_id: int, document_id: int, member: MemberDep) -> None:
    await KnowledgeBase.remove(member, document_id)


@router.get("/chat/conversations", response_model=list[ConversationResponse])
async def list_conversations(organization_id: int, member: MemberDep):
    return await Chat.list_conversations(member)


@router.post("/chat/conversations", response_model=ConversationResponse, status_code=201)
async def create_conversation(organization_id: int, member: MemberDep):
    return await Chat.create_conversation(member)


@router.get("/chat/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(organization_id: int, conversation_id: int, member: MemberDep):
    return await Chat.messages(member, conversation_id)


@router.post("/chat/conversations/{conversation_id}/messages", response_model=AnswerResponse)
async def ask(
    organization_id: int, conversation_id: int, payload: MessageCreateRequest, member: MemberDep
):
    return await Chat.ask(member, conversation_id, payload.content)

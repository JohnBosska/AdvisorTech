from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.data_layer.alchemy.models import ChatMessage


class DocumentCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    char_count: int
    chunk_count: int
    vector_indexed: bool
    created_at: datetime


class AIStatusResponse(BaseModel):
    configured: bool
    model: str | None
    retrieval: str  # "hybrid" (full-text + vectors) or "fulltext"
    documents: int


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime


class SourceResponse(BaseModel):
    ref: int
    document_id: int
    title: str
    snippet: str


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: ChatMessage.RoleEnum
    content: str
    sources: list[SourceResponse]
    refusal: bool
    created_at: datetime


class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("content must not be blank")
        return value


class AnswerResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse

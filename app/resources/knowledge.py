import hashlib
import logging

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import IntegrityError

from app.config.ai import ai
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import KnowledgeChunk, KnowledgeDocument, OrganizationMember
from app.exceptions import BadRequestError, ConflictError, ObjectNotFoundError
from app.resources.organization import require_role
from app.schemas.knowledge import AIStatusResponse, DocumentCreateRequest
from app.services import embeddings
from app.utils.rag import (
    Passage,
    build_or_tsquery,
    reciprocal_rank_fusion,
    split_into_chunks,
)

logger = logging.getLogger(__name__)
Role = OrganizationMember.RoleEnum
KNOWLEDGE_MANAGER_ROLES = frozenset({Role.OWNER, Role.FINANCE})

_VECTOR_SQL = text(
    """
    SELECT c.id
    FROM knowledge_chunks c
    JOIN knowledge_documents d ON d.id = c.document_id
    WHERE c.organization_id = :org
      AND d.organization_id = :org
      AND d.is_deleted = false
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> CAST(:vec AS vector)
    LIMIT :limit
    """
)

_FTS_SQL = text(
    """
    SELECT c.id
    FROM knowledge_chunks c
    JOIN knowledge_documents d ON d.id = c.document_id
    WHERE c.organization_id = :org
      AND d.organization_id = :org
      AND d.is_deleted = false
      AND c.tsv @@ to_tsquery('russian', :q)
    ORDER BY ts_rank_cd(c.tsv, to_tsquery('russian', :q)) DESC, c.id
    LIMIT :limit
    """
)


class KnowledgeBase:
    @staticmethod
    async def status(member: OrganizationMember) -> AIStatusResponse:
        async with SessionFactory() as session:
            count = await session.scalar(
                select(func.count(KnowledgeDocument.id)).where(
                    KnowledgeDocument.organization_id == member.organization_id,
                    KnowledgeDocument.is_deleted.is_(False),
                )
            )
        return AIStatusResponse(
            configured=ai.llm_configured,
            model=ai.active_model,
            retrieval="hybrid" if ai.vector_configured else "fulltext",
            documents=count or 0,
        )

    @staticmethod
    async def list(member: OrganizationMember) -> list[KnowledgeDocument]:
        async with SessionFactory() as session:
            return await KnowledgeDocument.list_for_organization(session, member.organization_id)

    @staticmethod
    async def add(member: OrganizationMember, payload: DocumentCreateRequest) -> KnowledgeDocument:
        require_role(member, KNOWLEDGE_MANAGER_ROLES)
        content = payload.content.strip()
        if len(content) > ai.max_document_chars:
            raise BadRequestError(f"Document is longer than {ai.max_document_chars} characters")
        chunks = split_into_chunks(content)
        if not chunks:
            raise BadRequestError("Document is empty")

        try:
            async with SessionFactory.begin() as session:
                document = await KnowledgeDocument(
                    organization_id=member.organization_id,
                    title=payload.title,
                    content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
                    char_count=len(content),
                    chunk_count=len(chunks),
                    created_by_id=member.user_id,
                ).save(session)
                rows = [
                    KnowledgeChunk(
                        organization_id=member.organization_id,
                        document_id=document.id,
                        position=index,
                        text=chunk,
                    )
                    for index, chunk in enumerate(chunks)
                ]
                session.add_all(rows)
                await session.flush()
                chunk_ids = [row.id for row in rows]
        except IntegrityError as exc:
            raise ConflictError("This document is already in the knowledge base") from exc

        if ai.vector_configured:
            try:
                vectors = await embeddings.embed(chunks, input_type="document")
                async with SessionFactory.begin() as session:
                    for chunk_id, vector in zip(chunk_ids, vectors, strict=True):
                        await session.execute(
                            update(KnowledgeChunk)
                            .where(
                                KnowledgeChunk.id == chunk_id,
                                KnowledgeChunk.organization_id == member.organization_id,
                            )
                            .values(embedding=vector)
                        )
                    stored = await KnowledgeDocument.get_by_id(session, document.id)
                    stored.vector_indexed = True
                    document = await stored.save(session)
            except Exception:  # vectors are an optimisation; full-text search still works
                logger.exception("vector indexing failed for document %s", document.id)
        return document

    @staticmethod
    async def remove(member: OrganizationMember, document_id: int) -> None:
        require_role(member, KNOWLEDGE_MANAGER_ROLES)
        async with SessionFactory.begin() as session:
            result = await session.execute(
                delete(KnowledgeDocument).where(
                    KnowledgeDocument.id == document_id,
                    KnowledgeDocument.organization_id == member.organization_id,
                )
            )
            if result.rowcount == 0:
                raise ObjectNotFoundError("Document not found")

    @staticmethod
    async def retrieve(organization_id: int, question: str) -> list[Passage]:
        """Top passages for one organization: full-text, fused with vector hits when available."""
        rankings: list[list[int]] = []
        query = build_or_tsquery(question)
        async with SessionFactory() as session:
            if query:
                rows = await session.execute(
                    _FTS_SQL, {"org": organization_id, "q": query, "limit": ai.top_k * 2}
                )
                rankings.append([row[0] for row in rows])

            if ai.vector_configured:
                try:
                    vector = (await embeddings.embed([question], input_type="query"))[0]
                    rows = await session.execute(
                        _VECTOR_SQL,
                        {
                            "org": organization_id,
                            "vec": "[" + ",".join(f"{x:.7f}" for x in vector) + "]",
                            "limit": ai.top_k * 2,
                        },
                    )
                    rankings.append([row[0] for row in rows])
                except Exception:
                    logger.exception("vector search failed; using full-text results only")

            ids = reciprocal_rank_fusion([r for r in rankings if r])[: ai.top_k]
            if not ids:
                return []
            # Re-check the tenant in SQL: ids from any index are never trusted on their own.
            result = await session.execute(
                select(KnowledgeChunk, KnowledgeDocument.title)
                .join(KnowledgeDocument, KnowledgeDocument.id == KnowledgeChunk.document_id)
                .where(
                    KnowledgeChunk.id.in_(ids),
                    KnowledgeChunk.organization_id == organization_id,
                    KnowledgeDocument.organization_id == organization_id,
                    KnowledgeDocument.is_deleted.is_(False),
                )
            )
            by_id = {chunk.id: (chunk, title) for chunk, title in result.all()}
        passages: list[Passage] = []
        for chunk_id in ids:
            if chunk_id in by_id:
                chunk, title = by_id[chunk_id]
                passages.append(
                    Passage(
                        chunk_id=chunk.id,
                        document_id=chunk.document_id,
                        title=title,
                        text=chunk.text,
                        ref=len(passages) + 1,
                    )
                )
        return passages

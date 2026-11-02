"""Add the knowledge base (documents, chunks with full-text index) and chat history."""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0005_knowledge_and_chat"
down_revision = "0004_sessions_members_agents"
branch_labels = None
depends_on = None


def audit_columns():
    return [
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
    ]


def fk(column, target, *, nullable=False, ondelete="CASCADE"):
    return sa.Column(
        column, sa.Integer(), sa.ForeignKey(target, ondelete=ondelete), nullable=nullable
    )


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "knowledge_documents",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("char_count", sa.Integer(), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("vector_indexed", sa.Boolean(), nullable=False, server_default="false"),
        fk("created_by_id", "users.id", nullable=True, ondelete="SET NULL"),
        sa.UniqueConstraint("organization_id", "content_hash"),
    )
    op.create_index(
        "ix_knowledge_documents_organization_id", "knowledge_documents", ["organization_id"]
    )

    op.create_table(
        "knowledge_chunks",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        fk("document_id", "knowledge_documents.id"),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "tsv",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('russian', text)", persisted=True),
        ),
        sa.Column("embedding", Vector(1024)),
    )
    op.create_index(
        "ix_knowledge_chunks_embedding",
        "knowledge_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_index("ix_knowledge_chunks_tsv", "knowledge_chunks", ["tsv"], postgresql_using="gin")
    op.create_index(
        "ix_knowledge_chunks_org_doc", "knowledge_chunks", ["organization_id", "document_id"]
    )

    op.create_table(
        "chat_conversations",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        fk("user_id", "users.id"),
        sa.Column("title", sa.String(120), nullable=False),
    )
    op.create_index(
        "ix_chat_conversations_organization_id", "chat_conversations", ["organization_id"]
    )
    op.create_index("ix_chat_conversations_user_id", "chat_conversations", ["user_id"])

    op.create_table(
        "chat_messages",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        fk("conversation_id", "chat_conversations.id"),
        fk("user_id", "users.id", nullable=True, ondelete="SET NULL"),
        sa.Column("role", sa.Enum("USER", "ASSISTANT", name="chat_role"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("refusal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("model", sa.String(64)),
    )
    op.create_index("ix_chat_messages_conversation_id", "chat_messages", ["conversation_id"])


def downgrade():
    op.drop_table("chat_messages")
    op.drop_table("chat_conversations")
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_documents")
    sa.Enum(name="chat_role").drop(op.get_bind(), checkfirst=True)

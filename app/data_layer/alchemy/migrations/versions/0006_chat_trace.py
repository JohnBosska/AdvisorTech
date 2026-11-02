"""Store the RAG execution trace with each assistant message."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006_chat_trace"
down_revision = "0005_knowledge_and_chat"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "chat_messages",
        sa.Column("trace", postgresql.JSONB(), nullable=False, server_default="[]"),
    )
    op.add_column("chat_messages", sa.Column("duration_ms", sa.Integer()))


def downgrade():
    op.drop_column("chat_messages", "duration_ms")
    op.drop_column("chat_messages", "trace")

"""Saved BI reports (layout/format spec and a data snapshot per organization)."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_bi_reports"
down_revision = "0006_chat_trace"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "bi_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("spec", postgresql.JSONB(), nullable=False),
        sa.Column("dataset", postgresql.JSONB()),
        sa.Column("source", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_bi_reports_organization_id", "bi_reports", ["organization_id"])


def downgrade():
    op.drop_index("ix_bi_reports_organization_id", table_name="bi_reports")
    op.drop_table("bi_reports")

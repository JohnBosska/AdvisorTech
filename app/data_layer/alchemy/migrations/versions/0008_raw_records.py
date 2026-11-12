"""Raw warehouse layer: source records delivered by Connector Agents."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_raw_records"
down_revision = "0007_bi_reports"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "raw_records",
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
        sa.Column(
            "connection_id",
            sa.Integer(),
            sa.ForeignKey("source_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sync_run_id", sa.Integer(), sa.ForeignKey("sync_runs.id", ondelete="SET NULL")),
        sa.Column("entity", sa.String(64), nullable=False),
        sa.Column("record_key", sa.String(200), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "organization_id", "connection_id", "entity", "record_key", name="uq_raw_record_key"
        ),
    )
    op.create_index("ix_raw_records_organization_id", "raw_records", ["organization_id"])
    op.create_index("ix_raw_records_org_entity", "raw_records", ["organization_id", "entity"])


def downgrade():
    op.drop_index("ix_raw_records_org_entity", table_name="raw_records")
    op.drop_index("ix_raw_records_organization_id", table_name="raw_records")
    op.drop_table("raw_records")

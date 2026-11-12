"""Audit log of user actions and AI requests, per organization."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_audit_events"
down_revision = "0008_raw_records"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_events",
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
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("object_type", sa.String(64)),
        sa.Column("object_id", sa.String(120)),
        sa.Column("details", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("request_id", sa.String(64)),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_audit_events_org_id_id", "audit_events", ["organization_id", "id"])
    op.create_index("ix_audit_events_org_action", "audit_events", ["organization_id", "action"])


def downgrade():
    op.drop_index("ix_audit_events_org_action", table_name="audit_events")
    op.drop_index("ix_audit_events_org_id_id", table_name="audit_events")
    op.drop_table("audit_events")

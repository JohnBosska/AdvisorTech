"""Server-side connectors: encrypted credentials, per-entity config, schedules and cursors."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_server_connectors"
down_revision = "0009_audit_events"
branch_labels = None
depends_on = None


def audit_columns():
    return [
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
    ]


def upgrade():
    op.add_column("source_connections", sa.Column("connector_kind", sa.String(32)))
    op.add_column(
        "source_connections",
        sa.Column("entity_config", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.add_column("source_connections", sa.Column("schedule_minutes", sa.Integer()))
    op.create_table(
        "connector_credentials",
        *audit_columns(),
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
            unique=True,
        ),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("key_fingerprint", sa.String(16), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
    )
    op.create_index(
        "ix_connector_credentials_organization_id", "connector_credentials", ["organization_id"]
    )
    op.create_table(
        "sync_cursors",
        *audit_columns(),
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
        sa.Column("entity", sa.String(64), nullable=False),
        sa.Column("cursor_value", sa.String(200)),
        sa.UniqueConstraint("connection_id", "entity", name="uq_sync_cursor"),
    )


def downgrade():
    op.drop_table("sync_cursors")
    op.drop_index("ix_connector_credentials_organization_id", table_name="connector_credentials")
    op.drop_table("connector_credentials")
    op.drop_column("source_connections", "schedule_minutes")
    op.drop_column("source_connections", "entity_config")
    op.drop_column("source_connections", "connector_kind")

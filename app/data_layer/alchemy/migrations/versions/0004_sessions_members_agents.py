"""Add refresh tokens, organization invitations, agent credentials and ingestion batches."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_sessions_members_agents"
down_revision = "0003_tenants_integrations"
branch_labels = None
depends_on = None


def audit_columns():
    return [
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
    ]


def fk(column: str, target: str, *, nullable: bool = False, ondelete: str = "CASCADE"):
    return sa.Column(
        column, sa.Integer(), sa.ForeignKey(target, ondelete=ondelete), nullable=nullable
    )


def upgrade():
    op.create_table(
        "refresh_tokens",
        *audit_columns(),
        fk("user_id", "users.id"),
        sa.Column("family_id", sa.String(36), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])

    op.create_table(
        "organization_invitations",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM(
                "OWNER",
                "FINANCE",
                "ANALYST",
                "IT_ADMIN",
                name="organization_member_role",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        fk("invited_by_id", "users.id", nullable=True, ondelete="SET NULL"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_organization_invitations_organization_id",
        "organization_invitations",
        ["organization_id"],
    )

    op.create_table(
        "agent_credentials",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        fk("connection_id", "source_connections.id"),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("agent_version", sa.String(32)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_agent_credentials_organization_id", "agent_credentials", ["organization_id"]
    )
    op.create_index("ix_agent_credentials_connection_id", "agent_credentials", ["connection_id"])

    op.create_table(
        "ingestion_batches",
        *audit_columns(),
        fk("organization_id", "organizations.id"),
        fk("sync_run_id", "sync_runs.id"),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("entity", sa.String(64), nullable=False),
        sa.Column("checksum", sa.String(64)),
        sa.Column("records_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_accepted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_quarantined", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("sync_run_id", "sequence"),
    )
    op.create_index(
        "ix_ingestion_batches_organization_id", "ingestion_batches", ["organization_id"]
    )
    op.create_index("ix_ingestion_batches_sync_run_id", "ingestion_batches", ["sync_run_id"])


def downgrade():
    op.drop_table("ingestion_batches")
    op.drop_table("agent_credentials")
    op.drop_table("organization_invitations")
    op.drop_table("refresh_tokens")

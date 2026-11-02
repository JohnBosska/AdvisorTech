"""Add organizations, memberships, subscriptions, 1C connections and sync runs."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_tenants_integrations"
down_revision = "0002_email_verification"
branch_labels = None
depends_on = None


def audit_columns():
    return [
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
    ]


def org_fk():
    return sa.Column(
        "organization_id",
        sa.Integer(),
        sa.ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )


def upgrade():
    op.create_table(
        "organizations",
        *audit_columns(),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("legal_name", sa.String(255)),
        sa.Column("tax_id", sa.String(12)),
        sa.Column("reporting_currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("uses_onec", sa.Boolean()),
    )
    op.create_table(
        "organization_members",
        *audit_columns(),
        org_fk(),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "role",
            sa.Enum("OWNER", "FINANCE", "ANALYST", "IT_ADMIN", name="organization_member_role"),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "user_id"),
    )
    op.create_index(
        "ix_organization_members_organization_id", "organization_members", ["organization_id"]
    )
    op.create_index("ix_organization_members_user_id", "organization_members", ["user_id"])
    op.create_table(
        "subscriptions",
        *audit_columns(),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("plan", sa.String(32), nullable=False, server_default="PREMIUM"),
        sa.Column(
            "status",
            sa.Enum("PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", name="subscription_status"),
            nullable=False,
        ),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "source_connections",
        *audit_columns(),
        org_fk(),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "configuration",
            sa.Enum("ACCOUNTING", "TRADE_MANAGEMENT", "ERP", "OTHER", name="onec_configuration"),
            nullable=False,
        ),
        sa.Column("configuration_version", sa.String(32)),
        sa.Column(
            "source_dbms",
            sa.Enum("POSTGRESQL", "MSSQL", name="onec_source_dbms"),
            nullable=False,
        ),
        sa.Column(
            "transport",
            sa.Enum("ODATA", "HTTP_SERVICE", "EXTENSION", "FILE_EXCHANGE", name="onec_transport"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "AWAITING_AGENT",
                "CONNECTED",
                "ERROR",
                "REVOKED",
                name="source_connection_status",
            ),
            nullable=False,
        ),
        sa.Column(
            "enabled_entities",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("last_successful_sync_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_source_connections_organization_id", "source_connections", ["organization_id"]
    )
    op.create_table(
        "sync_runs",
        *audit_columns(),
        org_fk(),
        sa.Column(
            "connection_id",
            sa.Integer(),
            sa.ForeignKey("source_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "mode",
            sa.Enum("FULL", "INCREMENTAL", "RECONCILIATION", "RECOVERY", name="sync_mode"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("QUEUED", "RUNNING", "SUCCEEDED", "FAILED", name="sync_status"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("records_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_accepted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_quarantined", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.String(500)),
    )
    op.create_index("ix_sync_runs_organization_id", "sync_runs", ["organization_id"])
    op.create_index("ix_sync_runs_connection_id", "sync_runs", ["connection_id"])


def downgrade():
    op.drop_table("sync_runs")
    op.drop_table("source_connections")
    op.drop_table("subscriptions")
    op.drop_table("organization_members")
    op.drop_table("organizations")
    for enum in (
        "sync_status",
        "sync_mode",
        "source_connection_status",
        "onec_transport",
        "onec_source_dbms",
        "onec_configuration",
        "subscription_status",
        "organization_member_role",
    ):
        sa.Enum(name=enum).drop(op.get_bind(), checkfirst=True)

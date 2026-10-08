"""Create users and authentication identities."""

import sqlalchemy as sa
from alembic import op

revision = "0001_user_identities"
down_revision = None
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
    op.create_table(
        "users",
        *audit_columns(),
        sa.Column("name", sa.String(50)),
        sa.Column("phone", sa.String(32)),
        sa.Column("birthday_date", sa.Date()),
        sa.Column(
            "role",
            sa.Enum("UNVERIFIED_USER", "VERIFIED_USER", "ADMIN", name="user_role"),
            nullable=False,
        ),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_table(
        "user_emails",
        *audit_columns(),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
    )
    op.create_table(
        "user_telegrams",
        *audit_columns(),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("username", sa.String(64)),
    )


def downgrade():
    op.drop_table("user_telegrams")
    op.drop_table("user_emails")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")
    sa.Enum(name="user_role").drop(op.get_bind())

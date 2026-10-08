"""Add email ownership verification."""

import sqlalchemy as sa
from alembic import op

revision = "0002_email_verification"
down_revision = "0001_user_identities"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user_emails", sa.Column("verified_at", sa.DateTime(timezone=True)))
    op.add_column("user_emails", sa.Column("verification_code_hash", sa.String(64)))
    op.add_column("user_emails", sa.Column("verification_expires_at", sa.DateTime(timezone=True)))
    op.add_column("user_emails", sa.Column("verification_sent_at", sa.DateTime(timezone=True)))
    op.add_column(
        "user_emails",
        sa.Column("verification_attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    for column in (
        "verification_attempts",
        "verification_sent_at",
        "verification_expires_at",
        "verification_code_hash",
        "verified_at",
    ):
        op.drop_column("user_emails", column)

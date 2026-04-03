"""Create user_sessions for shared auth login (HttpOnly session cookie).

Revision ID: 025_user_sessions
Revises: 7f4d9d2a8c11
Create Date: 2026-04-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "025_user_sessions"
down_revision = "7f4d9d2a8c11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if insp.has_table("user_sessions"):
        return

    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("device_type", sa.Text(), server_default=sa.text("'desktop'"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_activity_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="user_sessions_pkey"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_sessions_user_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name="fk_user_sessions_company_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("session_token", name="uq_user_sessions_session_token"),
    )
    op.create_index("idx_sessions_user", "user_sessions", ["user_id", "is_active"], unique=False)
    op.create_index("idx_sessions_expires", "user_sessions", ["expires_at"], unique=False)
    op.create_index("idx_sessions_company", "user_sessions", ["company_id", "is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_sessions_company", table_name="user_sessions")
    op.drop_index("idx_sessions_expires", table_name="user_sessions")
    op.drop_index("idx_sessions_user", table_name="user_sessions")
    op.drop_table("user_sessions")

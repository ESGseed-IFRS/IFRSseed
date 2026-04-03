"""Add users.last_login_at and users.updated_at for shared auth update_last_login.

Revision ID: 026_users_login_ts
Revises: 025_user_sessions
Create Date: 2026-04-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "026_users_login_ts"
down_revision = "025_user_sessions"
branch_labels = None
depends_on = None


def _cols(table: str) -> set[str]:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table(table):
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    u = _cols("users")
    if not u:
        return

    if "last_login_at" not in u:
        op.add_column(
            "users",
            sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True),
        )

    if "updated_at" not in u:
        op.add_column(
            "users",
            sa.Column(
                "updated_at",
                sa.TIMESTAMP(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    u = _cols("users")
    if "last_login_at" in u:
        op.drop_column("users", "last_login_at")
    if "updated_at" in u:
        op.drop_column("users", "updated_at")

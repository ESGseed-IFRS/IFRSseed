"""Narrow users.permission CHECK to author / reviewer / viewer.

- Drops chk_user_permission (023: final_approver, esg_team, dept_user, viewer).
- Backfills legacy permission values into the new vocabulary.
- Recreates chk_user_permission with the three roles used by login seed data.

Revision ID: 024_user_permission_chk_arv
Revises: 023_users_companies_onprem
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import inspect, text

revision = "024_user_permission_chk_arv"
down_revision = "023_users_companies_onprem"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table("users"):
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "permission" not in cols:
        return

    chk = {x["name"] for x in insp.get_check_constraints("users")}
    if "chk_user_permission" in chk:
        op.drop_constraint("chk_user_permission", "users", type_="check")

    bind.execute(
        text(
            """
            UPDATE users SET permission = CASE permission
              WHEN 'final_approver' THEN 'reviewer'
              WHEN 'esg_team' THEN 'reviewer'
              WHEN 'dept_user' THEN 'author'
              WHEN 'author' THEN 'author'
              WHEN 'reviewer' THEN 'reviewer'
              WHEN 'viewer' THEN 'viewer'
              ELSE 'viewer'
            END
            """
        )
    )

    op.create_check_constraint(
        "chk_user_permission",
        "users",
        "permission IN ('author', 'reviewer', 'viewer')",
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table("users"):
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "permission" not in cols:
        return

    chk = {x["name"] for x in insp.get_check_constraints("users")}
    if "chk_user_permission" in chk:
        op.drop_constraint("chk_user_permission", "users", type_="check")

    bind.execute(
        text(
            """
            UPDATE users SET permission = CASE permission
              WHEN 'author' THEN 'dept_user'
              WHEN 'reviewer' THEN 'esg_team'
              WHEN 'viewer' THEN 'viewer'
              ELSE 'viewer'
            END
            """
        )
    )

    op.create_check_constraint(
        "chk_user_permission",
        "users",
        "permission IN ('final_approver', 'esg_team', 'dept_user', 'viewer')",
    )

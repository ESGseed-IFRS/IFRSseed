"""Add ingest_source to staging_* tables (interface / file_upload / manual).

Revision ID: 027_staging_ingest_source
Revises: 026_users_login_ts
Create Date: 2026-04-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "027_staging_ingest_source"
down_revision = "026_users_login_ts"
branch_labels = None
depends_on = None

_STAGING_TABLES = (
    "staging_ems_data",
    "staging_erp_data",
    "staging_mdg_data",
    "staging_ehs_data",
    "staging_hr_data",
    "staging_plm_data",
    "staging_srm_data",
)

# I/F 연계, 파일 업로드, 직접 입력
_INGEST_CHECK = (
    "ingest_source IS NULL OR ingest_source IN ('interface', 'file_upload', 'manual')"
)


def _cols(table: str) -> set[str]:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table(table):
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def _check_names(table: str) -> set[str]:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table(table):
        return set()
    return {x["name"] for x in insp.get_check_constraints(table)}


def upgrade() -> None:
    for table in _STAGING_TABLES:
        cols = _cols(table)
        if not cols or "ingest_source" in cols:
            continue
        op.add_column(table, sa.Column("ingest_source", sa.Text(), nullable=True))
        cname = f"chk_{table}_ingest_source"
        op.create_check_constraint(cname, table, _INGEST_CHECK)


def downgrade() -> None:
    for table in _STAGING_TABLES:
        cols = _cols(table)
        if "ingest_source" not in cols:
            continue
        cname = f"chk_{table}_ingest_source"
        if cname in _check_names(table):
            op.drop_constraint(cname, table, type_="check")
        op.drop_column(table, "ingest_source")

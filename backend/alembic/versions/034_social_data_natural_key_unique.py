"""social_data 자연키 유니크 인덱스 (company_id, data_type, period_year)

Revision ID: 034_social_data_natural_key
Revises: 033_sr_body_images_embedding
Create Date: 2026-04-02
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import inspect

revision = "034_social_data_natural_key"
down_revision = "033_sr_body_images_embedding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table("social_data"):
        return
    ix_name = "uq_social_company_type_year"
    existing = {ix["name"] for ix in insp.get_indexes("social_data")}
    if ix_name in existing:
        return
    op.create_index(
        ix_name,
        "social_data",
        ["company_id", "data_type", "period_year"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table("social_data"):
        return
    ix_name = "uq_social_company_type_year"
    existing = {ix["name"] for ix in insp.get_indexes("social_data")}
    if ix_name in existing:
        op.drop_index(ix_name, table_name="social_data")

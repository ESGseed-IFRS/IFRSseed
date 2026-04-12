"""subsidiary_data_submissions — SR DP 공시 본문 컬럼

Revision ID: 045_subsidiary_submission_sr_dp
Revises: 044_subsidiary_submissions
Create Date: 2026-04-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "045_subsidiary_submission_sr_dp"
down_revision = "044_subsidiary_submissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subsidiary_data_submissions",
        sa.Column("sr_dp_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "subsidiary_data_submissions",
        sa.Column("sr_dp_title", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "subsidiary_data_submissions",
        sa.Column("sr_narrative_text", sa.Text(), nullable=True),
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_subsidiary_sr_dp_year
        ON subsidiary_data_submissions (subsidiary_company_id, submission_year, sr_dp_id)
        WHERE sr_dp_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_subsidiary_sr_dp_year")
    op.drop_column("subsidiary_data_submissions", "sr_narrative_text")
    op.drop_column("subsidiary_data_submissions", "sr_dp_title")
    op.drop_column("subsidiary_data_submissions", "sr_dp_id")

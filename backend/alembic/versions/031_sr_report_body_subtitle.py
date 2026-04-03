"""sr_report_body: 부제목 subtitle (Text)

Revision ID: 031_sr_body_subtitle
Revises: 030_emission_factors_evidence
Create Date: 2026-04-02
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "031_sr_body_subtitle"
down_revision = "030_emission_factors_evidence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sr_report_body",
        sa.Column("subtitle", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sr_report_body", "subtitle")

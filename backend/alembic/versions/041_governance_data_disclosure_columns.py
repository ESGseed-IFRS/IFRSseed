"""governance_data: SR·공시용 이사회·위원회 텍스트·사외이사 수 컬럼

Revision ID: 041_governance_disc_cols
Revises: 040_company_info_disclosure_cols
Create Date: 2026-04-06

- data_type=board 행: 의장·대표이사명, 사외이사 수, 감사/ESG위원장 (연도별 스냅샷)
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "041_governance_disc_cols"
down_revision = "040_company_info_disclosure_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("governance_data", sa.Column("board_chairman_name", sa.Text(), nullable=True))
    op.add_column("governance_data", sa.Column("ceo_name", sa.Text(), nullable=True))
    op.add_column("governance_data", sa.Column("independent_board_members", sa.Integer(), nullable=True))
    op.add_column("governance_data", sa.Column("audit_committee_chairman", sa.Text(), nullable=True))
    op.add_column("governance_data", sa.Column("esg_committee_chairman", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("governance_data", "esg_committee_chairman")
    op.drop_column("governance_data", "audit_committee_chairman")
    op.drop_column("governance_data", "independent_board_members")
    op.drop_column("governance_data", "ceo_name")
    op.drop_column("governance_data", "board_chairman_name")

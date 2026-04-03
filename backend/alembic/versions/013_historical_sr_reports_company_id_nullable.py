"""historical_sr_reports.company_id nullable (SR 에이전트 파싱 결과 저장용)

Revision ID: 013_company_id_nullable
Revises: 012_sr_report_tables
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa

revision = '013_company_id_nullable'
down_revision = '012_sr_report_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'historical_sr_reports',
        'company_id',
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'historical_sr_reports',
        'company_id',
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )

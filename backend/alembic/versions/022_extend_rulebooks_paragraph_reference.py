"""Extend rulebooks.paragraph_reference to VARCHAR(200).

GRI 2 등 시드의 validation_rules.paragraph_reference 전체 문구가 50자를
초과하여 적재 오류가 발생함. 컬럼을 200자로 확장한다.

Revision ID: 022_rulebooks_paragraph_ref_200
Revises: 021_add_validation_rules_back
"""

from alembic import op
import sqlalchemy as sa


revision = "022_rulebooks_paragraph_ref_200"
down_revision = "021_add_validation_rules_back"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "rulebooks",
        "paragraph_reference",
        existing_type=sa.VARCHAR(length=50),
        type_=sa.String(length=200),
        existing_nullable=True,
    )


def downgrade() -> None:
    # 주의: 50자 초과 값이 있으면 다운그레이드 실패할 수 있음
    op.alter_column(
        "rulebooks",
        "paragraph_reference",
        existing_type=sa.String(length=200),
        type_=sa.VARCHAR(length=50),
        existing_nullable=True,
    )

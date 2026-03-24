"""Add related_dp_ids to rulebooks table

Revision ID: 007_add_related_dp_ids
Revises: 006_add_image_fields
Create Date: 2024-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007_add_related_dp_ids'
down_revision = '006_add_image_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # related_dp_ids 컬럼 추가 (ARRAY 타입)
    op.add_column('rulebooks', 
        sa.Column('related_dp_ids', 
                 postgresql.ARRAY(sa.String()), 
                 nullable=True))


def downgrade() -> None:
    # related_dp_ids 컬럼 제거
    op.drop_column('rulebooks', 'related_dp_ids')


"""Remove validation_rules and value_range columns from data_points

Revision ID: 011_remove_validation_rules
Revises: 010_schema_restructure
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '011_remove_validation_rules'
down_revision = '010_schema_restructure'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 먼저 validation_rules 인덱스 삭제 (컬럼 삭제 전에 인덱스 제거 필요)
    op.drop_index('idx_dp_validation_rules_gin', table_name='data_points', if_exists=True)
    
    # validation_rules 컬럼 삭제
    op.drop_column('data_points', 'validation_rules')
    
    # value_range 컬럼 삭제
    op.drop_column('data_points', 'value_range')


def downgrade() -> None:
    # 컬럼 복원
    op.add_column('data_points', 
        sa.Column('validation_rules', postgresql.JSONB(astext_type=sa.Text()), 
                  server_default='{}', nullable=True))
    op.add_column('data_points', 
        sa.Column('value_range', postgresql.JSONB(astext_type=sa.Text()), 
                  nullable=True))
    
    # 인덱스 복원
    op.create_index(
        'idx_dp_validation_rules_gin',
        'data_points',
        ['validation_rules'],
        postgresql_using='gin'
    )


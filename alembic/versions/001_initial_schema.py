"""Initial ontology schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ENUM 타입 생성
    op.execute("""
        CREATE TYPE dp_type_enum AS ENUM (
            'quantitative',
            'qualitative',
            'narrative',
            'binary'
        )
    """)
    
    op.execute("""
        CREATE TYPE dp_unit_enum AS ENUM (
            'percentage',
            'count',
            'currency_krw',
            'currency_usd',
            'tco2e',
            'mwh',
            'cubic_meter',
            'text'
        )
    """)
    
    op.execute("""
        CREATE TYPE mapping_type_enum AS ENUM (
            'exact',
            'partial',
            'aggregated',
            'derived'
        )
    """)
    
    op.execute("""
        CREATE TYPE impact_direction_enum AS ENUM (
            'positive',
            'negative',
            'neutral',
            'variable'
        )
    """)
    
    op.execute("""
        CREATE TYPE disclosure_requirement_enum AS ENUM (
            '필수',
            '권장',
            '선택'
        )
    """)
    
    # data_points 테이블
    op.create_table(
        'data_points',
        sa.Column('dp_id', sa.String(length=50), nullable=False),
        sa.Column('dp_code', sa.String(length=100), nullable=False),
        sa.Column('name_ko', sa.String(length=200), nullable=False),
        sa.Column('name_en', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('standard', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=1), nullable=False),
        sa.Column('topic', sa.String(length=100), nullable=True),
        sa.Column('subtopic', sa.String(length=100), nullable=True),
        sa.Column('dp_type', postgresql.ENUM('quantitative', 'qualitative', 'narrative', 'binary', name='dp_type_enum', create_type=False), nullable=False),
        sa.Column('unit', postgresql.ENUM('percentage', 'count', 'currency_krw', 'currency_usd', 'tco2e', 'mwh', 'cubic_meter', 'text', name='dp_unit_enum', create_type=False), nullable=True),
        sa.Column('validation_rules', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True),
        sa.Column('value_range', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('equivalent_dps', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('parent_indicator', sa.String(length=50), nullable=True),
        sa.Column('child_dps', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('financial_linkages', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('financial_impact_type', sa.String(length=50), nullable=True),
        sa.Column('disclosure_requirement', postgresql.ENUM('필수', '권장', '선택', name='disclosure_requirement_enum', create_type=False), nullable=True),
        sa.Column('reporting_frequency', sa.String(length=20), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['parent_indicator'], ['data_points.dp_id'], ),
        sa.PrimaryKeyConstraint('dp_id'),
        sa.UniqueConstraint('dp_code'),
        sa.CheckConstraint("category IN ('E', 'S', 'G')", name='chk_category')
    )
    
    # standard_mappings 테이블
    op.create_table(
        'standard_mappings',
        sa.Column('mapping_id', sa.String(length=50), nullable=False),
        sa.Column('source_standard', sa.String(length=50), nullable=False),
        sa.Column('source_dp', sa.String(length=50), nullable=False),
        sa.Column('target_standard', sa.String(length=50), nullable=False),
        sa.Column('target_dp', sa.String(length=50), nullable=False),
        sa.Column('mapping_type', postgresql.ENUM('exact', 'partial', 'aggregated', 'derived', name='mapping_type_enum', create_type=False), nullable=False),
        sa.Column('transformation_rule', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['source_dp'], ['data_points.dp_id'], ),
        sa.ForeignKeyConstraint(['target_dp'], ['data_points.dp_id'], ),
        sa.PrimaryKeyConstraint('mapping_id'),
        sa.UniqueConstraint('source_dp', 'target_dp', name='uq_source_target'),
        sa.CheckConstraint('confidence >= 0 AND confidence <= 1', name='standard_mappings_confidence_check')
    )
    
    # dp_financial_linkages 테이블
    op.create_table(
        'dp_financial_linkages',
        sa.Column('linkage_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('dp_id', sa.String(length=50), nullable=False),
        sa.Column('financial_account_code', sa.String(length=50), nullable=False),
        sa.Column('financial_account_name', sa.String(length=200), nullable=True),
        sa.Column('account_type', sa.String(length=50), nullable=True),
        sa.Column('statement_type', sa.String(length=50), nullable=True),
        sa.Column('impact_direction', postgresql.ENUM('positive', 'negative', 'neutral', 'variable', name='impact_direction_enum', create_type=False), nullable=False),
        sa.Column('impact_description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['dp_id'], ['data_points.dp_id'], ),
        sa.PrimaryKeyConstraint('linkage_id')
    )
    
    # rulebooks 테이블
    op.create_table(
        'rulebooks',
        sa.Column('rulebook_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('standard_id', sa.String(length=50), nullable=False),
        sa.Column('section_name', sa.String(length=200), nullable=False),
        sa.Column('section_content', sa.Text(), nullable=True),
        sa.Column('validation_rules', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('rulebook_id'),
        sa.UniqueConstraint('standard_id', 'section_name', name='uq_standard_section')
    )
    
    # synonyms_glossary 테이블
    op.create_table(
        'synonyms_glossary',
        sa.Column('term_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('term_ko', sa.String(length=200), nullable=False),
        sa.Column('term_en', sa.String(length=200), nullable=True),
        sa.Column('standard', sa.String(length=50), nullable=True),
        sa.Column('related_dps', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('term_id')
    )
    
    # dp_decomposition_rules 테이블
    op.create_table(
        'dp_decomposition_rules',
        sa.Column('rule_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('parent_dp_id', sa.String(length=50), nullable=False),
        sa.Column('decomposition_type', sa.String(length=50), nullable=True),
        sa.Column('child_dp_ids', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('aggregation_rule', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['parent_dp_id'], ['data_points.dp_id'], ),
        sa.PrimaryKeyConstraint('rule_id')
    )


def downgrade() -> None:
    op.drop_table('dp_decomposition_rules')
    op.drop_table('synonyms_glossary')
    op.drop_table('rulebooks')
    op.drop_table('dp_financial_linkages')
    op.drop_table('standard_mappings')
    op.drop_table('data_points')
    
    op.execute('DROP TYPE IF EXISTS disclosure_requirement_enum')
    op.execute('DROP TYPE IF EXISTS impact_direction_enum')
    op.execute('DROP TYPE IF EXISTS mapping_type_enum')
    op.execute('DROP TYPE IF EXISTS dp_unit_enum')
    op.execute('DROP TYPE IF EXISTS dp_type_enum')

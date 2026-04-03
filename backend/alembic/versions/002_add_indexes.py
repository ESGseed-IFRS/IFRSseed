"""Add indexes for performance

Revision ID: 002_add_indexes
Revises: 001_initial_schema
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_indexes'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # data_points 인덱스
    op.create_index(
        'idx_dp_standard_category',
        'data_points',
        ['standard', 'category'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    op.create_index(
        'idx_dp_parent_indicator',
        'data_points',
        ['parent_indicator'],
        postgresql_where=sa.text('is_active = TRUE AND parent_indicator IS NOT NULL')
    )
    
    op.create_index(
        'idx_dp_validation_rules_gin',
        'data_points',
        ['validation_rules'],
        postgresql_using='gin'
    )
    
    op.create_index(
        'idx_dp_equivalent_dps_gin',
        'data_points',
        ['equivalent_dps'],
        postgresql_using='gin'
    )
    
    op.create_index(
        'idx_dp_child_dps_gin',
        'data_points',
        ['child_dps'],
        postgresql_using='gin'
    )
    
    # standard_mappings 인덱스
    op.create_index(
        'idx_mappings_source_target',
        'standard_mappings',
        ['source_dp', 'target_dp', 'mapping_type'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    op.create_index(
        'idx_mappings_source_standard',
        'standard_mappings',
        ['source_standard', 'target_standard'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    # dp_financial_linkages 인덱스
    op.create_index(
        'idx_financial_linkages_dp',
        'dp_financial_linkages',
        ['dp_id'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    op.create_index(
        'idx_financial_linkages_account',
        'dp_financial_linkages',
        ['financial_account_code'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    # rulebooks 인덱스
    op.create_index(
        'idx_rulebooks_standard_section',
        'rulebooks',
        ['standard_id', 'section_name'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    op.create_index(
        'idx_rulebooks_validation_rules_gin',
        'rulebooks',
        ['validation_rules'],
        postgresql_using='gin'
    )
    
    # synonyms_glossary GIN 인덱스 (pg_trgm 확장 필요)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    
    op.create_index(
        'idx_term_ko_gin',
        'synonyms_glossary',
        ['term_ko'],
        postgresql_using='gin',
        postgresql_ops={'term_ko': 'gin_trgm_ops'}
    )
    
    op.create_index(
        'idx_term_en_gin',
        'synonyms_glossary',
        ['term_en'],
        postgresql_using='gin',
        postgresql_ops={'term_en': 'gin_trgm_ops'}
    )
    
    op.create_index(
        'idx_synonyms_related_dps_gin',
        'synonyms_glossary',
        ['related_dps'],
        postgresql_using='gin'
    )
    
    # dp_decomposition_rules 인덱스
    op.create_index(
        'idx_decomposition_parent',
        'dp_decomposition_rules',
        ['parent_dp_id'],
        postgresql_where=sa.text('is_active = TRUE')
    )
    
    op.create_index(
        'idx_decomposition_child_gin',
        'dp_decomposition_rules',
        ['child_dp_ids'],
        postgresql_using='gin'
    )


def downgrade() -> None:
    op.drop_index('idx_decomposition_child_gin', 'dp_decomposition_rules')
    op.drop_index('idx_decomposition_parent', 'dp_decomposition_rules')
    op.drop_index('idx_synonyms_related_dps_gin', 'synonyms_glossary')
    op.drop_index('idx_term_en_gin', 'synonyms_glossary')
    op.drop_index('idx_term_ko_gin', 'synonyms_glossary')
    op.drop_index('idx_rulebooks_validation_rules_gin', 'rulebooks')
    op.drop_index('idx_rulebooks_standard_section', 'rulebooks')
    op.drop_index('idx_financial_linkages_account', 'dp_financial_linkages')
    op.drop_index('idx_financial_linkages_dp', 'dp_financial_linkages')
    op.drop_index('idx_mappings_source_standard', 'standard_mappings')
    op.drop_index('idx_mappings_source_target', 'standard_mappings')
    op.drop_index('idx_dp_child_dps_gin', 'data_points')
    op.drop_index('idx_dp_equivalent_dps_gin', 'data_points')
    op.drop_index('idx_dp_validation_rules_gin', 'data_points')
    op.drop_index('idx_dp_parent_indicator', 'data_points')
    op.drop_index('idx_dp_standard_category', 'data_points')

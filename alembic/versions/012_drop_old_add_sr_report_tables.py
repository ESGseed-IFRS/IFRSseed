"""Drop disclosure_methods, document_chunks, dp_decomposition_rules, dp_financial_linkages;
   Add historical_sr_reports, sr_report_index, sr_report_body, sr_report_images

Revision ID: 012_sr_report_tables
Revises: 2d895413b8b8
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '012_sr_report_tables'
down_revision = '2d895413b8b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. 기존 4개 테이블 제거 (FK 의존 순서: 자식 먼저)
    # -------------------------------------------------------------------------
    op.drop_index(op.f('ix_disclosure_methods_unified_column_id'), table_name='disclosure_methods', if_exists=True)
    op.drop_table('disclosure_methods')

    op.execute("DROP INDEX IF EXISTS idx_document_chunks_standard_year")
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_path_type")
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_embedding")
    op.drop_table('document_chunks')

    op.drop_index(op.f('idx_decomposition_child_gin'), table_name='dp_decomposition_rules', postgresql_using='gin', if_exists=True)
    op.drop_index(op.f('idx_decomposition_parent'), table_name='dp_decomposition_rules', if_exists=True)
    op.drop_table('dp_decomposition_rules')

    op.drop_index(op.f('idx_financial_impact_embedding'), table_name='dp_financial_linkages', postgresql_using='hnsw', if_exists=True)
    op.drop_index(op.f('idx_financial_linkages_account'), table_name='dp_financial_linkages', if_exists=True)
    op.drop_index(op.f('idx_financial_linkages_dp'), table_name='dp_financial_linkages', if_exists=True)
    op.drop_table('dp_financial_linkages')

    # -------------------------------------------------------------------------
    # 2. 전년도 SR 보고서 파싱 테이블 생성 (부모 먼저)
    # -------------------------------------------------------------------------

    # historical_sr_reports - 보고서 단위 메타데이터
    op.create_table(
        'historical_sr_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('report_year', sa.Integer(), nullable=False),
        sa.Column('report_name', sa.Text(), nullable=False),
        sa.Column('pdf_file_path', sa.Text(), nullable=True),
        sa.Column('source', sa.Text(), nullable=False),
        sa.Column('total_pages', sa.Integer(), nullable=True),
        sa.Column('index_page_numbers', postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'report_year', name='uq_historical_sr_company_year')
    )
    op.create_index('idx_historical_company_year', 'historical_sr_reports', ['company_id', 'report_year'], unique=False)

    # sr_report_index - DP → 페이지 매핑
    op.create_table(
        'sr_report_index',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('index_type', sa.Text(), nullable=False),
        sa.Column('index_page_number', sa.Integer(), nullable=True),
        sa.Column('dp_id', sa.Text(), nullable=False),
        sa.Column('dp_name', sa.Text(), nullable=True),
        sa.Column('page_numbers', postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column('section_title', sa.Text(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('parsed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('parsing_method', sa.Text(), server_default='docling', nullable=True),
        sa.Column('confidence_score', sa.Numeric(5, 2), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['report_id'], ['historical_sr_reports.id'], ondelete='CASCADE')
    )
    op.create_index('idx_index_report', 'sr_report_index', ['report_id'], unique=False)
    op.create_index('idx_index_dp', 'sr_report_index', ['dp_id'], unique=False)
    op.execute("""
        CREATE INDEX idx_index_pages ON sr_report_index USING GIN (page_numbers)
    """)

    # sr_report_body - 페이지별 본문
    op.create_table(
        'sr_report_body',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=False),
        sa.Column('is_index_page', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('content_text', sa.Text(), nullable=False),
        sa.Column('content_type', sa.Text(), nullable=True),
        sa.Column('paragraphs', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('embedding_id', sa.Text(), nullable=True),
        sa.Column('embedding_status', sa.Text(), server_default='pending', nullable=True),
        sa.Column('parsed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('report_id', 'page_number', name='uq_sr_body_report_page'),
        sa.ForeignKeyConstraint(['report_id'], ['historical_sr_reports.id'], ondelete='CASCADE')
    )
    op.create_index('idx_body_report_page', 'sr_report_body', ['report_id', 'page_number'], unique=False)
    op.create_index('idx_body_embedding', 'sr_report_body', ['embedding_status'], unique=False)

    # sr_report_images - 이미지 구조화 저장
    op.create_table(
        'sr_report_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=False),
        sa.Column('image_index', sa.Integer(), nullable=True),
        sa.Column('image_file_path', sa.Text(), nullable=False),
        sa.Column('image_file_size', sa.BigInteger(), nullable=True),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('image_type', sa.Text(), nullable=True),
        sa.Column('caption_text', sa.Text(), nullable=True),
        sa.Column('caption_confidence', sa.Numeric(5, 2), nullable=True),
        sa.Column('extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('caption_embedding_id', sa.Text(), nullable=True),
        sa.Column('embedding_status', sa.Text(), server_default='pending', nullable=True),
        sa.Column('extracted_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['report_id'], ['historical_sr_reports.id'], ondelete='CASCADE')
    )
    op.create_index('idx_images_report_page', 'sr_report_images', ['report_id', 'page_number'], unique=False)
    op.create_index('idx_images_type', 'sr_report_images', ['image_type'], unique=False)
    op.create_index('idx_images_embedding', 'sr_report_images', ['embedding_status'], unique=False)


def downgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. SR 보고서 테이블 제거 (자식 먼저)
    # -------------------------------------------------------------------------
    op.drop_index('idx_images_embedding', table_name='sr_report_images')
    op.drop_index('idx_images_type', table_name='sr_report_images')
    op.drop_index('idx_images_report_page', table_name='sr_report_images')
    op.drop_table('sr_report_images')

    op.drop_index('idx_body_embedding', table_name='sr_report_body')
    op.drop_index('idx_body_report_page', table_name='sr_report_body')
    op.drop_table('sr_report_body')

    op.execute("DROP INDEX IF EXISTS idx_index_pages")
    op.drop_index('idx_index_dp', table_name='sr_report_index')
    op.drop_index('idx_index_report', table_name='sr_report_index')
    op.drop_table('sr_report_index')

    op.drop_index('idx_historical_company_year', table_name='historical_sr_reports')
    op.drop_table('historical_sr_reports')

    # -------------------------------------------------------------------------
    # 2. 기존 4개 테이블 재생성 (과거 스키마 복구)
    # -------------------------------------------------------------------------

    # dp_financial_linkages
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
        sa.Column('impact_embedding', sa.Text(), nullable=True),
        sa.Column('impact_embedding_text', sa.Text(), nullable=True),
        sa.Column('impact_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['dp_id'], ['data_points.dp_id']),
        sa.PrimaryKeyConstraint('linkage_id')
    )
    op.create_index('idx_financial_linkages_dp', 'dp_financial_linkages', ['dp_id'], unique=False, postgresql_where=sa.text('(is_active = true)'))
    op.create_index('idx_financial_linkages_account', 'dp_financial_linkages', ['financial_account_code'], unique=False, postgresql_where=sa.text('(is_active = true)'))

    # dp_decomposition_rules
    op.create_table(
        'dp_decomposition_rules',
        sa.Column('rule_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('parent_dp_id', sa.String(length=50), nullable=False),
        sa.Column('decomposition_type', sa.String(length=50), nullable=True),
        sa.Column('child_dp_ids', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('aggregation_rule', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['parent_dp_id'], ['data_points.dp_id']),
        sa.PrimaryKeyConstraint('rule_id')
    )
    op.create_index('idx_decomposition_parent', 'dp_decomposition_rules', ['parent_dp_id'], unique=False, postgresql_where=sa.text('(is_active = true)'))
    op.create_index('idx_decomposition_child_gin', 'dp_decomposition_rules', ['child_dp_ids'], unique=False, postgresql_using='gin')

    # document_chunks
    op.create_table(
        'document_chunks',
        sa.Column('chunk_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_path', sa.String(length=500), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('standard', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=100), nullable=True),
        sa.Column('fiscal_year', sa.Integer(), nullable=True),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('chunk_size', sa.Integer(), nullable=True),
        sa.Column('image_path', sa.String(length=500), nullable=True),
        sa.Column('image_description', sa.Text(), nullable=True),
        sa.Column('image_type', sa.String(length=50), nullable=True),
        sa.Column('chunk_metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True),
        sa.Column('embedding', sa.Text(), nullable=True),
        sa.Column('embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('chunk_id'),
        sa.UniqueConstraint('document_path', 'chunk_index', name='uq_document_chunk')
    )
    # embedding 컬럼은 Text로 복구됨. HNSW 인덱스는 제외 (vector 타입 필요)
    op.execute("CREATE INDEX idx_document_chunks_path_type ON document_chunks (document_path, document_type) WHERE is_active = TRUE")
    op.execute("CREATE INDEX idx_document_chunks_standard_year ON document_chunks (standard, fiscal_year) WHERE is_active = TRUE")

    # disclosure_methods
    op.create_table(
        'disclosure_methods',
        sa.Column('method_id', sa.String(length=50), nullable=False),
        sa.Column('unified_column_id', sa.String(length=50), nullable=False),
        sa.Column('template_type', sa.String(length=50), nullable=True),
        sa.Column('writing_guideline', sa.Text(), nullable=True),
        sa.Column('example_text', sa.Text(), nullable=True),
        sa.Column('required_elements', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('format_requirement', sa.Text(), nullable=True),
        sa.Column('word_limit', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('method_id'),
        sa.ForeignKeyConstraint(['unified_column_id'], ['unified_column_mappings.unified_column_id'], ondelete='CASCADE')
    )
    op.create_index('ix_disclosure_methods_unified_column_id', 'disclosure_methods', ['unified_column_id'], unique=False)

"""Add embedding columns for vector search

Revision ID: 004_add_embeddings
Revises: 003_add_soft_delete_triggers
Create Date: 2024-01-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_add_embeddings'
down_revision = '003_add_soft_delete_triggers'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector 확장 설치
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    
    # 1. data_points 테이블 - DP 메타데이터 임베딩 (필수)
    op.execute("ALTER TABLE data_points ADD COLUMN embedding vector(1024)")
    op.add_column('data_points', sa.Column('embedding_text', sa.Text(), nullable=True))
    op.add_column('data_points', sa.Column('embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True))
    
    # HNSW 인덱스 생성 (벡터 유사도 검색용)
    op.execute("""
        CREATE INDEX idx_data_points_embedding 
        ON data_points 
        USING hnsw (embedding vector_cosine_ops)
        WHERE is_active = TRUE AND embedding IS NOT NULL
    """)
    
    # 2. synonyms_glossary 테이블 - 용어 임베딩 (필수)
    op.execute("ALTER TABLE synonyms_glossary ADD COLUMN term_embedding vector(1024)")
    op.add_column('synonyms_glossary', sa.Column('term_embedding_text', sa.Text(), nullable=True))
    op.add_column('synonyms_glossary', sa.Column('term_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True))
    
    op.execute("""
        CREATE INDEX idx_synonyms_term_embedding 
        ON synonyms_glossary 
        USING hnsw (term_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND term_embedding IS NOT NULL
    """)
    
    # 3. dp_financial_linkages 테이블 - 재무 영향 설명 임베딩 (권장)
    op.execute("ALTER TABLE dp_financial_linkages ADD COLUMN impact_embedding vector(1024)")
    op.add_column('dp_financial_linkages', sa.Column('impact_embedding_text', sa.Text(), nullable=True))
    op.add_column('dp_financial_linkages', sa.Column('impact_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True))
    
    op.execute("""
        CREATE INDEX idx_financial_impact_embedding 
        ON dp_financial_linkages 
        USING hnsw (impact_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND impact_embedding IS NOT NULL
    """)
    
    # 4. rulebooks 테이블 - 섹션 내용 임베딩 (권장)
    op.execute("ALTER TABLE rulebooks ADD COLUMN section_embedding vector(1024)")
    op.add_column('rulebooks', sa.Column('section_embedding_text', sa.Text(), nullable=True))
    op.add_column('rulebooks', sa.Column('section_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True))
    
    op.execute("""
        CREATE INDEX idx_rulebooks_section_embedding 
        ON rulebooks 
        USING hnsw (section_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND section_embedding IS NOT NULL
    """)
    
    # 5. standard_mappings 테이블 - 변환 규칙 임베딩 (선택적)
    op.execute("ALTER TABLE standard_mappings ADD COLUMN mapping_embedding vector(1024)")
    op.add_column('standard_mappings', sa.Column('mapping_embedding_text', sa.Text(), nullable=True))
    op.add_column('standard_mappings', sa.Column('mapping_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True))
    
    op.execute("""
        CREATE INDEX idx_mappings_embedding 
        ON standard_mappings 
        USING hnsw (mapping_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND mapping_embedding IS NOT NULL
    """)


def downgrade() -> None:
    # 인덱스 삭제
    op.execute("DROP INDEX IF EXISTS idx_mappings_embedding")
    op.execute("DROP INDEX IF EXISTS idx_rulebooks_section_embedding")
    op.execute("DROP INDEX IF EXISTS idx_financial_impact_embedding")
    op.execute("DROP INDEX IF EXISTS idx_synonyms_term_embedding")
    op.execute("DROP INDEX IF EXISTS idx_data_points_embedding")
    
    # 컬럼 삭제
    op.drop_column('standard_mappings', 'mapping_embedding_updated_at')
    op.drop_column('standard_mappings', 'mapping_embedding_text')
    op.drop_column('standard_mappings', 'mapping_embedding')
    
    op.drop_column('rulebooks', 'section_embedding_updated_at')
    op.drop_column('rulebooks', 'section_embedding_text')
    op.drop_column('rulebooks', 'section_embedding')
    
    op.drop_column('dp_financial_linkages', 'impact_embedding_updated_at')
    op.drop_column('dp_financial_linkages', 'impact_embedding_text')
    op.drop_column('dp_financial_linkages', 'impact_embedding')
    
    op.drop_column('synonyms_glossary', 'term_embedding_updated_at')
    op.drop_column('synonyms_glossary', 'term_embedding_text')
    op.drop_column('synonyms_glossary', 'term_embedding')
    
    op.drop_column('data_points', 'embedding_updated_at')
    op.drop_column('data_points', 'embedding_text')
    op.drop_column('data_points', 'embedding')
    
    # pgvector 확장은 유지 (다른 곳에서 사용할 수 있으므로)

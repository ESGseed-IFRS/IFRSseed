"""Add document_chunks table for vector search

Revision ID: 005_add_document_chunks
Revises: 004_add_embeddings
Create Date: 2024-01-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_add_document_chunks'
down_revision = '004_add_embeddings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # document_chunks 테이블 생성
    # embedding 컬럼은 먼저 Text로 생성한 후 vector 타입으로 변경
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
        sa.Column('chunk_metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True),
        sa.Column('embedding', sa.Text(), nullable=True),  # 임시로 Text, 이후 vector로 변경
        sa.Column('embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('chunk_id'),
        sa.UniqueConstraint('document_path', 'chunk_index', name='uq_document_chunk')
    )
    
    # embedding 컬럼을 vector(1024) 타입으로 변경
    # pgvector 확장은 004_add_embeddings에서 이미 활성화됨
    op.execute("""
        ALTER TABLE document_chunks 
        ALTER COLUMN embedding TYPE vector(1024) 
        USING NULL
    """)
    
    # 벡터 검색 인덱스 생성 (HNSW - Cosine 유사도)
    op.execute("""
        CREATE INDEX idx_document_chunks_embedding 
        ON document_chunks 
        USING hnsw (embedding vector_cosine_ops)
        WHERE is_active = TRUE AND embedding IS NOT NULL
    """)
    
    # 문서 경로 및 타입 인덱스
    op.execute("""
        CREATE INDEX idx_document_chunks_path_type 
        ON document_chunks (document_path, document_type)
        WHERE is_active = TRUE
    """)
    
    # 기준서 및 회계연도 인덱스
    op.execute("""
        CREATE INDEX idx_document_chunks_standard_year 
        ON document_chunks (standard, fiscal_year)
        WHERE is_active = TRUE
    """)


def downgrade() -> None:
    # 인덱스 삭제
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_standard_year")
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_path_type")
    op.execute("DROP INDEX IF EXISTS idx_document_chunks_embedding")
    
    # 테이블 삭제
    op.drop_table('document_chunks')


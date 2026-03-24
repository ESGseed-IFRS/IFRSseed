"""Add unified_column_mappings table

Revision ID: 009_add_unified_column_mappings
Revises: 008_extend_mapping_type_enum
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_add_unified_column_mappings'
down_revision = '008_extend_mapping_type_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. ENUM 타입 생성
    # unified_column_type_enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE unified_column_type_enum AS ENUM ('quantitative', 'qualitative', 'narrative', 'binary');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # disclosure_requirement_enum (이미 존재할 수 있음)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE disclosure_requirement_enum AS ENUM ('필수', '권장', '선택');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # 2. unified_column_mappings 테이블 생성
    # embedding 컬럼은 먼저 Text로 생성한 후 vector 타입으로 변경
    op.create_table(
        'unified_column_mappings',
        sa.Column('unified_column_id', sa.String(length=50), nullable=False),
        sa.Column('column_name_ko', sa.String(length=200), nullable=False),
        sa.Column('column_name_en', sa.String(length=200), nullable=False),
        sa.Column('column_description', sa.Text(), nullable=True),
        sa.Column('column_category', sa.String(length=1), nullable=False),
        sa.Column('column_topic', sa.String(length=100), nullable=True),
        sa.Column('column_subtopic', sa.String(length=100), nullable=True),
        sa.Column('mapped_dp_ids', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('column_type', postgresql.ENUM(
            'quantitative', 'qualitative', 'narrative', 'binary',
            name='unified_column_type_enum', create_type=False
        ), nullable=False),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('validation_rules', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True),
        sa.Column('value_range', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('financial_linkages', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('financial_impact_type', sa.String(length=50), nullable=True),
        sa.Column('disclosure_requirement', postgresql.ENUM(
            '필수', '권장', '선택',
            name='disclosure_requirement_enum', create_type=False
        ), nullable=True),
        sa.Column('reporting_frequency', sa.String(length=20), nullable=True),
        sa.Column('unified_embedding', sa.Text(), nullable=True),  # 임시로 Text, 이후 vector로 변경
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('unified_column_id'),
        sa.CheckConstraint("column_category IN ('E', 'S', 'G')", name='chk_unified_column_category')
    )
    
    # 3. embedding 컬럼을 vector(1024) 타입으로 변경
    # pgvector 확장은 004_add_embeddings에서 이미 활성화됨
    op.execute("""
        ALTER TABLE unified_column_mappings 
        ALTER COLUMN unified_embedding TYPE vector(1024) 
        USING NULL
    """)
    
    # 4. 인덱스 생성
    # 벡터 검색 인덱스 (HNSW - Cosine 유사도)
    op.execute("""
        CREATE INDEX idx_unified_column_mappings_embedding 
        ON unified_column_mappings 
        USING hnsw (unified_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND unified_embedding IS NOT NULL
    """)
    
    # 카테고리 및 토픽 인덱스
    op.execute("""
        CREATE INDEX idx_unified_column_mappings_category_topic 
        ON unified_column_mappings (column_category, column_topic)
        WHERE is_active = TRUE
    """)
    
    # 매핑된 DP ID 검색용 GIN 인덱스 (배열 검색 최적화)
    op.execute("""
        CREATE INDEX idx_unified_column_mappings_dp_ids 
        ON unified_column_mappings 
        USING GIN (mapped_dp_ids)
        WHERE is_active = TRUE
    """)


def downgrade() -> None:
    # 인덱스 삭제
    op.execute("DROP INDEX IF EXISTS idx_unified_column_mappings_dp_ids")
    op.execute("DROP INDEX IF EXISTS idx_unified_column_mappings_category_topic")
    op.execute("DROP INDEX IF EXISTS idx_unified_column_mappings_embedding")
    
    # 테이블 삭제
    op.drop_table('unified_column_mappings')
    
    # ENUM 타입 삭제 (다른 테이블에서 사용 중일 수 있으므로 주의)
    # disclosure_requirement_enum은 data_points에서도 사용하므로 삭제하지 않음
    op.execute("DROP TYPE IF EXISTS unified_column_type_enum")

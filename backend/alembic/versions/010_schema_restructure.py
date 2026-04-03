"""Schema restructure - 6 table structure

제안 6개 테이블 구조로 마이그레이션:
1. standards 테이블 신규 생성
2. rulebooks 테이블 확장 (PK 타입 변경, 컬럼 추가)
3. unified_column_mappings 테이블 확장
4. disclosure_methods 테이블 신규 생성
5. glossary 테이블 신규 생성 (synonyms_glossary 데이터 이관)
6. standard_mappings 테이블 제거

Revision ID: 010_schema_restructure
Revises: 009_add_unified_column_mappings
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '010_schema_restructure'
down_revision = '009_add_unified_column_mappings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =========================================================================
    # PHASE 1: ENUM 확장
    # =========================================================================
    
    # disclosure_requirement_enum에 '조건부' 추가
    op.execute("""
        DO $$ BEGIN
            ALTER TYPE disclosure_requirement_enum ADD VALUE IF NOT EXISTS '조건부';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # =========================================================================
    # PHASE 2: data_points 인덱스 추가
    # =========================================================================
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_data_points_standard 
        ON data_points (standard) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_data_points_topic 
        ON data_points (topic) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_data_points_parent_indicator 
        ON data_points (parent_indicator) WHERE is_active = TRUE
    """)
    
    # =========================================================================
    # PHASE 3: standards 테이블 생성 (신규) - 복합 PK: 기준서당 여러 섹션 지원
    # =========================================================================
    
    op.create_table(
        'standards',
        sa.Column('standard_id', sa.String(length=50), nullable=False),
        sa.Column('section_name', sa.String(length=200), nullable=False),
        sa.Column('standard_name', sa.String(length=200), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=True),
        sa.Column('effective_date', sa.Date(), nullable=True),
        sa.Column('section_content', sa.Text(), nullable=False),
        sa.Column('section_type', sa.String(length=50), nullable=True),
        sa.Column('paragraph_reference', sa.String(length=50), nullable=True),
        sa.Column('validation_rules', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('key_terms', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('related_concepts', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('section_embedding', sa.Text(), nullable=True),
        sa.Column('section_embedding_text', sa.Text(), nullable=True),
        sa.Column('section_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('standard_id', 'section_name')
    )
    
    # embedding 컬럼을 vector(1024)로 변환
    op.execute("""
        ALTER TABLE standards 
        ALTER COLUMN section_embedding TYPE vector(1024) 
        USING NULL
    """)
    
    # 인덱스 생성
    op.execute("""
        CREATE INDEX idx_standards_section_type 
        ON standards (section_type) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX idx_standards_embedding 
        ON standards 
        USING hnsw (section_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND section_embedding IS NOT NULL
    """)
    
    # =========================================================================
    # PHASE 4: rulebooks 테이블 확장
    # =========================================================================
    
    # 4.1 새 컬럼 추가 (nullable로 먼저 추가)
    op.add_column('rulebooks', sa.Column('rulebook_id_new', sa.String(length=50), nullable=True))
    op.add_column('rulebooks', sa.Column('primary_dp_id', sa.String(length=50), nullable=True))
    op.add_column('rulebooks', sa.Column('rulebook_title', sa.String(length=300), nullable=True))
    op.add_column('rulebooks', sa.Column('rulebook_content', sa.Text(), nullable=True))
    op.add_column('rulebooks', sa.Column('paragraph_reference', sa.String(length=50), nullable=True))
    op.add_column('rulebooks', sa.Column('key_terms', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('rulebooks', sa.Column('related_concepts', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('rulebooks', sa.Column('disclosure_requirement', postgresql.ENUM(
        '필수', '권장', '선택', '조건부',
        name='disclosure_requirement_enum', create_type=False
    ), nullable=True))
    op.add_column('rulebooks', sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('rulebooks', sa.Column('version', sa.String(length=20), nullable=True))
    op.add_column('rulebooks', sa.Column('effective_date', sa.Date(), nullable=True))
    op.add_column('rulebooks', sa.Column('conflicts_with', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('rulebooks', sa.Column('mapping_notes', sa.Text(), nullable=True))
    
    # 4.2 기존 데이터 마이그레이션: section_content -> rulebook_content
    op.execute("""
        UPDATE rulebooks SET rulebook_content = section_content WHERE section_content IS NOT NULL
    """)
    
    # 4.3 rulebook_id_new 생성 (기존 Integer를 String으로 변환)
    op.execute("""
        UPDATE rulebooks 
        SET rulebook_id_new = standard_id || '_' || LPAD(rulebook_id::text, 3, '0')
    """)
    
    # 4.4 related_dp_ids에서 첫 번째 값을 primary_dp_id로 설정
    op.execute("""
        UPDATE rulebooks 
        SET primary_dp_id = related_dp_ids[1]
        WHERE related_dp_ids IS NOT NULL AND array_length(related_dp_ids, 1) > 0
    """)
    
    # 4.5 PK 변경 (Integer -> String)
    # 기존 PK 제약조건 삭제
    op.execute("ALTER TABLE rulebooks DROP CONSTRAINT IF EXISTS rulebooks_pkey")
    
    # 기존 rulebook_id 컬럼 이름 변경
    op.execute("ALTER TABLE rulebooks RENAME COLUMN rulebook_id TO rulebook_id_old")
    op.execute("ALTER TABLE rulebooks RENAME COLUMN rulebook_id_new TO rulebook_id")
    
    # 새 PK 제약조건 추가
    op.execute("ALTER TABLE rulebooks ALTER COLUMN rulebook_id SET NOT NULL")
    op.execute("ALTER TABLE rulebooks ADD PRIMARY KEY (rulebook_id)")
    
    # 4.6 기존 unique constraint 수정
    op.execute("ALTER TABLE rulebooks DROP CONSTRAINT IF EXISTS uq_standard_section")
    op.execute("""
        ALTER TABLE rulebooks 
        ADD CONSTRAINT uq_rulebook_standard_section 
        UNIQUE (standard_id, section_name)
    """)
    
    # 4.7 FK 및 인덱스 추가
    op.execute("""
        ALTER TABLE rulebooks 
        ADD CONSTRAINT fk_rulebooks_primary_dp 
        FOREIGN KEY (primary_dp_id) REFERENCES data_points(dp_id) ON DELETE SET NULL
    """)
    
    op.execute("""
        CREATE INDEX idx_rulebooks_standard_id 
        ON rulebooks (standard_id) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX idx_rulebooks_primary_dp_id 
        ON rulebooks (primary_dp_id) WHERE is_active = TRUE AND primary_dp_id IS NOT NULL
    """)
    
    # 4.8 old 컬럼 삭제
    op.drop_column('rulebooks', 'rulebook_id_old')
    op.drop_column('rulebooks', 'section_content')
    
    # =========================================================================
    # PHASE 5: unified_column_mappings 테이블 확장
    # =========================================================================
    
    op.add_column('unified_column_mappings', sa.Column('primary_standard', sa.String(length=50), nullable=True))
    op.add_column('unified_column_mappings', sa.Column('primary_rulebook_id', sa.String(length=50), nullable=True))
    op.add_column('unified_column_mappings', sa.Column('applicable_standards', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('unified_column_mappings', sa.Column('mapping_confidence', sa.Float(), nullable=True))
    op.add_column('unified_column_mappings', sa.Column('mapping_notes', sa.Text(), nullable=True))
    op.add_column('unified_column_mappings', sa.Column('rulebook_conflicts', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    
    # FK 추가
    op.execute("""
        ALTER TABLE unified_column_mappings 
        ADD CONSTRAINT fk_ucm_primary_rulebook 
        FOREIGN KEY (primary_rulebook_id) REFERENCES rulebooks(rulebook_id) ON DELETE SET NULL
    """)
    
    # 인덱스 추가
    op.execute("""
        CREATE INDEX idx_ucm_primary_standard 
        ON unified_column_mappings (primary_standard) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX idx_ucm_primary_rulebook 
        ON unified_column_mappings (primary_rulebook_id) 
        WHERE is_active = TRUE AND primary_rulebook_id IS NOT NULL
    """)
    
    # =========================================================================
    # PHASE 6: disclosure_methods 테이블 생성 (신규)
    # =========================================================================
    
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
    
    # 인덱스 생성
    op.execute("""
        CREATE INDEX idx_disclosure_methods_unified_column 
        ON disclosure_methods (unified_column_id) WHERE is_active = TRUE
    """)
    
    # =========================================================================
    # PHASE 7: glossary 테이블 생성 (synonyms_glossary 대체)
    # =========================================================================
    
    op.create_table(
        'glossary',
        sa.Column('term_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('term_ko', sa.String(length=200), nullable=False),
        sa.Column('term_en', sa.String(length=200), nullable=True),
        sa.Column('definition_ko', sa.Text(), nullable=True),
        sa.Column('definition_en', sa.Text(), nullable=True),
        sa.Column('standard', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('related_dps', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('related_terms', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('source', sa.String(length=200), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('term_embedding', sa.Text(), nullable=True),
        sa.Column('term_embedding_text', sa.Text(), nullable=True),
        sa.Column('term_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('term_id'),
        sa.UniqueConstraint('term_ko', name='uq_glossary_term_ko')
    )
    
    # embedding 컬럼을 vector(1024)로 변환
    op.execute("""
        ALTER TABLE glossary 
        ALTER COLUMN term_embedding TYPE vector(1024) 
        USING NULL
    """)
    
    # synonyms_glossary 데이터를 glossary로 이관
    op.execute("""
        INSERT INTO glossary (
            term_ko, term_en, standard, related_dps, 
            is_active, created_at,
            term_embedding, term_embedding_text, term_embedding_updated_at
        )
        SELECT 
            term_ko, term_en, standard, related_dps,
            is_active, created_at,
            term_embedding, term_embedding_text, term_embedding_updated_at
        FROM synonyms_glossary
    """)
    
    # 인덱스 생성
    op.execute("""
        CREATE INDEX idx_glossary_standard 
        ON glossary (standard) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX idx_glossary_embedding 
        ON glossary 
        USING hnsw (term_embedding vector_cosine_ops)
        WHERE is_active = TRUE AND term_embedding IS NOT NULL
    """)
    
    # =========================================================================
    # PHASE 8: 기존 테이블 제거
    # =========================================================================
    
    # standard_mappings 테이블 제거
    op.execute("DROP TABLE IF EXISTS standard_mappings CASCADE")
    
    # mapping_type_enum 제거 (더 이상 사용하지 않음)
    op.execute("DROP TYPE IF EXISTS mapping_type_enum CASCADE")


def downgrade() -> None:
    # 역순으로 롤백
    
    # PHASE 8 역순: standard_mappings 테이블 복구
    op.execute("""
        CREATE TYPE mapping_type_enum AS ENUM (
            'exact', 'partial', 'aggregated', 'derived', 'no_mapping', 'pending', 'auto_suggested'
        )
    """)
    
    op.create_table(
        'standard_mappings',
        sa.Column('mapping_id', sa.String(length=50), nullable=False),
        sa.Column('source_standard', sa.String(length=50), nullable=False),
        sa.Column('source_dp', sa.String(length=50), nullable=False),
        sa.Column('target_standard', sa.String(length=50), nullable=False),
        sa.Column('target_dp', sa.String(length=50), nullable=False),
        sa.Column('mapping_type', postgresql.ENUM(
            'exact', 'partial', 'aggregated', 'derived', 'no_mapping', 'pending', 'auto_suggested',
            name='mapping_type_enum', create_type=False
        ), nullable=False),
        sa.Column('transformation_rule', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('mapping_embedding', sa.Text(), nullable=True),
        sa.Column('mapping_embedding_text', sa.Text(), nullable=True),
        sa.Column('mapping_embedding_updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('mapping_id'),
        sa.ForeignKeyConstraint(['source_dp'], ['data_points.dp_id']),
        sa.ForeignKeyConstraint(['target_dp'], ['data_points.dp_id']),
        sa.UniqueConstraint('source_dp', 'target_dp', name='uq_source_target')
    )
    
    # PHASE 7 역순: glossary 테이블 제거
    op.execute("DROP INDEX IF EXISTS idx_glossary_embedding")
    op.execute("DROP INDEX IF EXISTS idx_glossary_standard")
    op.drop_table('glossary')
    
    # PHASE 6 역순: disclosure_methods 테이블 제거
    op.execute("DROP INDEX IF EXISTS idx_disclosure_methods_unified_column")
    op.drop_table('disclosure_methods')
    
    # PHASE 5 역순: unified_column_mappings 컬럼 제거
    op.execute("DROP INDEX IF EXISTS idx_ucm_primary_rulebook")
    op.execute("DROP INDEX IF EXISTS idx_ucm_primary_standard")
    op.execute("ALTER TABLE unified_column_mappings DROP CONSTRAINT IF EXISTS fk_ucm_primary_rulebook")
    op.drop_column('unified_column_mappings', 'rulebook_conflicts')
    op.drop_column('unified_column_mappings', 'mapping_notes')
    op.drop_column('unified_column_mappings', 'mapping_confidence')
    op.drop_column('unified_column_mappings', 'applicable_standards')
    op.drop_column('unified_column_mappings', 'primary_rulebook_id')
    op.drop_column('unified_column_mappings', 'primary_standard')
    
    # PHASE 4 역순: rulebooks PK 타입 복구는 복잡하므로 skip (수동 처리 필요)
    # 실제 운영에서는 주의 필요
    
    # PHASE 3 역순: standards 테이블 제거
    op.execute("DROP INDEX IF EXISTS idx_standards_embedding")
    op.execute("DROP INDEX IF EXISTS idx_standards_section_type")
    op.drop_table('standards')
    
    # PHASE 2 역순: data_points 인덱스 제거
    op.execute("DROP INDEX IF EXISTS idx_data_points_parent_indicator")
    op.execute("DROP INDEX IF EXISTS idx_data_points_topic")
    op.execute("DROP INDEX IF EXISTS idx_data_points_standard")

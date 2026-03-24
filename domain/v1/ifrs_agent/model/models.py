"""온톨로지 데이터베이스 모델 (제안 6개 테이블 구조)"""
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, 
    TIMESTAMP, ForeignKey, CheckConstraint, UniqueConstraint,
    ARRAY, Date
)
from sqlalchemy.dialects.postgresql import JSONB, ENUM as PG_ENUM
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ifrs_agent.database.base import Base

# pgvector 지원 (Vector 타입)
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None

# ENUM 타입 정의
from enum import Enum as PyEnum

class DPTypeEnum(str, PyEnum):
    QUANTITATIVE = "quantitative"
    QUALITATIVE = "qualitative"
    NARRATIVE = "narrative"
    BINARY = "binary"

class DPUnitEnum(str, PyEnum):
    PERCENTAGE = "percentage"
    COUNT = "count"
    CURRENCY_KRW = "currency_krw"
    CURRENCY_USD = "currency_usd"
    TCO2E = "tco2e"
    MWH = "mwh"
    CUBIC_METER = "cubic_meter"
    TEXT = "text"

class ImpactDirectionEnum(str, PyEnum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    VARIABLE = "variable"

class DisclosureRequirementEnum(str, PyEnum):
    REQUIRED = "필수"
    RECOMMENDED = "권장"
    OPTIONAL = "선택"
    CONDITIONAL = "조건부"


# =============================================================================
# 1. DataPoint (data_points) - 기존 유지 + 인덱스 추가
# =============================================================================
class DataPoint(Base):
    """Data Point 테이블"""
    __tablename__ = "data_points"
    
    # 식별자
    dp_id = Column(String(50), primary_key=True)
    dp_code = Column(String(100), nullable=False, unique=True)
    
    # 메타 정보
    name_ko = Column(String(200), nullable=False)
    name_en = Column(String(200), nullable=False)
    description = Column(Text)
    
    # 분류
    standard = Column(String(50), nullable=False, index=True)
    category = Column(String(1), nullable=False)
    topic = Column(String(100), index=True)
    subtopic = Column(String(100))
    
    # 데이터 타입 (ENUM)
    dp_type = Column(
        PG_ENUM('quantitative', 'qualitative', 'narrative', 'binary', 
                name="dp_type_enum", create_type=False),
        nullable=False
    )
    unit = Column(
        PG_ENUM('percentage', 'count', 'currency_krw', 'currency_usd', 
                'tco2e', 'mwh', 'cubic_meter', 'text',
                name="dp_unit_enum", create_type=False),
        nullable=True
    )
    
    # 매핑 정보
    equivalent_dps = Column(ARRAY(String))
    parent_indicator = Column(
        String(50),
        ForeignKey("data_points.dp_id"),
        nullable=True,
        index=True
    )
    child_dps = Column(ARRAY(String))
    
    # 재무 연결
    financial_linkages = Column(ARRAY(String))
    financial_impact_type = Column(String(50))
    
    # 공시 요구사항
    disclosure_requirement = Column(
        PG_ENUM('필수', '권장', '선택', '조건부',
                name="disclosure_requirement_enum", create_type=False),
        nullable=True
    )
    reporting_frequency = Column(String(20))
    
    # Soft Delete
    is_active = Column(Boolean, default=True, server_default="true")
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    deleted_by = Column(String(100), nullable=True)
    
    # 타임스탬프
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # 임베딩 (Vector Search용)
    embedding = Column(Vector(1024) if Vector else Text, nullable=True)
    embedding_text = Column(Text, nullable=True)
    embedding_updated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # 관계
    parent = relationship(
        "DataPoint",
        remote_side=[dp_id],
        backref="children"
    )
    
    # 제약조건
    __table_args__ = (
        CheckConstraint("category IN ('E', 'S', 'G')", name="chk_category"),
    )


# =============================================================================
# 2. Standard (standards) - 기준서당 여러 섹션 지원
# =============================================================================
class Standard(Base):
    """기준서 테이블 (목적, 적용 범위, 일반 요구사항 등 섹션별 row)"""
    __tablename__ = "standards"
    
    # 복합 PK: 기준서당 여러 섹션(목적/범위/일반요구사항 등) 각각 1 row
    standard_id = Column(String(50), primary_key=True)   # 예: "IFRS_S2", "GRI"
    section_name = Column(String(200), primary_key=True)  # 예: "목적", "적용범위", "일반요구사항"
    
    standard_name = Column(String(200), nullable=False)
    version = Column(String(20))
    effective_date = Column(Date)
    
    section_content = Column(Text, nullable=False)
    section_type = Column(String(50))   # "objective", "scope", "general_requirements"
    paragraph_reference = Column(String(50))
    
    validation_rules = Column(JSONB)
    key_terms = Column(ARRAY(String))
    related_concepts = Column(ARRAY(String))
    
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    section_embedding = Column(Vector(1024) if Vector else Text, nullable=True)
    section_embedding_text = Column(Text, nullable=True)
    section_embedding_updated_at = Column(TIMESTAMP(timezone=True), nullable=True)


# =============================================================================
# 3. Rulebook (rulebooks) - 확장
# =============================================================================
class Rulebook(Base):
    """Rulebook 테이블 (기준서별 공시 요구사항 상세)"""
    __tablename__ = "rulebooks"
    
    # PK: VARCHAR(200)으로 확장 (긴 section_name 지원)
    rulebook_id = Column(String(200), primary_key=True)  # 예: "S2_governance_01"
    
    # 기준서 연결
    standard_id = Column(String(50), nullable=False, index=True)  # "IFRS_S2", "GRI" 등
    
    # 대표 DP 연결 (핵심 FK)
    primary_dp_id = Column(
        String(50),
        ForeignKey("data_points.dp_id", ondelete="SET NULL"),
        nullable=True,  # 점진적 보강을 위해 nullable
        index=True
    )
    
    # 섹션 정보
    section_name = Column(String(200), nullable=False)
    rulebook_title = Column(String(300))  # 규칙 제목
    rulebook_content = Column(Text)  # 규칙 내용 (기존 section_content)
    paragraph_reference = Column(String(50))  # 예: "29(a)", "15(b)(i)"
    
    # 검증 규칙 및 관련 정보
    validation_rules = Column(JSONB)
    key_terms = Column(ARRAY(String))
    related_concepts = Column(ARRAY(String))
    
    # 데이터 포인트 매핑
    related_dp_ids = Column(ARRAY(String), nullable=True)  # 관련 DP ID 목록
    
    # 공시 요구사항
    disclosure_requirement = Column(
        PG_ENUM('필수', '권장', '선택', '조건부',
                name="disclosure_requirement_enum", create_type=False),
        nullable=True
    )
    is_primary = Column(Boolean, default=False)  # 주요 요구사항 여부
    
    # 버전 및 충돌 관리
    version = Column(String(20))
    effective_date = Column(Date)
    conflicts_with = Column(ARRAY(String))  # 충돌하는 다른 rulebook_id들
    mapping_notes = Column(Text)  # 매핑 관련 메모
    
    # Soft Delete
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # 임베딩 (섹션 내용 검색용)
    section_embedding = Column(Vector(1024) if Vector else Text, nullable=True)
    section_embedding_text = Column(Text, nullable=True)
    section_embedding_updated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # 관계
    primary_data_point = relationship("DataPoint", backref="primary_rulebooks")
    
    # 제약조건
    __table_args__ = (
        UniqueConstraint("standard_id", "section_name", name="uq_rulebook_standard_section"),
    )


# =============================================================================
# 4. UnifiedColumnMapping (unified_column_mappings) - 확장
# =============================================================================
class UnifiedColumnMapping(Base):
    """통합 컬럼 매핑 테이블"""
    __tablename__ = "unified_column_mappings"
    
    # 식별자 및 기본 정보
    unified_column_id = Column(String(50), primary_key=True)  # 예: "001_aa", "002_ab"
    column_name_ko = Column(String(200), nullable=False)
    column_name_en = Column(String(200), nullable=False)
    column_description = Column(Text)
    
    # 분류 정보
    column_category = Column(String(1), nullable=False)  # 'E', 'S', 'G'
    column_topic = Column(String(100))
    column_subtopic = Column(String(100))
    
    # 기준서/Rulebook 연결 (신규)
    primary_standard = Column(String(50), index=True)  # "IFRS_S2", "GRI" 등
    primary_rulebook_id = Column(
        String(50),
        ForeignKey("rulebooks.rulebook_id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    applicable_standards = Column(ARRAY(String))  # ["IFRS_S2", "GRI", "TCFD"]
    
    # 매핑 정보 (핵심)
    mapped_dp_ids = Column(ARRAY(String), nullable=False)  # 여러 기준서의 DP 배열
    
    # 매핑 품질 관리 (신규)
    mapping_confidence = Column(Float)  # 0.0 ~ 1.0
    mapping_notes = Column(Text)
    rulebook_conflicts = Column(JSONB)  # 기준서간 충돌 정보
    
    # 데이터 타입 정보
    column_type = Column(
        PG_ENUM('quantitative', 'qualitative', 'narrative', 'binary', 
                name="unified_column_type_enum", create_type=False),
        nullable=False
    )
    unit = Column(String(50))
    
    # 검증 규칙
    validation_rules = Column(JSONB, default={}, server_default="{}")
    value_range = Column(JSONB)
    
    # 재무 연결
    financial_linkages = Column(ARRAY(String))
    financial_impact_type = Column(String(50))
    
    # 공시 요구사항
    disclosure_requirement = Column(
        PG_ENUM('필수', '권장', '선택', '조건부',
                name="disclosure_requirement_enum", create_type=False),
        nullable=True
    )
    reporting_frequency = Column(String(20))
    
    # 임베딩 (벡터 검색용)
    unified_embedding = Column(Vector(1024) if Vector else Text, nullable=True)
    
    # 메타데이터
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # 관계
    primary_rulebook = relationship("Rulebook", backref="unified_mappings")
    
    # 제약조건
    __table_args__ = (
        CheckConstraint("column_category IN ('E', 'S', 'G')", name="chk_unified_column_category"),
    )


# =============================================================================
# 5. Glossary (glossary) - 기존 SynonymGlossary 확장
# =============================================================================
class Glossary(Base):
    """용어집 테이블 (독립 참조)"""
    __tablename__ = "glossary"
    
    term_id = Column(Integer, primary_key=True, autoincrement=True)
    term_ko = Column(String(200), nullable=False, unique=True)
    term_en = Column(String(200))
    
    # 정의 (신규)
    definition_ko = Column(Text)
    definition_en = Column(Text)
    
    # 분류
    standard = Column(String(50), index=True)  # 기준서
    category = Column(String(50))  # 용어 카테고리
    
    # 관련 정보
    related_dps = Column(ARRAY(String))
    related_terms = Column(ARRAY(String))  # 관련 용어 ID들
    source = Column(String(200))  # 출처
    
    # Soft Delete
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # 임베딩 (용어 검색용)
    term_embedding = Column(Vector(1024) if Vector else Text, nullable=True)
    term_embedding_text = Column(Text, nullable=True)
    term_embedding_updated_at = Column(TIMESTAMP(timezone=True), nullable=True)


# =============================================================================
# 하위 호환성을 위한 별칭 (Deprecated)
# =============================================================================
SynonymGlossary = Glossary  # 기존 코드 호환성

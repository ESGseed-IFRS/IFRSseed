# 데이터 구조 및 온톨로지 설계

## 📚 관련 문서

이 문서를 읽기 전/후에 다음 문서를 함께 참고하세요:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처 이해
- [NODES.md](./NODES.md) - 노드별 구현 및 DP 활용 방법
- [DATA_COLLECTION.md](./DATA_COLLECTION.md) - 데이터 수집 전략
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 구현 가이드

---

## 1. 온톨로지 개요

### 1.1 목적

ESG 지표 온톨로지는 다양한 기준서(IFRS, GRI, SASB, TCFD, ESRS, KCGS, MSCI)의 지표를 **통합·매핑·중복 제거**하기 위한 구조화된 지식 체계입니다.

**핵심 기능**:
- 지표 간 관계 정의 (동일, 유사, 상위/하위)
- Data Point(DP) 단위 분해
- 기준서 간 매핑 (GRI → IFRS 전환)
- 재무 연결성 정의

### 1.2 설계 원칙

| 원칙 | 설명 |
|------|------|
| **DP 중심** | 모든 지표는 최소 단위인 Data Point로 분해 |
| **중복 제거** | 동일 의미의 지표는 하나로 통합 |
| **계층 구조** | 카테고리 → 지표 → DP 3단계 계층 |
| **재무 연결** | 모든 DP는 재무제표 항목과 연결 가능 |
| **확장성** | 새 기준서 추가 시 매핑만 추가 |

---

## 2. 온톨로지 구조

### 2.1 클래스 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESG Ontology                             │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   Standard    │      │   Category    │      │  Financial    │
│   (기준서)    │      │   (카테고리)  │      │   Account     │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        │              ┌───────┴───────┐              │
        │              │               │              │
        ▼              ▼               ▼              │
┌───────────────┐ ┌─────────┐  ┌─────────────┐       │
│   Indicator   │ │  Topic  │  │  Subtopic   │       │
│   (지표)      │ │ (주제)  │  │ (세부주제)  │       │
└───────┬───────┘ └─────────┘  └─────────────┘       │
        │                                             │
        ▼                                             │
┌───────────────────────────────────────────────────┐│
│              Data Point (DP)                       ││
│         (최소 공시 단위)                           │◀┘
└───────────────────────────────────────────────────┘
```

### 2.2 RDF/OWL 스키마

```turtle
@prefix esg: <http://esg-ontology.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# 클래스 정의
esg:Standard a owl:Class ;
    rdfs:label "공시 기준서" ;
    rdfs:comment "IFRS, GRI, SASB 등 공시 기준서" .

esg:Category a owl:Class ;
    rdfs:label "ESG 카테고리" ;
    rdfs:comment "Environment, Social, Governance" .

esg:Indicator a owl:Class ;
    rdfs:label "ESG 지표" ;
    rdfs:comment "기준서별 개별 지표" .

esg:DataPoint a owl:Class ;
    rdfs:label "데이터 포인트" ;
    rdfs:comment "지표의 최소 공시 단위" .

esg:FinancialAccount a owl:Class ;
    rdfs:label "재무 계정" ;
    rdfs:comment "재무제표 연결 항목" .

# 관계 정의
esg:belongsToStandard a owl:ObjectProperty ;
    rdfs:domain esg:Indicator ;
    rdfs:range esg:Standard .

esg:hasDataPoint a owl:ObjectProperty ;
    rdfs:domain esg:Indicator ;
    rdfs:range esg:DataPoint .

esg:mapsTo a owl:ObjectProperty ;
    rdfs:domain esg:DataPoint ;
    rdfs:range esg:DataPoint ;
    rdfs:comment "다른 기준서의 DP와 매핑" .

esg:linkedToFinancial a owl:ObjectProperty ;
    rdfs:domain esg:DataPoint ;
    rdfs:range esg:FinancialAccount .

esg:equivalentTo a owl:ObjectProperty ;
    rdfs:domain esg:DataPoint ;
    rdfs:range esg:DataPoint ;
    owl:symmetricProperty true ;
    rdfs:comment "동일 의미의 DP" .
```

---

## 3. Data Point (DP) 설계

### 3.1 DP 스키마

```python
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
from enum import Enum

class DPType(str, Enum):
    QUANTITATIVE = "quantitative"    # 정량 데이터
    QUALITATIVE = "qualitative"      # 정성 데이터
    BINARY = "binary"                # 예/아니오
    NARRATIVE = "narrative"          # 서술형

class DPUnit(str, Enum):
    PERCENTAGE = "percentage"
    COUNT = "count"
    CURRENCY_KRW = "currency_krw"
    CURRENCY_USD = "currency_usd"
    TCO2E = "tco2e"                   # 톤 CO2 환산
    MWH = "mwh"                       # 메가와트시
    CUBIC_METER = "cubic_meter"      # 입방미터
    TEXT = "text"

class DataPoint(BaseModel):
    """Data Point 스키마"""
    
    # 식별자
    dp_id: str                        # 예: "IFRS-S2-15-a"
    dp_code: str                      # 표준 코드
    
    # 메타 정보
    name_ko: str                      # 한국어 명칭
    name_en: str                      # 영어 명칭
    description: str                  # 상세 설명
    
    # 분류
    standard: str                     # 기준서 (IFRS_S1, GRI, etc.)
    category: Literal["E", "S", "G"]  # ESG 카테고리
    topic: str                        # 주제 (기후, 인권, 지배구조 등)
    subtopic: Optional[str]           # 세부 주제
    
    # 데이터 타입
    dp_type: DPType
    unit: Optional[DPUnit]
    
    # 검증 규칙
    validation_rules: List[str]
    value_range: Optional[Dict[str, float]]  # {"min": 0, "max": 100}
    
    # 매핑 정보
    equivalent_dps: List[str]         # 동일 의미 DP ID 목록
    parent_indicator: str             # 상위 지표 ID
    child_dps: List[str]              # 하위 DP ID 목록
    
    # 재무 연결
    financial_linkages: List[str]     # 연결된 재무 계정
    financial_impact_type: Optional[str]  # 수익/비용/자산/부채
    
    # 공시 요구사항
    disclosure_requirement: str       # 필수/권장/선택
    reporting_frequency: str          # 연간/반기/분기
```

### 3.2 DP 분해 예시

**예시: 임직원 현황 지표 분해**

```
┌─────────────────────────────────────────────────────────────┐
│  Indicator: 임직원 현황 (GRI 2-7)                            │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ DP: 총 임직원 │   │ DP: 성별 현황 │   │ DP: 고용 형태 │
│     수        │   │               │   │               │
└───────────────┘   └───────┬───────┘   └───────┬───────┘
                            │                   │
                    ┌───────┴───────┐   ┌───────┴───────┐
                    │               │   │               │
                    ▼               ▼   ▼               ▼
              ┌─────────┐   ┌─────────┐ ┌─────────┐ ┌─────────┐
              │ 남성 수 │   │ 여성 수 │ │ 정규직  │ │ 비정규직│
              └─────────┘   └─────────┘ └─────────┘ └─────────┘
```

**Python 구현:**

```python
# 임직원 현황 DP 분해
employee_dps = [
    DataPoint(
        dp_id="GRI-2-7-a",
        dp_code="GRI_2_7_TOTAL",
        name_ko="총 임직원 수",
        name_en="Total number of employees",
        description="보고 기간 말 기준 총 임직원 수",
        standard="GRI",
        category="S",
        topic="고용",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.COUNT,
        validation_rules=["value >= 0", "value <= 10000000"],
        value_range={"min": 0, "max": 10000000},
        equivalent_dps=["SASB-HC-101-a", "ESRS-S1-6"],
        parent_indicator="GRI-2-7",
        child_dps=["GRI-2-7-a-1", "GRI-2-7-a-2"],
        financial_linkages=["인건비", "복리후생비"],
        financial_impact_type="비용",
        disclosure_requirement="필수",
        reporting_frequency="연간"
    ),
    DataPoint(
        dp_id="GRI-2-7-a-1",
        dp_code="GRI_2_7_MALE",
        name_ko="남성 임직원 수",
        name_en="Number of male employees",
        description="보고 기간 말 기준 남성 임직원 수",
        standard="GRI",
        category="S",
        topic="고용",
        subtopic="성별 다양성",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.COUNT,
        validation_rules=["value >= 0", "value <= parent_value"],
        parent_indicator="GRI-2-7",
        child_dps=[],
        financial_linkages=["인건비"],
        disclosure_requirement="필수",
        reporting_frequency="연간"
    ),
    DataPoint(
        dp_id="GRI-2-7-a-2",
        dp_code="GRI_2_7_FEMALE",
        name_ko="여성 임직원 수",
        name_en="Number of female employees",
        description="보고 기간 말 기준 여성 임직원 수",
        standard="GRI",
        category="S",
        topic="고용",
        subtopic="성별 다양성",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.COUNT,
        validation_rules=["value >= 0", "value <= parent_value"],
        parent_indicator="GRI-2-7",
        child_dps=[],
        financial_linkages=["인건비"],
        disclosure_requirement="필수",
        reporting_frequency="연간"
    )
]
```

---

## 4. 통합 컬럼 매핑 (Unified Column Mapping)

### 4.1 통합 컬럼 매핑 테이블 구조

여러 기준서의 동일한 의미를 가진 Data Point들을 하나의 통합 컬럼으로 묶어 관리하는 구조입니다. 기준서에 종속되지 않고 중립적인 통합 컬럼을 중심으로 매핑을 관리합니다.

#### SQL 스키마

**최소 필수 컬럼 구성 (IFRSSEED 에이전트 구현 기준)**

```sql
CREATE TABLE unified_column_mappings (
    -- 식별자 및 기본 정보
    unified_column_id VARCHAR(50) PRIMARY KEY,  -- 예: "001_aa", "002_ab"
    column_name_ko VARCHAR(200) NOT NULL,
    column_name_en VARCHAR(200) NOT NULL,
    column_description TEXT,  -- 통합 컬럼 상세 설명
    
    -- 분류 정보 (선택적, 조인 없이 빠른 조회를 위해 유지)
    column_category CHAR(1) NOT NULL CHECK (column_category IN ('E', 'S', 'G')),
    column_topic VARCHAR(100),
    column_subtopic VARCHAR(100),
    
    -- 매핑 정보 (핵심)
    mapped_dp_ids TEXT[] NOT NULL,  -- 여러 기준서의 DP 배열
    
    -- 데이터 타입 정보 (선택적, 조인 없이 빠른 조회를 위해 유지)
    column_type VARCHAR(20) NOT NULL CHECK (column_type IN ('quantitative', 'qualitative', 'narrative', 'binary')),
    unit VARCHAR(50),
    
    -- 검증 규칙 (IFRSSEED 에이전트 구현용)
    validation_rules JSONB DEFAULT '{}',  -- 검증 규칙 (Supervisor 검증용)
    value_range JSONB,  -- 값의 범위 (Supervisor 검증용)
    
    -- 재무 연결 (IFRSSEED 에이전트 구현용)
    financial_linkages TEXT[],  -- 재무 계정 연결 배열 (Gen Node 재무 영향 문단 생성용)
    financial_impact_type VARCHAR(50),  -- 재무 영향 타입 (positive, negative, neutral)
    
    -- 공시 요구사항 (IFRSSEED 에이전트 구현용)
    disclosure_requirement VARCHAR(20) CHECK (disclosure_requirement IN ('필수', '권장', '선택')),  -- 공시 요구사항
    reporting_frequency VARCHAR(20),  -- 보고 주기 (연간, 분기별, 반기별 등)
    
    -- 임베딩 (벡터 검색용, 필수)
    unified_embedding vector(1024),
    
    -- 메타데이터
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**IFRSSEED 에이전트 구현을 위해 추가된 컬럼:**
- `column_description`: Supervisor/RAG Node에서 컬럼 이해에 필요
- `validation_rules`, `value_range`: Supervisor 검증 단계에서 필요 (원래 제거했으나 재추가)
- `financial_linkages`, `financial_impact_type`: Gen Node 재무 영향 문단 생성에 필요
- `disclosure_requirement`, `reporting_frequency`: 공시 요구사항 및 보고 주기 관리에 필요

**제거된 컬럼 및 제거 이유:**
- `unified_content`: LLM 동적 생성 가능, 저장 불필요
- `aggregation_rule`, `transformation_notes`: `unified_column_mapping_details` 테이블로 이동 권장
- `integration_status`, `integration_confidence`: 상태 관리 불필요 (`is_active`만으로 충분)
- `unified_embedding_text`, `unified_embedding_updated_at`: 임베딩 메타데이터 불필요 (동적 생성 가능)

#### Python SQLAlchemy 모델

```python
class UnifiedColumnMapping(Base):
    """통합 컬럼 매핑 테이블 (IFRSSEED 에이전트 구현용 완전한 버전)"""
    __tablename__ = "unified_column_mappings"
    
    # 식별자 및 기본 정보
    unified_column_id = Column(String(50), primary_key=True)
    column_name_ko = Column(String(200), nullable=False)
    column_name_en = Column(String(200), nullable=False)
    column_description = Column(Text)  # 통합 컬럼 상세 설명
    
    # 분류 정보 (선택적, 조인 없이 빠른 조회를 위해 유지)
    column_category = Column(String(1), nullable=False)
    column_topic = Column(String(100))
    column_subtopic = Column(String(100))
    
    # 매핑 정보 (핵심)
    mapped_dp_ids = Column(ARRAY(String), nullable=False)
    
    # 데이터 타입 정보 (선택적, 조인 없이 빠른 조회를 위해 유지)
    column_type = Column(
        PG_ENUM('quantitative', 'qualitative', 'narrative', 'binary', 
                name="unified_column_type_enum", create_type=False),
        nullable=False
    )
    unit = Column(String(50))
    
    # 검증 규칙 (IFRSSEED 에이전트 구현용)
    validation_rules = Column(JSONB, default={}, server_default="{}")  # 검증 규칙
    value_range = Column(JSONB)  # 값의 범위
    
    # 재무 연결 (IFRSSEED 에이전트 구현용)
    financial_linkages = Column(ARRAY(String))  # 재무 계정 연결
    financial_impact_type = Column(String(50))  # 재무 영향 타입
    
    # 공시 요구사항 (IFRSSEED 에이전트 구현용)
    disclosure_requirement = Column(
        PG_ENUM('필수', '권장', '선택',
                name="disclosure_requirement_enum", create_type=False),
        nullable=True
    )  # 공시 요구사항
    reporting_frequency = Column(String(20))  # 보고 주기
    
    # 임베딩 (벡터 검색용, 필수)
    unified_embedding = Column(Vector(1024) if Vector else Text, nullable=True)
    
    # 메타데이터
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
```

### 4.2 컬럼 상세 설명

#### 식별자 및 기본 정보

**`unified_column_id`** (VARCHAR(50), PRIMARY KEY)
- 통합 컬럼의 고유 식별자
- 형식: `"001_aa"`, `"002_ab"` (숫자_영문 조합)
- 용도: 여러 기준서의 DP를 하나의 통합 컬럼으로 묶을 때 사용
- 예시: `"001_aa"` = Scope 1 GHG 배출량 통합 컬럼

**`column_name_ko`** (VARCHAR(200), NOT NULL)
- 통합 컬럼의 한국어 명칭
- 예시: `"Scope 1 온실가스 배출량"`, `"총 임직원 수"`

**`column_name_en`** (VARCHAR(200), NOT NULL)
- 통합 컬럼의 영어 명칭
- 예시: `"Scope 1 GHG emissions"`, `"Total number of employees"`

**`column_description`** (TEXT)
- 통합 컬럼의 상세 설명
- 매핑된 DP들의 공통 의미를 요약
- Supervisor/RAG Node에서 컬럼 이해에 사용
- 예시: `"조직이 직접 소유하거나 통제하는 시설에서 발생하는 온실가스 배출량"`

#### 분류 정보 (선택적)

**`column_category`** (CHAR(1), NOT NULL, CHECK: 'E', 'S', 'G')
- ESG 카테고리
- `'E'`: Environment (환경)
- `'S'`: Social (사회)
- `'G'`: Governance (지배구조)
- **참고**: `mapped_dp_ids`에서도 추출 가능하지만, 조인 없이 빠른 조회를 위해 유지

**`column_topic`** (VARCHAR(100))
- 주제
- 예시: `"온실가스 배출"`, `"고용"`, `"지배구조"`
- **참고**: `mapped_dp_ids`에서도 추출 가능하지만, 조인 없이 빠른 조회를 위해 유지

**`column_subtopic`** (VARCHAR(100))
- 세부 주제
- 예시: `"Scope 1"`, `"성별 다양성"`, `"이사회 구성"`
- **참고**: `mapped_dp_ids`에서도 추출 가능하지만, 조인 없이 빠른 조회를 위해 유지

#### 매핑 정보 (핵심)

**`mapped_dp_ids`** (TEXT[], NOT NULL)
- 이 통합 컬럼에 매핑된 DP ID 배열
- 여러 기준서의 DP를 포함
- 예시: `["S2-29-a", "GRI-305-1", "SASB-EM-110a.1", "TCFD-EM-1"]`
- 용도: 어떤 DP들이 이 통합 컬럼에 속하는지 빠르게 확인

#### 데이터 타입 정보 (선택적)

**`column_type`** (ENUM, NOT NULL)
- 통합 컬럼의 데이터 타입
- `'quantitative'`: 정량 데이터 (숫자)
- `'qualitative'`: 정성 데이터 (텍스트)
- `'narrative'`: 서술형
- `'binary'`: 예/아니오
- **참고**: `mapped_dp_ids`에서도 추출 가능하지만, 조인 없이 빠른 조회를 위해 유지

**`unit`** (VARCHAR(50))
- 단위
- 예시: `"tCO2e"`, `"count"`, `"currency_krw"`, `"percentage"`
- **참고**: `mapped_dp_ids`에서도 추출 가능하지만, 조인 없이 빠른 조회를 위해 유지

#### 검증 규칙 (IFRSSEED 에이전트 구현용)

**`validation_rules`** (JSONB, DEFAULT '{}')
- 검증 규칙을 JSON으로 저장
- Supervisor 검증 단계에서 사용
- 예시:
  ```json
  {
    "min_value": 0,
    "max_value": 1000000,
    "required": true,
    "format": "number"
  }
  ```

**`value_range`** (JSONB)
- 값의 범위
- Supervisor 검증 단계에서 사용
- 예시: `{"min": 0, "max": 1000000}`

#### 재무 연결 (IFRSSEED 에이전트 구현용)

**`financial_linkages`** (TEXT[])
- 재무 계정 연결 배열
- Gen Node에서 재무 영향 문단 생성 시 사용
- 예시: `["탄소배출권", "배출권거래손익", "환경부채"]`

**`financial_impact_type`** (VARCHAR(50))
- 재무 영향 타입
- Gen Node에서 재무 영향 문단 생성 시 사용
- 값: `"positive"`, `"negative"`, `"neutral"`
- 예시: `"negative"` = 부정적 영향

#### 공시 요구사항 (IFRSSEED 에이전트 구현용)

**`disclosure_requirement`** (ENUM)
- 공시 요구사항
- Supervisor에서 필수 DP 식별 시 사용
- 값: `'필수'`, `'권장'`, `'선택'`
- 결정 규칙: 매핑된 DP 중 하나라도 "필수"면 "필수", 모두 "선택"이면 "선택", 그 외는 "권장"

**`reporting_frequency`** (VARCHAR(20))
- 보고 주기
- 보고서 생성 시 주기 결정에 사용
- 예시: `"연간"`, `"분기별"`, `"반기별"`
- 결정 규칙: 매핑된 DP들의 보고 주기 중 가장 빈번한 것, 또는 공통 주기

#### 임베딩 (벡터 검색용, 필수)

**`unified_embedding`** (vector(1024))
- 통합 컬럼의 벡터 임베딩
- **BGE-M3** 모델 사용 (1024차원, **현행 운영** 임베딩)
- 벡터 검색에 사용
- 임베딩 생성 텍스트: `column_name_ko` + `column_name_en` + `column_category` + `column_topic` + `column_type` + `unit` + `mapped_dp_ids` (DP 이름들)

#### 메타데이터

**`is_active`** (BOOLEAN, DEFAULT TRUE)
- 활성화 여부 (Soft Delete)

**`created_at`** (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- 생성 시각

**`updated_at`** (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- 최종 수정 시각

### 4.2.1 IFRSSEED 에이전트 구현을 위해 추가된 컬럼

`data_points` 테이블 대신 `unified_column_mappings` 테이블을 사용하는 경우, 다음 컬럼들이 필요합니다:

| 추가된 컬럼 | 타입 | 설명 | 사용 목적 | 예시 |
|-----------|------|------|----------|------|
| `column_description` | TEXT | 통합 컬럼 상세 설명 | Supervisor/RAG Node에서 컬럼 이해 | `"조직이 직접 소유하거나 통제하는 시설에서 발생하는 온실가스 배출량"` |
| `validation_rules` | JSONB | 검증 규칙 | Supervisor 검증 단계 | `{"min_value": 0, "max_value": 1000000, "required": true}` |
| `value_range` | JSONB | 값의 범위 | Supervisor 검증 단계 | `{"min": 0, "max": 1000000}` |
| `financial_linkages` | TEXT[] | 재무 계정 연결 배열 | Gen Node 재무 영향 문단 생성 | `["탄소배출권", "배출권거래손익", "환경부채"]` |
| `financial_impact_type` | VARCHAR(50) | 재무 영향 타입 | Gen Node 재무 영향 문단 생성 | `"negative"`, `"positive"`, `"neutral"` |
| `disclosure_requirement` | ENUM | 공시 요구사항 | Supervisor 필수 DP 식별 | `'필수'`, `'권장'`, `'선택'` |
| `reporting_frequency` | VARCHAR(20) | 보고 주기 | 보고서 생성 시 주기 결정 | `"연간"`, `"분기별"`, `"반기별"` |

### 4.2.2 제거된 컬럼 및 제거 이유

다음 컬럼들은 IFRSSEED 에이전트 구현에서 실제로 사용되지 않아 제거되었습니다:

| 제거된 컬럼 | 제거 이유 | 대안 |
|-----------|----------|------|
| `unified_content` | LLM 동적 생성 가능, 저장 불필요 | 필요 시 동적 생성 |
| `aggregation_rule` | 통합 규칙은 `unified_column_mapping_details` 테이블로 이동 권장 | 별도 테이블 관리 |
| `transformation_notes` | 변환 주의사항은 `unified_column_mapping_details` 테이블로 이동 권장 | 별도 테이블 관리 |
| `integration_status` | 상태 관리 불필요 (`is_active`만으로 충분) | `is_active` 사용 |
| `integration_confidence` | 신뢰도 계산은 동적 수행 가능, 저장 불필요 | 동적 계산 |
| `unified_embedding_text` | 임베딩 생성용 텍스트는 동적 생성 가능, 저장 불필요 | 동적 생성 |
| `unified_embedding_updated_at` | 임베딩 업데이트 시각 추적 불필요 | `updated_at` 사용 |

### 4.3 통합 컬럼 사용 예시

```python
# Scope 1 GHG 배출량 통합 컬럼 생성 (IFRSSEED 에이전트 구현용 완전한 버전)
unified_column = UnifiedColumnMapping(
    unified_column_id="001_aa",
    column_name_ko="Scope 1 온실가스 배출량",
    column_name_en="Scope 1 GHG emissions",
    column_description="조직이 직접 소유하거나 통제하는 시설에서 발생하는 온실가스 배출량",
    column_category="E",
    column_topic="온실가스 배출",
    column_subtopic="Scope 1",
    mapped_dp_ids=["S2-29-a", "GRI-305-1", "SASB-EM-110a.1", "TCFD-EM-1"],
    column_type="quantitative",
    unit="tCO2e",
    validation_rules={"min_value": 0, "max_value": 1000000, "required": True},
    value_range={"min": 0, "max": 1000000},
    financial_linkages=["탄소배출권", "배출권거래손익", "환경부채"],
    financial_impact_type="negative",
    disclosure_requirement="필수",
    reporting_frequency="연간",
    is_active=True
)

# 임베딩 생성 (동적 생성)
from ifrs_agent.utils.embedding_utils import generate_unified_column_embedding_text

embedding_text = generate_unified_column_embedding_text(unified_column)
# 포함 컬럼: column_name_ko, column_name_en, column_description, column_category, 
#           column_topic, column_type, unit, mapped_dp_ids (DP 이름들)

embedding = embedder.encode([embedding_text], normalize_embeddings=True)
unified_column.unified_embedding = embedding[0].tolist()
```

**IFRSSEED 에이전트에서의 사용:**
- **Supervisor**: `disclosure_requirement`로 필수 DP 식별, `validation_rules`/`value_range`로 검증 수행
- **RAG Node**: `column_description`으로 컬럼 이해, `unified_embedding`으로 벡터 검색
- **Gen Node**: `financial_linkages`/`financial_impact_type`으로 재무 영향 문단 생성
- **통합 규칙**: `aggregation_rule`, `transformation_notes`는 `unified_column_mapping_details` 테이블에서 관리

### 4.4 통합 컬럼 구조의 장점

1. **기준서 중립적**: 특정 기준서에 종속되지 않음
2. **확장성**: 새 기준서 추가 시 `mapped_dp_ids`에만 추가
3. **통합 관리**: 하나의 통합 컬럼으로 여러 기준서 관리
4. **일관성**: 통합된 설명으로 일관된 해석 제공
5. **벡터 검색**: 통합 컬럼 기반으로 유사한 지표 검색 가능
6. **최소 구성**: IFRSSEED 에이전트 구현에 필요한 최소 필수 컬럼만 유지하여 단순성과 유지보수성 향상

### 4.5 컬럼 구성 요약

**최종 컬럼 구성 (20개) - IFRSSEED 에이전트 구현용:**

| 그룹 | 컬럼 개수 | 컬럼 목록 |
|------|----------|----------|
| 식별자 및 기본 정보 | 4 | `unified_column_id`, `column_name_ko`, `column_name_en`, `column_description` |
| 분류 정보 | 3 | `column_category`, `column_topic`, `column_subtopic` |
| 매핑 정보 | 1 | `mapped_dp_ids` |
| 데이터 타입 정보 | 2 | `column_type`, `unit` |
| 검증 규칙 | 2 | `validation_rules`, `value_range` |
| 재무 연결 | 2 | `financial_linkages`, `financial_impact_type` |
| 공시 요구사항 | 2 | `disclosure_requirement`, `reporting_frequency` |
| 임베딩 | 1 | `unified_embedding` |
| 메타데이터 | 3 | `is_active`, `created_at`, `updated_at` |
| **합계** | **20** | - |

**필수 vs 선택적 컬럼:**
- **필수 컬럼 (12개)**: `unified_column_id`, `column_name_ko`, `column_name_en`, `column_category`, `mapped_dp_ids`, `column_type`, `unified_embedding`, `is_active`, `created_at`, `updated_at`
- **선택적 컬럼 (8개)**: `column_description`, `column_topic`, `column_subtopic`, `unit`, `validation_rules`, `value_range`, `financial_linkages`, `financial_impact_type`, `disclosure_requirement`, `reporting_frequency`

**제거된 컬럼 (7개):**
- `unified_content`, `aggregation_rule`, `transformation_notes`, `integration_status`, `integration_confidence`, `unified_embedding_text`, `unified_embedding_updated_at`

**제거 이유:**
- 동적 생성: LLM이나 임베딩 생성 시 동적으로 생성 가능
- 별도 테이블 관리: `unified_column_mapping_details` 테이블로 이동
- 불필요: IFRSSEED 에이전트 구현에서 실제로 사용되지 않음

---

## 5. 재무 연결성 (Financial Linkage)

### 5.1 재무 계정 구조

```python
class FinancialAccount(BaseModel):
    """재무 계정 정의"""
    
    account_id: str
    account_code: str                 # K-IFRS 계정 코드
    name_ko: str
    name_en: str
    statement_type: Literal[
        "balance_sheet",              # 재무상태표
        "income_statement",           # 손익계산서
        "cash_flow",                  # 현금흐름표
        "notes"                       # 주석
    ]
    account_category: str             # 자산/부채/자본/수익/비용
    
    # ESG 연결
    linked_dps: List[str]             # 연결된 DP 목록
    impact_direction: Literal["positive", "negative", "neutral"]
```

### 5.2 ESG-재무 연결 매트릭스

```python
# ESG DP와 재무 계정 연결 예시
ESG_FINANCIAL_LINKAGES = {
    # 환경 (E) - 재무 연결
    "S2-29-a": {  # Scope 1 배출량
        "accounts": [
            {"account": "탄소배출권", "type": "자산", "impact": "negative"},
            {"account": "배출권거래손익", "type": "수익/비용", "impact": "variable"},
            {"account": "환경부채", "type": "부채", "impact": "negative"}
        ],
        "financial_impact_description": "탄소 배출량 증가 시 배출권 구매 비용 증가 및 탄소세 부담"
    },
    "S2-15-a": {  # 물리적 리스크 재무 영향
        "accounts": [
            {"account": "유형자산손상차손", "type": "비용", "impact": "negative"},
            {"account": "보험료", "type": "비용", "impact": "negative"},
            {"account": "자산재평가손실", "type": "비용", "impact": "negative"}
        ],
        "financial_impact_description": "기후 물리적 리스크로 인한 자산 손상 및 보험 비용 증가"
    },
    
    # 사회 (S) - 재무 연결
    "GRI-2-7": {  # 임직원 현황
        "accounts": [
            {"account": "인건비", "type": "비용", "impact": "neutral"},
            {"account": "복리후생비", "type": "비용", "impact": "neutral"},
            {"account": "퇴직급여충당부채", "type": "부채", "impact": "neutral"}
        ],
        "financial_impact_description": "인력 구성 변화에 따른 인건비 및 복리후생비 영향"
    },
    
    # 지배구조 (G) - 재무 연결
    "S1-GOV-1": {  # 이사회 구성
        "accounts": [
            {"account": "이사보수", "type": "비용", "impact": "neutral"},
            {"account": "주식보상비용", "type": "비용", "impact": "neutral"}
        ],
        "financial_impact_description": "지배구조 강화에 따른 이사회 운영 비용"
    }
}
```

### 5.3 재무 영향 정량화 템플릿

```python
class FinancialImpactQuantification(BaseModel):
    """재무 영향 정량화"""
    
    dp_id: str
    fiscal_year: int
    
    # 정량적 영향
    impact_amount: float              # 금액 (원)
    impact_percentage: float          # 매출/자산 대비 비율
    
    # 시나리오별 영향
    scenarios: Dict[str, float] = {
        "best_case": 0,
        "base_case": 0,
        "worst_case": 0
    }
    
    # 시간 범위
    time_horizon: Literal["short", "medium", "long"]
    
    # 근거
    calculation_method: str
    assumptions: List[str]
    data_sources: List[str]
```

---

## 6. 온톨로지 저장소 구현

### 6.1 Neo4j 기반 구현

```python
from neo4j import GraphDatabase

class OntologyStore:
    """Neo4j 기반 온톨로지 저장소"""
    
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def create_dp(self, dp: DataPoint):
        """DP 노드 생성"""
        with self.driver.session() as session:
            session.run("""
                MERGE (dp:DataPoint {dp_id: $dp_id})
                SET dp.name_ko = $name_ko,
                    dp.name_en = $name_en,
                    dp.standard = $standard,
                    dp.category = $category,
                    dp.dp_type = $dp_type,
                    dp.unit = $unit
            """, **dp.dict())
    
    def create_mapping(self, mapping: StandardMapping):
        """매핑 관계 생성"""
        with self.driver.session() as session:
            session.run("""
                MATCH (source:DataPoint {dp_id: $source_dp})
                MATCH (target:DataPoint {dp_id: $target_dp})
                MERGE (source)-[r:MAPS_TO {
                    mapping_type: $mapping_type,
                    confidence: $confidence
                }]->(target)
            """, **mapping.dict())
    
    def find_equivalent_dps(self, dp_id: str) -> List[str]:
        """동일 의미 DP 검색"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (dp:DataPoint {dp_id: $dp_id})-[:EQUIVALENT_TO*1..2]-(equivalent)
                RETURN DISTINCT equivalent.dp_id as dp_id
            """, dp_id=dp_id)
            return [record["dp_id"] for record in result]
    
    def find_ifrs_mapping(self, source_dp: str) -> List[Dict]:
        """소스 DP의 IFRS 매핑 검색"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (source:DataPoint {dp_id: $source_dp})
                      -[r:MAPS_TO]->(target:DataPoint)
                WHERE target.standard = 'IFRS_S2' OR target.standard = 'IFRS_S1'
                RETURN target.dp_id as dp_id,
                       target.name_ko as name,
                       r.mapping_type as mapping_type,
                       r.confidence as confidence
            """, source_dp=source_dp)
            return [dict(record) for record in result]
    
    def get_financial_linkages(self, dp_id: str) -> List[Dict]:
        """DP의 재무 연결 정보 조회"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (dp:DataPoint {dp_id: $dp_id})
                      -[:LINKED_TO]->(fa:FinancialAccount)
                RETURN fa.account_id as account_id,
                       fa.name_ko as name,
                       fa.account_category as category
            """, dp_id=dp_id)
            return [dict(record) for record in result]
```

### 6.2 Python Dict 기반 구현 (경량 버전)

```python
class LightweightOntologyStore:
    """Python Dict 기반 경량 온톨로지 저장소"""
    
    def __init__(self):
        self.data_points: Dict[str, DataPoint] = {}
        self.mappings: List[StandardMapping] = []
        self.equivalence_index: Dict[str, Set[str]] = {}
        self.financial_linkages: Dict[str, List[Dict]] = {}
    
    def add_dp(self, dp: DataPoint):
        """DP 추가"""
        self.data_points[dp.dp_id] = dp
        
        # 동등성 인덱스 업데이트
        if dp.equivalent_dps:
            equiv_set = set(dp.equivalent_dps + [dp.dp_id])
            for eq_id in equiv_set:
                if eq_id not in self.equivalence_index:
                    self.equivalence_index[eq_id] = set()
                self.equivalence_index[eq_id].update(equiv_set)
    
    def add_mapping(self, mapping: StandardMapping):
        """매핑 추가"""
        self.mappings.append(mapping)
    
    def find_equivalent_dps(self, dp_id: str) -> List[str]:
        """동일 의미 DP 검색"""
        return list(self.equivalence_index.get(dp_id, set()))
    
    def find_ifrs_mapping(self, source_dp: str) -> List[StandardMapping]:
        """IFRS 매핑 검색"""
        return [
            m for m in self.mappings
            if m.source_dp == source_dp and m.target_standard.startswith("IFRS")
        ]
    
    def get_dps_by_standard(self, standard: str) -> List[DataPoint]:
        """기준서별 DP 목록"""
        return [dp for dp in self.data_points.values() if dp.standard == standard]
    
    def get_dps_by_category(self, category: str) -> List[DataPoint]:
        """카테고리별 DP 목록"""
        return [dp for dp in self.data_points.values() if dp.category == category]
    
    def search_dps(self, query: str) -> List[DataPoint]:
        """DP 검색 (이름, 설명 기반)"""
        query_lower = query.lower()
        return [
            dp for dp in self.data_points.values()
            if query_lower in dp.name_ko.lower() or 
               query_lower in dp.name_en.lower() or
               query_lower in dp.description.lower()
        ]
    
    def export_to_json(self, filepath: str):
        """JSON 내보내기"""
        data = {
            "data_points": [dp.dict() for dp in self.data_points.values()],
            "mappings": [m.dict() for m in self.mappings]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def import_from_json(self, filepath: str):
        """JSON 가져오기"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for dp_data in data["data_points"]:
            self.add_dp(DataPoint(**dp_data))
        
        for mapping_data in data["mappings"]:
            self.add_mapping(StandardMapping(**mapping_data))
```

---

## 7. 중복 제거 알고리즘

### 7.1 중복 탐지

```python
class DuplicateDetector:
    """DP 중복 탐지"""
    
    def __init__(self, embedding_model: ESGEmbeddingService):
        self.embedder = embedding_model
        self.similarity_threshold = 0.85
    
    def find_duplicates(self, dps: List[DataPoint]) -> List[Tuple[str, str, float]]:
        """중복 DP 쌍 탐지"""
        duplicates = []
        
        # 임베딩 생성
        texts = [f"{dp.name_ko} {dp.description}" for dp in dps]
        embeddings = self.embedder.encode(texts)
        
        # 유사도 계산
        for i in range(len(dps)):
            for j in range(i + 1, len(dps)):
                similarity = self._cosine_similarity(embeddings[i], embeddings[j])
                
                if similarity >= self.similarity_threshold:
                    duplicates.append((
                        dps[i].dp_id,
                        dps[j].dp_id,
                        similarity
                    ))
        
        return duplicates
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

### 7.2 중복 통합

```python
class DuplicateMerger:
    """중복 DP 통합"""
    
    def merge_duplicates(
        self,
        primary_dp: DataPoint,
        duplicate_dps: List[DataPoint]
    ) -> DataPoint:
        """중복 DP를 기준 DP로 통합"""
        # 동등 DP 목록 업데이트
        all_equivalent = set(primary_dp.equivalent_dps)
        for dup in duplicate_dps:
            all_equivalent.add(dup.dp_id)
            all_equivalent.update(dup.equivalent_dps)
        
        # 재무 연결 통합
        all_financial = set(primary_dp.financial_linkages)
        for dup in duplicate_dps:
            all_financial.update(dup.financial_linkages)
        
        # 통합된 DP 생성
        merged_dp = primary_dp.copy(update={
            "equivalent_dps": list(all_equivalent),
            "financial_linkages": list(all_financial)
        })
        
        return merged_dp
```

---

## 8. 온톨로지 초기화 데이터

### 8.1 IFRS S2 핵심 DP 목록

```python
IFRS_S2_CORE_DPS = [
    # 지배구조
    DataPoint(
        dp_id="S2-GOV-1",
        dp_code="IFRS_S2_GOVERNANCE_OVERSIGHT",
        name_ko="기후 관련 위험과 기회에 대한 지배기구의 감독",
        name_en="Governance body's oversight of climate-related risks and opportunities",
        standard="IFRS_S2",
        category="G",
        topic="지배구조",
        dp_type=DPType.NARRATIVE,
        disclosure_requirement="필수"
    ),
    
    # 전략
    DataPoint(
        dp_id="S2-10-a",
        dp_code="IFRS_S2_CLIMATE_RISKS",
        name_ko="기후 관련 위험",
        name_en="Climate-related risks",
        standard="IFRS_S2",
        category="E",
        topic="전략",
        subtopic="기후 리스크",
        dp_type=DPType.NARRATIVE,
        disclosure_requirement="필수"
    ),
    DataPoint(
        dp_id="S2-15-a",
        dp_code="IFRS_S2_PHYSICAL_RISK_FINANCIAL",
        name_ko="물리적 위험의 재무적 영향",
        name_en="Financial effects of physical risks",
        standard="IFRS_S2",
        category="E",
        topic="전략",
        subtopic="재무적 영향",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.CURRENCY_KRW,
        financial_linkages=["유형자산손상차손", "보험료"],
        disclosure_requirement="필수"
    ),
    
    # 지표 및 목표
    DataPoint(
        dp_id="S2-29-a",
        dp_code="IFRS_S2_SCOPE1_EMISSIONS",
        name_ko="Scope 1 온실가스 배출량",
        name_en="Scope 1 GHG emissions",
        standard="IFRS_S2",
        category="E",
        topic="지표 및 목표",
        subtopic="온실가스 배출",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.TCO2E,
        equivalent_dps=["GRI-305-1", "SASB-EM-110a.1"],
        financial_linkages=["탄소배출권", "환경부채"],
        disclosure_requirement="필수"
    ),
    DataPoint(
        dp_id="S2-29-b",
        dp_code="IFRS_S2_SCOPE2_EMISSIONS",
        name_ko="Scope 2 온실가스 배출량",
        name_en="Scope 2 GHG emissions",
        standard="IFRS_S2",
        category="E",
        topic="지표 및 목표",
        subtopic="온실가스 배출",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.TCO2E,
        equivalent_dps=["GRI-305-2"],
        disclosure_requirement="필수"
    ),
    DataPoint(
        dp_id="S2-29-c",
        dp_code="IFRS_S2_SCOPE3_EMISSIONS",
        name_ko="Scope 3 온실가스 배출량",
        name_en="Scope 3 GHG emissions",
        standard="IFRS_S2",
        category="E",
        topic="지표 및 목표",
        subtopic="온실가스 배출",
        dp_type=DPType.QUANTITATIVE,
        unit=DPUnit.TCO2E,
        equivalent_dps=["GRI-305-3"],
        disclosure_requirement="필수"
    )
]
```

### 8.2 초기화 스크립트

```python
def initialize_ontology() -> LightweightOntologyStore:
    """온톨로지 초기화"""
    store = LightweightOntologyStore()
    
    # IFRS S2 핵심 DP 추가
    for dp in IFRS_S2_CORE_DPS:
        store.add_dp(dp)
    
    # GRI DP 추가 (예시)
    for dp in GRI_CORE_DPS:
        store.add_dp(dp)
    
    # 매핑 추가
    for mapping in STANDARD_MAPPINGS:
        store.add_mapping(mapping)
    
    # 재무 연결 추가
    for dp_id, linkages in ESG_FINANCIAL_LINKAGES.items():
        store.financial_linkages[dp_id] = linkages
    
    return store
```

---

## 9. 데이터베이스 스키마 설계

### 9.1 테이블 구조 (제안 6개 테이블 + 보조 테이블)

온톨로지는 **PostgreSQL + pgvector** 기반으로 구현되어 있으며, **제안 6개 핵심 테이블**과 보조 테이블로 구성됩니다.

#### 제안 6개 핵심 테이블

| 테이블명 | 역할 | 주요 필드 |
|---------|------|----------|
| `data_points` | DP 메타데이터 (핵심) | `dp_id`, `name_ko`, `name_en`, `description`, `standard`, `category`, `validation_rules`, `value_range`, `embedding` |
| `standards` | 기준서 공통 정보 (섹션별 row) | 복합 PK (standard_id, section_name), section_content NOT NULL, section_type, section_embedding — 기준서당 여러 섹션(목적/적용범위/일반요구사항) 지원 |
| `rulebooks` | 기준서별 공시 요구사항 상세 | `rulebook_id(VARCHAR)`, `standard_id`, `primary_dp_id`, `section_name`, `rulebook_content`, `paragraph_reference`, `section_embedding` |
| `unified_column_mappings` | 통합 컬럼 매핑 | `unified_column_id`, `mapped_dp_ids`, `primary_standard`, `primary_rulebook_id`, `validation_rules`, `value_range`, `unified_embedding` |
| `disclosure_methods` | 공시 방법 (서술 가이드, 템플릿) | `method_id`, `unified_column_id`, `template_type`, `writing_guideline`, `example_text` |
| `glossary` | 용어집 (독립 참조) | `term_id`, `term_ko`(unique), `term_en`, `definition_ko`, `definition_en`, `standard`, `term_embedding` |

#### 보조 테이블

| 테이블명 | 역할 | 주요 필드 |
|---------|------|----------|
| `dp_financial_linkages` | DP-재무 계정 연결 | `dp_id`, `financial_account_code`, `impact_description`, `impact_embedding` |
| `dp_decomposition_rules` | DP 분해 규칙 | `parent_dp_id`, `child_dp_ids`, `aggregation_rule` |
| `document_chunks` | PDF 문서 청크 (벡터 검색용) | `chunk_id`, `document_path`, `chunk_text`, `embedding` |

#### 제거된 테이블

| 테이블명 | 제거 이유 | 대체 방안 |
|---------|----------|----------|
| `standard_mappings` | 기준서 간 DP 매핑 역할이 `unified_column_mappings`와 `rulebooks`로 통합됨 | `unified_column_mappings.mapped_dp_ids`, `rulebooks.related_dp_ids` 활용 |

#### 테이블 관계 다이어그램

```
┌─────────────────┐       ┌─────────────────┐
│   standards     │       │   data_points   │
│  (기준서 정보)   │       │   (DP 메타)     │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ standard_id             │ dp_id
         │                         │
         ▼                         ▼
┌─────────────────────────────────────────────┐
│              rulebooks                       │
│  (기준서별 공시 요구사항 상세)                │
│  - standard_id (논리적 참조 → standards)     │
│  - primary_dp_id (FK → data_points)          │
└────────────────────┬────────────────────────┘
                     │ rulebook_id
                     ▼
┌─────────────────────────────────────────────┐
│         unified_column_mappings              │
│  (통합 컬럼 매핑)                             │
│  - primary_rulebook_id (FK → rulebooks)      │
│  - mapped_dp_ids (ARRAY)                     │
└────────────────────┬────────────────────────┘
                     │ unified_column_id
                     ▼
┌─────────────────────────────────────────────┐
│          disclosure_methods                  │
│  (공시 방법/템플릿)                           │
│  - unified_column_id (FK)                    │
└─────────────────────────────────────────────┘

┌─────────────────┐
│    glossary     │
│   (용어집)       │
└─────────────────┘
```

#### 스키마 설계 참고 (최종 반영 사항)

- **standards**: 복합 PK `(standard_id, section_name)` — 동일 기준서(예: IFRS_S2)에 대해 목적/적용범위/일반요구사항 등 섹션별로 row를 두며, `section_content`는 NOT NULL.
- **data_points**: `validation_rules`, `value_range` 유지 — Supervisor 검증 및 RAG/Gen에서 DP 단위 검증 시 사용.
- **unified_column_mappings**: `validation_rules`, `value_range` 유지 — Supervisor의 통합 컬럼 단위 검증에 필요(문서 명시).
- **glossary**: `term_ko` UNIQUE — 용어 중복 방지. `synonyms_glossary` 이관 시 중복이 있으면 마이그레이션 전 정리 필요.
- **rulebooks**: `standard_id`는 standards 복합 PK 때문에 FK 미적용, 논리적 참조로 사용.

### 9.2 임베딩 컬럼 설계

**Vector Search**를 위한 임베딩 컬럼이 6개 테이블에 추가되었습니다.

#### 임베딩 컬럼이 필요한 테이블

| 테이블 | 임베딩 컬럼명 | 임베딩 대상 필드 (개선된 버전) | 우선순위 | 사용 목적 |
|--------|-------------|----------------|---------|----------|
| `data_points` | `embedding` | `name_ko` + `name_en` + `description` + `topic` + `subtopic` + `standard` + `category` + `dp_type` + `unit` + `validation_rules` + `value_range` + `disclosure_requirement` + `reporting_frequency` + `financial_linkages` | **필수** | 사용자 쿼리 → DP 매핑, 중복 탐지 |
| `standards` | `section_embedding` | `standard_id` + `standard_name` + `section_name` + `section_type` + `paragraph_reference` + `section_content` + `key_terms` + `related_concepts` | **필수** | 기준서 공통 정보 검색 |
| `rulebooks` | `section_embedding` | `rulebook_id` + `standard_id` + `section_name` + `rulebook_title` + `rulebook_content` + `paragraph_reference` + `key_terms` + `related_concepts` + `disclosure_requirement` | **필수** | 공시 요구사항 검색 |
| `unified_column_mappings` | `unified_embedding` | `column_name_ko` + `column_name_en` + `column_description` + `column_category` + `column_topic` + `column_type` + `unit` + `primary_standard` + `applicable_standards` + `mapped_dp_ids` (DP 이름들) | **필수** | 통합 컬럼 검색, 유사 지표 검색 |
| `glossary` | `term_embedding` | `term_ko` + `term_en` + `definition_ko` + `definition_en` + `standard` + `category` + `source` + `related_dps` (개수) | **필수** | 용어 검색, Hybrid Search 지원 |
| `dp_financial_linkages` | `impact_embedding` | `financial_account_name` + `financial_account_code` + `account_type` + `statement_type` + `impact_direction` + `impact_description` + DP 이름 | **권장** | Gen Node의 재무 영향 문단 생성 |

#### 임베딩 생성 텍스트 예시 (제안 6개 테이블 구조)

**모든 관련 컬럼을 포함하여 검색 정확도를 향상시킵니다.**

```python
# data_points
from ifrs_agent.utils.embedding_utils import generate_data_point_embedding_text

embedding_text = generate_data_point_embedding_text(dp)
# 포함 컬럼: name_ko, name_en, description, topic, subtopic, standard, 
#           category, dp_type, unit, validation_rules, value_range,
#           disclosure_requirement, reporting_frequency, financial_linkages
# 예: "Scope 1 온실가스 배출량 Scope 1 GHG emissions 보고 기간 중 직접 배출된 온실가스 
#      기후 온실가스 배출 IFRS_S2 환경 Environment quantitative tCO2e 
#      value >= 0 최대값: 1000000 필수 연간"

# standards (신규)
from ifrs_agent.utils.embedding_utils import generate_standard_embedding_text

standard_embedding_text = generate_standard_embedding_text(std)
# 포함 컬럼: standard_id, standard_name, section_name, section_type,
#           paragraph_reference, section_content, key_terms, related_concepts
# 예: "IFRS_S2 기후 관련 공시 목적 objective 1 기업이 기후 관련 위험과 기회에 대한 
#      정보를 공시하도록 요구... 기후리스크 전환리스크 물리적리스크"

# rulebooks (확장됨)
from ifrs_agent.utils.embedding_utils import generate_rulebook_embedding_text

section_embedding_text = generate_rulebook_embedding_text(rule)
# 포함 컬럼: rulebook_id, standard_id, section_name, rulebook_title, rulebook_content,
#           paragraph_reference, key_terms, related_concepts, disclosure_requirement
# 예: "S2_governance_01 IFRS_S2 지배구조 기후 관련 위험과 기회에 대한 지배기구의 감독 
#      문단: 6(a) 필수 이사회 감독 책임 위험관리"

# unified_column_mappings (확장됨)
from ifrs_agent.service.embedding_text_service import EmbeddingTextService

service = EmbeddingTextService()
unified_embedding_text = service.generate_unified_mapping_text(unified_column)
# 포함 컬럼: column_name_ko, column_name_en, column_description, column_category, 
#           column_topic, column_type, unit, primary_standard, applicable_standards,
#           mapped_dp_ids (DP 이름들), mapping_notes
# 예: "Scope 1 온실가스 배출량 Scope 1 GHG emissions 
#      환경 온실가스 배출 Scope 1 quantitative tCO2e IFRS_S2 GRI TCFD
#      매핑된DP: S2-29-a GRI-305-1 SASB-EM-110a.1"

# glossary (신규, synonyms_glossary 대체)
from ifrs_agent.utils.embedding_utils import generate_glossary_embedding_text

term_embedding_text = generate_glossary_embedding_text(term)
# 포함 컬럼: term_ko, term_en, definition_ko, definition_en, standard, category, source, related_dps (개수)
# 예: "온실가스 배출량 GHG emissions 대기 중으로 방출되는 온실가스의 총량 
#      IFRS_S2 환경 IPCC 관련_DP: 3개"

# dp_financial_linkages
from ifrs_agent.utils.embedding_utils import generate_financial_linkage_embedding_text

impact_embedding_text = generate_financial_linkage_embedding_text(linkage)
# 포함 컬럼: financial_account_name, financial_account_code, account_type,
#           statement_type, impact_direction, impact_description, DP 이름
# 예: "탄소배출권 ACC001 자산 재무상태표 영향방향: negative 
#      탄소 배출량 증가 시 배출권 구매 비용 증가 및 탄소세 부담 DP: Scope 1 온실가스 배출량"
```

### 9.3 pgvector 설정

#### 확장 설치

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 벡터 컬럼 타입

```sql
-- BGE-M3 모델: 1024차원
embedding vector(1024)
```

#### HNSW 인덱스 (고성능 벡터 검색)

```sql
-- Cosine 유사도 검색용 인덱스
CREATE INDEX idx_data_points_embedding 
ON data_points 
USING hnsw (embedding vector_cosine_ops)
WHERE is_active = TRUE AND embedding IS NOT NULL;
```

**인덱스 특징**:
- **HNSW (Hierarchical Navigable Small World)**: 대규모 벡터 검색에 최적화
- **Partial Index**: `is_active = TRUE`인 활성 레코드만 인덱싱
- **vector_cosine_ops**: Cosine 유사도 연산자 사용

### 9.4 벡터 검색 사용 예시

#### RAG Node에서 DP 검색

```python
from sqlalchemy import text
from pgvector.sqlalchemy import Vector

async def find_dp_by_query(self, query: str, top_k: int = 10) -> List[str]:
    """사용자 쿼리로 관련 DP 찾기"""
    # 1. 쿼리 임베딩 생성
    query_embedding = self.embedder.encode(query)
    
    # 2. PostgreSQL 벡터 검색 (Cosine 유사도)
    results = db.execute(
        text("""
            SELECT dp_id, 
                   1 - (embedding <=> :query_embedding::vector) as similarity
            FROM data_points
            WHERE is_active = TRUE 
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :query_embedding::vector
            LIMIT :top_k
        """),
        {
            "query_embedding": str(query_embedding.tolist()),
            "top_k": top_k
        }
    )
    
    # 유사도 0.7 이상만 반환
    return [
        r.dp_id for r in results 
        if r.similarity >= 0.7
    ]
```

#### Gen Node에서 재무 영향 검색

```python
async def find_financial_impact(
    self, 
    query: str, 
    dp_id: str
) -> Optional[str]:
    """재무 영향 설명 검색"""
    query_embedding = self.embedder.encode(query)
    
    result = db.execute(
        text("""
            SELECT impact_description,
                   1 - (impact_embedding <=> :query_embedding::vector) as similarity
            FROM dp_financial_linkages
            WHERE dp_id = :dp_id 
              AND is_active = TRUE
              AND impact_embedding IS NOT NULL
            ORDER BY impact_embedding <=> :query_embedding::vector
            LIMIT 1
        """),
        {
            "query_embedding": str(query_embedding.tolist()),
            "dp_id": dp_id
        }
    )
    
    row = result.first()
    return row.impact_description if row and row.similarity >= 0.7 else None
```

### 9.5 임베딩 생성 및 업데이트

#### 배치 임베딩 생성 스크립트 (제안 6개 테이블 구조)

**임베딩 유틸리티 함수 또는 EmbeddingTextService를 사용합니다.**

```bash
# 스크립트 실행
python -m ifrs_agent.scripts.generate_embeddings

# 모든 레코드 강제 재생성
python -m ifrs_agent.scripts.generate_embeddings --force

# 특정 날짜 이후 업데이트된 레코드만 재생성
python -m ifrs_agent.scripts.generate_embeddings --since 2024-01-01
```

**임베딩 생성 함수 사용 (제안 6개 테이블):**

```python
from ifrs_agent.service.embedding_text_service import EmbeddingTextService
from FlagEmbedding import FlagModel

embedder = FlagModel('BAAI/bge-m3', use_fp16=True)
service = EmbeddingTextService()

# data_points
embedding_text = service.generate_data_point_text(dp)
embedding = embedder.encode([embedding_text], normalize_embeddings=True)
dp.embedding = embedding[0].tolist()
dp.embedding_text = embedding_text

# standards (신규)
embedding_text = service.generate_standard_text(std)
embedding = embedder.encode([embedding_text], normalize_embeddings=True)
std.section_embedding = embedding[0].tolist()
std.section_embedding_text = embedding_text

# rulebooks (확장됨)
embedding_text = service.generate_rulebook_text(rule)
embedding = embedder.encode([embedding_text], normalize_embeddings=True)
rule.section_embedding = embedding[0].tolist()
rule.section_embedding_text = embedding_text

# unified_column_mappings (확장됨)
embedding_text = service.generate_unified_mapping_text(unified_column)
embedding = embedder.encode([embedding_text], normalize_embeddings=True)
unified_column.unified_embedding = embedding[0].tolist()

# glossary (신규, synonyms_glossary 대체)
embedding_text = service.generate_glossary_text(term)
embedding = embedder.encode([embedding_text], normalize_embeddings=True)
term.term_embedding = embedding[0].tolist()
term.term_embedding_text = embedding_text

# dp_financial_linkages
embedding_text = service.generate_financial_linkage_text(linkage)
embedding = embedder.encode([embedding_text], normalize_embeddings=True)
linkage.impact_embedding = embedding[0].tolist()
linkage.impact_embedding_text = embedding_text
```

#### 증분 업데이트 (변경된 레코드만)

```python
from ifrs_agent.scripts.generate_embeddings import generate_all_embeddings
from datetime import datetime

# 특정 날짜 이후 업데이트된 레코드만 재생성
since = datetime(2024, 1, 1)
generate_all_embeddings(force_update=False, since=since)
```

**또는 직접 구현:**

```python
from ifrs_agent.service.embedding_text_service import EmbeddingTextService
from FlagEmbedding import FlagModel
from ifrs_agent.database.base import get_session
from ifrs_agent.model.models import DataPoint, Standard, Rulebook, Glossary
from sqlalchemy.sql import func

embedder = FlagModel('BAAI/bge-m3', use_fp16=True)
service = EmbeddingTextService()

def update_embeddings_for_changed_records(since: datetime):
    """변경된 레코드의 임베딩만 업데이트 (제안 6개 테이블 구조)"""
    db = get_session()
    
    # data_points
    dps = db.query(DataPoint).filter(
        DataPoint.is_active == True,
        DataPoint.updated_at >= since
    ).all()
    
    for dp in dps:
        embedding_text = service.generate_data_point_text(dp)
        embedding = embedder.encode([embedding_text], normalize_embeddings=True)
        dp.embedding = embedding[0].tolist()
        dp.embedding_text = embedding_text
        dp.embedding_updated_at = func.now()
    
    # standards (신규)
    stds = db.query(Standard).filter(
        Standard.is_active == True,
        Standard.updated_at >= since
    ).all()
    
    for std in stds:
        embedding_text = service.generate_standard_text(std)
        embedding = embedder.encode([embedding_text], normalize_embeddings=True)
        std.section_embedding = embedding[0].tolist()
        std.section_embedding_text = embedding_text
        std.section_embedding_updated_at = func.now()
    
    # rulebooks
    rules = db.query(Rulebook).filter(
        Rulebook.is_active == True,
        Rulebook.updated_at >= since
    ).all()
    
    for rule in rules:
        embedding_text = service.generate_rulebook_text(rule)
        embedding = embedder.encode([embedding_text], normalize_embeddings=True)
        rule.section_embedding = embedding[0].tolist()
        rule.section_embedding_text = embedding_text
        rule.section_embedding_updated_at = func.now()
    
    # glossary (신규)
    terms = db.query(Glossary).filter(
        Glossary.is_active == True,
        Glossary.updated_at >= since
    ).all()
    
    for term in terms:
        embedding_text = service.generate_glossary_text(term)
        embedding = embedder.encode([embedding_text], normalize_embeddings=True)
        term.term_embedding = embedding[0].tolist()
        term.term_embedding_text = embedding_text
        term.term_embedding_updated_at = func.now()
    
    db.commit()
```

### 9.6 성능 최적화

#### 인덱스 전략

1. **HNSW 인덱스**: 벡터 유사도 검색 (Cosine, L2, Inner Product)
2. **Partial Index**: 활성 레코드만 인덱싱 (`is_active = TRUE`)
3. **Composite Index**: 벡터 검색 + 필터 조합

```sql
-- 예: 특정 기준서의 DP만 검색
CREATE INDEX idx_dp_standard_embedding 
ON data_points 
USING hnsw (embedding vector_cosine_ops)
WHERE is_active = TRUE 
  AND standard = 'IFRS_S2' 
  AND embedding IS NOT NULL;
```

#### 검색 성능

- **HNSW 인덱스**: O(log N) 검색 시간
- **Cosine 유사도**: 정규화된 벡터 간 내적 계산
- **Top-K 검색**: LIMIT으로 결과 수 제한

### 9.7 마이그레이션

#### Alembic 마이그레이션 버전 목록

| 버전 | 설명 |
|------|------|
| 001 | 초기 스키마 생성 |
| 002 | 인덱스 추가 |
| 003 | Soft Delete 트리거 추가 |
| 004 | 임베딩 컬럼 추가 (pgvector) |
| 005 | document_chunks 테이블 추가 |
| 006 | document_chunks 이미지 필드 추가 |
| 007 | rulebooks.related_dp_ids 추가 |
| 008 | mapping_type_enum 확장 |
| 009 | unified_column_mappings 테이블 추가 |
| **010** | **제안 6개 테이블 구조로 마이그레이션** |

#### 마이그레이션 010 (schema_restructure) 내용

```bash
# 마이그레이션 실행
alembic upgrade head
```

**마이그레이션 010 주요 내용**:

1. **ENUM 확장**: `disclosure_requirement_enum`에 '조건부' 추가
2. **data_points 인덱스 추가**: `standard`, `topic`, `parent_indicator`
3. **standards 테이블 생성 (신규)**: 기준서 공통 정보
   - **복합 PK** `(standard_id, section_name)` — 기준서당 여러 섹션(목적/적용범위/일반요구사항 등) 각각 1 row
   - `section_content` NOT NULL
4. **rulebooks 테이블 확장**:
   - PK 타입 변경: `Integer` → `VARCHAR(50)`
   - 컬럼 추가: `primary_dp_id`, `rulebook_title`, `rulebook_content`, `paragraph_reference`, `key_terms`, `related_concepts`, `disclosure_requirement`, `is_primary`, `version`, `effective_date`, `conflicts_with`, `mapping_notes`
5. **unified_column_mappings 테이블 확장**: `primary_standard`, `primary_rulebook_id`, `applicable_standards`, `mapping_confidence`, `mapping_notes`, `rulebook_conflicts`
6. **disclosure_methods 테이블 생성 (신규)**: 공시 방법/템플릿
7. **glossary 테이블 생성 (신규)**: `synonyms_glossary` 데이터 이관, **term_ko UNIQUE** 제약
8. **standard_mappings 테이블 제거**: 더 이상 사용하지 않음
9. **mapping_type_enum 제거**: 더 이상 사용하지 않음

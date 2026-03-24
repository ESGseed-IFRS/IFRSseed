# 시스템 아키텍처 및 워크플로우

## 📚 관련 문서

이 문서를 읽기 전/후에 다음 문서를 함께 참고하세요:
- [DATA_ONTOLOGY.md](./DATA_ONTOLOGY.md) - 데이터 구조 및 DP 설계 이해
- [NODES.md](./NODES.md) - 노드별 상세 구현 방법
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 단계별 구현 계획
- [DATA_COLLECTION.md](./DATA_COLLECTION.md) - 데이터 수집 전략 및 파싱 방법

---

## 1. 아키텍처 개요

본 시스템은 **LangGraph 기반의 Supervisor 중심 오케스트레이션** 구조로 설계됩니다. Supervisor가 노드를 직접 호출하고 제어하는 진정한 오케스트레이터 역할을 수행하며, LangGraph는 State 관리와 체크포인팅만 담당합니다.

### 1.1 Supervisor 중심 오케스트레이션 구조

**핵심 설계**: Supervisor가 노드를 직접 호출하고 제어하는 구조로, 동적 워크플로우 결정과 실시간 피드백 반영이 가능합니다.

```
                    ┌─────────────────────┐
                    │      Supervisor     │
                    │   (Orchestrator)    │
                    │   Llama 3.3 70B     │
                    │                     │
                    │  - 노드 직접 호출    │
                    │  - 동적 워크플로우   │
                    │  - 검증 + 감사 통합  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Shared State      │
                    │   (LangGraph)       │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │   RAG Node   │   │   Gen Node   │   │ Design Node  │
    │              │   │              │   │              │
    │ (Supervisor  │   │ (Supervisor  │   │ (Supervisor  │
    │  직접 호출)   │   │  직접 호출)   │   │  직접 호출)   │
    └──────────────┘   └──────────────┘   └──────────────┘
```

**주요 특징**:
- ✅ **Supervisor 직접 호출**: Supervisor가 `orchestrate()` 메서드로 모든 노드를 직접 호출
- ✅ **동적 워크플로우**: LLM 기반으로 다음 액션을 결정하여 상황에 맞는 노드 선택
- ✅ **LangGraph 역할**: State 관리와 체크포인팅만 담당 (워크플로우 제어는 Supervisor)
- ✅ **Validation 통합**: 검증과 감사 로직이 Supervisor 내부에 통합되어 있음

### 1.2 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **중앙 집중 제어** | Supervisor가 모든 의사결정 및 품질 검수 담당 |
| **노드 독립성** | 각 노드는 특화된 단일 책임만 수행 |
| **상태 공유** | LangGraph State를 통한 노드 간 데이터 정합성 유지 |
| **반복 루프** | 품질 미달 시 재요청 메커니즘 |
| **감사 추적** | 모든 결정에 대한 근거(Rationale) 기록 |

---

## 2. 워크플로우 상세

### 2.1 전체 흐름도

```
┌─────────┐
│  Entry  │
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│         Supervisor.orchestrate()             │
│  (전체 워크플로우를 직접 제어)                │
└────┬────────────────────────────────────────┘
     │
     ├─▶ 1. analyze() - 요청 분석 및 DP 식별
     │
     ├─▶ 2. _decide_next_action() - 다음 액션 결정 (LLM)
     │
     ├─▶ 3. 노드 MCP 호출 (반복)
     │   ├─▶ _call_rag_node() - 데이터 추출
     │   │   └─▶ MCP를 통해 rag_node.process(state) 호출
     │   │
     │   ├─▶ review() - 결과 검토
     │   │
     │   ├─▶ _call_gen_node() - 문단 생성
     │   │   └─▶ MCP를 통해 gen_node.process(state) 호출
     │   │
     │   └─▶ _call_design_node() - 디자인 추천 (선택적)
     │       └─▶ MCP를 통해 design_node.process(state) 호출
     │
     └─▶ 4. validate_and_audit() - 최종 검증 및 감사
         │
         └─▶ 5. 완료 또는 재시도 (반복 루프)
             
┌─────────────┐
│    End      │
│  (출력)     │
└─────────────┘
```

**핵심 차이점**:
- LangGraph는 단순히 `supervisor_orchestrate` 노드 하나만 실행
- Supervisor 내부에서 모든 노드를 직접 호출하고 제어
- 동적 워크플로우: LLM이 상황에 따라 다음 액션을 결정

### 2.2 단계별 상세

#### **[Entry] 사용자 입력**

사용자가 SR 보고서 작성을 요청하는 진입점입니다.

**입력 형태:**
- SR 보고서 PDF/Excel 업로드
- 작성 쿼리 (예: "기후 리스크 재무 영향 섹션 작성")
- 대상 기준서 선택 (IFRS S1, S2 등)

**회의 반영 사항:**
- 월별 입력 UI (그리드 화면, 엑셀 업로드)
- 데이터 마감 고려 (12월 마감 후 1~3월 완성)

```python
# 입력 스키마 예시
class UserInput(BaseModel):
    query: str                          # 작성 요청 쿼리
    documents: List[UploadFile]         # 업로드 문서
    target_standards: List[str]         # 대상 기준서
    fiscal_year: int                    # 회계연도
    company_id: str                     # 기업 식별자
```

---

#### **[Supervisor] 오케스트레이터**

중앙 제어 역할을 담당하며, 감사관(Auditor) 페르소나로 동작합니다.

**주요 기능:**
1. **요청 분석**: 사용자 쿼리 파싱 및 필요 DP 식별
2. **노드 지시**: 적절한 노드에 작업 할당
3. **데이터 검토**: 추출된 데이터 충분성 판단
4. **Audit**: IFRS 준수 여부 최종 검증

**회의 반영 사항:**
- 지표 DP 분해·중복 제거 룰 주입
- 그린워싱 방지 (공시 데이터 비교)
- 입력 검증 (오류 시 레드 박스 경고)

```python
# Supervisor 지시 예시
class SupervisorInstruction(BaseModel):
    target_node: Literal["rag", "gen", "validation"]
    instruction: str
    required_dps: List[str]          # 필요한 Data Points
    validation_rules: List[str]      # 검증 규칙
    max_retries: int = 3
```

---

#### **[RAG Node] 검색 및 추출**

외부/내부 데이터를 검색하고 DP 단위로 추출합니다.

**주요 기능:**
1. **쿼리 최적화**: 검색 쿼리 재구성
2. **하이브리드 검색**: Dense + Sparse 검색
3. **데이터 분류**: 정량/정성 데이터 분류
4. **JSON 팩트 시트 생성**: 구조화된 데이터 출력

**회의 반영 사항:**
- PDF 섹션 추출 (목차 기반 텍스트 변환)
- 크롤링 모듈 (미디어·경쟁사·DART 데이터북)
- 3개년 시계열 데이터 추출

```python
# RAG 출력 팩트 시트 예시
class FactSheet(BaseModel):
    dp_id: str                       # Data Point ID
    dp_name: str                     # Data Point 명칭
    values: Dict[int, Any]           # 연도별 값
    unit: str                        # 단위
    source: str                      # 출처
    page_reference: str              # 페이지 참조
    confidence: float                # 신뢰도 점수
```

---

#### **[Gen Node] 문단 생성**

팩트 시트를 기반으로 IFRS 문체의 문단을 생성합니다.

**주요 기능:**
1. **IFRS 문체 적용**: LoRA 학습된 전문 문체
2. **재무 연결성 강조**: Financial Linkage 명시
3. **시계열 분석**: 전년 대비 변화 설명
4. **근거 주석 생성**: 출처 자동 첨부

**회의 반영 사항:**
- 이전 년도 데이터 조합 추천
- 100페이지 SR 드래프트 생성
- 정량·정성 문장 혼합

```python
# Gen Node 출력 예시
class GeneratedParagraph(BaseModel):
    section_id: str                  # 섹션 ID
    content: str                     # 생성된 문단
    rationale: str                   # 작성 근거
    sources: List[str]               # 참조 출처
    financial_linkage: str           # 재무 연결 설명
    suggested_visuals: List[str]     # 추천 시각화
```

---

#### **[Supervisor] 검증 및 감사 통합**

⚠️ **변경사항**: Validation Node가 Supervisor에 통합되었습니다.

Supervisor가 **Llama 3.3 70B 하나로** 감사와 검증을 모두 수행합니다.

**주요 기능:**
1. **범위 검증**: 값의 합리적 범위 체크 (규칙 기반)
2. **공시 비교**: 기존 공시 데이터와 비교
3. **그린워싱 탐지**: 과장/허위 표현 감지 (LLM 기반 심층 분석)
4. **IFRS 준수 검사**: 기준서 요구사항 충족 확인 (규칙 기반)
5. **최종 품질 감사**: 검증 결과를 바탕으로 최종 결정

**모델 통일의 장점:**
- 정확도 향상: 그린워싱 탐지 정확도 향상 (미묘한 표현 탐지)
- 일관성: 감사와 검증이 같은 모델로 일관된 기준 적용
- 단순화: 별도 모델 관리 불필요

```python
# 검증 결과 예시
class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[ValidationError]
    warnings: List[ValidationWarning]
    greenwashing_risk: float         # 그린워싱 위험도 (0-1)
    compliance_score: float          # IFRS 준수 점수
```

---

## 3. LangGraph 상태 설계

### 3.1 공유 상태 스키마

```python
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph

class IFRSAgentState(TypedDict):
    # 입력 정보
    query: str
    documents: List[str]
    target_standards: List[str]
    fiscal_year: int
    company_id: str
    
    # 처리 상태
    current_node: str
    iteration_count: int
    
    # 추출 데이터
    target_dps: List[str]            # 필요한 DP 목록
    fact_sheets: List[Dict]          # 추출된 팩트 시트
    yearly_data: Dict[int, Dict]     # 연도별 데이터
    
    # 생성 결과
    generated_sections: List[Dict]   # 생성된 섹션들
    
    # 검증 결과
    validation_results: List[Dict]
    
    # 기업 아이덴티티
    corporate_identity: Dict[str, Any]  # 컬러, 스타일 등
    
    # 메타 정보
    reference_sources: List[str]     # 참조 출처 목록
    audit_log: List[Dict]            # 감사 로그
```

### 3.2 상태 전이 다이어그램

```
                    ┌─────────────────┐
                    │   initialized   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   analyzing     │◀──────┐
                    └────────┬────────┘       │
                             │                │
                             ▼                │
                    ┌─────────────────┐       │
                    │   retrieving    │───────┤ (재검색)
                    └────────┬────────┘       │
                             │                │
                             ▼                │
                    ┌─────────────────┐       │
                    │   reviewing     │───────┘
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   generating    │◀──────┐
                    └────────┬────────┘       │
                             │                │
                             ▼                │
                    ┌─────────────────┐       │
                    │   validating    │───────┤ (재생성)
                    └────────┬────────┘       │
                             │                │
                             ▼                │
                    ┌─────────────────┐       │
                    │   auditing      │───────┘
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   completed     │
                    └─────────────────┘
```

---

## 4. 반복 루프 메커니즘

### 4.1 데이터 충분성 검토 루프

```python
def check_data_sufficiency(state: IFRSAgentState) -> str:
    """데이터 충분성 검토 후 다음 노드 결정"""
    required_dps = set(state["target_dps"])
    extracted_dps = set(fs["dp_id"] for fs in state["fact_sheets"])
    
    missing_dps = required_dps - extracted_dps
    
    if missing_dps and state["iteration_count"] < MAX_RETRIES:
        return "rag_node"  # 재검색
    elif missing_dps:
        return "gen_node_with_warning"  # 경고와 함께 진행
    else:
        return "gen_node"  # 정상 진행
```

### 4.2 품질 검증 루프

```python
def check_quality(state: IFRSAgentState) -> str:
    """품질 검증 후 다음 노드 결정"""
    validation = state["validation_results"][-1]
    
    if validation["greenwashing_risk"] > 0.7:
        return "reject"  # 거부
    elif validation["compliance_score"] < 0.8:
        return "gen_node"  # 재생성
    else:
        return "end"  # 완료
```

---

## 5. 에러 처리 및 복구

### 5.1 에러 유형

| 에러 유형 | 처리 방법 |
|----------|----------|
| **API 타임아웃** | 지수 백오프 재시도 (최대 3회) |
| **데이터 부족** | 경고 로그 후 가용 데이터로 진행 |
| **검증 실패** | 재생성 또는 사용자 확인 요청 |
| **그린워싱 탐지** | 즉시 중단 및 관리자 알림 |

### 5.2 복구 전략

```python
class ErrorRecoveryStrategy:
    @staticmethod
    def handle_api_timeout(error: Exception, state: IFRSAgentState):
        """API 타임아웃 복구"""
        if state["iteration_count"] < MAX_RETRIES:
            time.sleep(2 ** state["iteration_count"])
            return "retry"
        return "fallback"
    
    @staticmethod
    def handle_data_missing(missing_dps: List[str], state: IFRSAgentState):
        """데이터 부족 복구"""
        state["audit_log"].append({
            "type": "warning",
            "message": f"Missing DPs: {missing_dps}",
            "timestamp": datetime.now()
        })
        return "continue_with_warning"
```

---

## 6. 성능 최적화

### 6.1 병렬 처리

```python
# 여러 DP를 병렬로 검색
async def parallel_dp_extraction(dps: List[str]) -> List[FactSheet]:
    tasks = [extract_dp(dp) for dp in dps]
    return await asyncio.gather(*tasks)
```

### 6.2 캐싱 전략

| 캐시 대상 | TTL | 저장소 |
|----------|-----|--------|
| 임베딩 결과 | 24시간 | Redis |
| 크롤링 데이터 | 1시간 | Redis |
| 온톨로지 쿼리 | 영구 | Memory |
| 생성 결과 | 세션 | Memory |

---

## 7. 확장성 고려사항

### 7.1 새 노드 추가

```python
# 새 노드 추가 예시 (디자인 추천 노드)
class DesignRecommendationNode(BaseNode):
    def process(self, state: IFRSAgentState) -> IFRSAgentState:
        # 기업 BI 기반 시각화 추천
        corporate_colors = state["corporate_identity"]["colors"]
        recommendations = self.generate_visual_guide(corporate_colors)
        state["design_recommendations"] = recommendations
        return state
```

### 7.2 새 기준서 지원

온톨로지에 새 기준서 데이터를 추가하면 시스템 전체에서 자동 지원됩니다.

```python
# 제안 6개 테이블 구조에서 새 기준서 추가
# Standards는 복합 PK (standard_id, section_name) — 기준서당 여러 섹션(목적/적용범위 등) 각각 1 row

# 1. Standards 테이블에 기준서 공통 정보 추가 (섹션별로 row 추가)
new_standard = Standard(
    standard_id="NEW_STANDARD",
    section_name="목적",
    standard_name="새 기준서",
    section_content="새 기준서의 목적 설명...",
    section_type="objective"
)
db.add(new_standard)
# 적용범위 등 추가 섹션이 있으면 (standard_id, section_name) 조합으로 row 추가

# 2. Rulebooks 테이블에 공시 요구사항 추가
new_rulebook = Rulebook(
    rulebook_id="NS_001",
    standard_id="NEW_STANDARD",
    section_name="공시 요구사항 1",
    rulebook_content="...",
    related_dp_ids=["NS-001", "NS-002"]
)
db.add(new_rulebook)

# 3. UnifiedColumnMapping에 기존 통합 컬럼과 연결
# 예: 새 기준서의 DP를 기존 통합 컬럼에 추가
unified_mapping = db.query(UnifiedColumnMapping).filter_by(
    unified_column_id="001_aa"
).first()
unified_mapping.mapped_dp_ids.append("NS-001")
unified_mapping.applicable_standards.append("NEW_STANDARD")
```

---

## 8. 매핑 추천 시스템 아키텍처

### 8.1 레이어 구조

매핑 추천 시스템은 **3계층 아키텍처**로 설계되어 있습니다:

```
┌─────────────────────────────────────────┐
│  Script Layer (트리거/CLI 인터페이스)    │
│  - 명령줄 인자 파싱                      │
│  - Service 호출                         │
│  - 결과 출력                            │
│  예: auto_suggest_mappings_improved.py  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Service Layer (비즈니스 로직)           │
│  - 매핑 추천 알고리즘                    │
│  - 하이브리드 검색 (벡터 + 구조적)        │
│  - 매핑 타입 자동 결정                   │
│  - 통계 수집 및 프로세스 관리            │
│  예: MappingSuggestionService           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Repository Layer (데이터 접근)          │
│  - CRUD 작업                            │
│  - 쿼리 실행                            │
│  - 트랜잭션 관리                         │
│  예: MappingRepository                  │
└──────────────┬──────────────────────────┘
               │
               ▼
          Database
```

### 8.2 각 레이어의 역할

#### **Script Layer (트리거 역할)**

스크립트는 **CLI 진입점**으로, 실제 비즈니스 로직은 포함하지 않습니다.

**주요 책임:**
- 명령줄 인자 파싱 (`argparse`)
- 데이터베이스 세션 생성
- Service 메서드 호출
- 결과 출력 및 로깅

**특징:**
- ✅ **얇은 래퍼**: 비즈니스 로직 없음
- ✅ **재사용 가능**: Service 레이어를 다른 곳에서도 호출 가능
- ✅ **제거 가능**: 필요시 Python 코드에서 직접 Service 호출 가능

**예시 (제안 6개 테이블 구조):**
```python
# 스크립트에서 Service 호출
# 참고: StandardMapping 테이블이 제거되어 통합 컬럼 기반으로 매핑 관리
from ifrs_agent.service.embedding_text_service import EmbeddingTextService

service = EmbeddingTextService()

# DP 임베딩 텍스트 생성
embedding_text = service.generate_data_point_text(dp)

# Rulebook 임베딩 텍스트 생성
embedding_text = service.generate_rulebook_text(rulebook)

# 통합 컬럼 매핑 임베딩 텍스트 생성
embedding_text = service.generate_unified_mapping_text(unified_column)
```

#### **Service Layer (비즈니스 로직)**

Service는 **핵심 비즈니스 로직**을 담당합니다.

**주요 책임:**
- 하이브리드 검색 (벡터 검색 + 구조적 필터링)
- 통합 컬럼 매핑 관리
- 임베딩 텍스트 생성
- 통계 수집 및 관리

**핵심 메서드 (EmbeddingTextService):**
- `generate_data_point_text()`: DP 임베딩 텍스트 생성
- `generate_standard_text()`: 기준서 임베딩 텍스트 생성
- `generate_rulebook_text()`: Rulebook 임베딩 텍스트 생성
- `generate_unified_mapping_text()`: 통합 컬럼 매핑 임베딩 텍스트 생성
- `generate_glossary_text()`: 용어집 임베딩 텍스트 생성

> **참고**: `MappingSuggestionService`의 매핑 추천 기능은 `StandardMapping` 테이블 제거로 인해 Deprecated 상태입니다. 기준서 간 매핑은 `UnifiedColumnMapping`을 통해 관리됩니다.

#### **Repository Layer (데이터 접근)**

Repository는 **데이터 접근 로직**만 담당합니다.

**주요 책임:**
- DataPoint, Rulebook, UnifiedColumnMapping 조회
- CRUD 작업
- 트랜잭션 관리 (`commit`, `rollback`)

**핵심 메서드:**
- `get_data_points_by_standard()`: 기준서별 DP 조회
- `get_rulebook_by_dp()`: DP에 연결된 Rulebook 조회
- `get_unified_mapping_by_dp()`: DP가 포함된 통합 컬럼 매핑 조회

> **참고**: `StandardMapping` 테이블이 제거되었습니다. 기준서 간 매핑은 `UnifiedColumnMapping.mapped_dp_ids`와 `Rulebook.related_dp_ids`를 통해 관리됩니다.

### 8.3 데이터 흐름

```
사용자 (터미널)
    ↓
generate_embeddings.py (배치 임베딩 생성)
    ↓
EmbeddingTextService (임베딩 텍스트 생성)
    ├─→ generate_data_point_text()     (data_points)
    ├─→ generate_standard_text()       (standards - 신규)
    ├─→ generate_rulebook_text()       (rulebooks - 확장)
    ├─→ generate_unified_mapping_text() (unified_column_mappings)
    ├─→ generate_glossary_text()       (glossary - 신규)
    └─→ generate_financial_linkage_text() (dp_financial_linkages)
    ↓
FlagModel (BGE-M3 임베딩 생성)
    ↓
Database (제안 6개 테이블 + 보조 테이블)
```

> **참고**: `StandardMapping` 테이블이 제거되었습니다. 기준서 간 매핑은 `UnifiedColumnMapping`과 `Rulebook`을 통해 관리됩니다.

### 8.4 아키텍처 장점

| 장점 | 설명 |
|------|------|
| **관심사 분리** | 각 레이어가 명확한 책임을 가짐 |
| **테스트 용이성** | 각 레이어를 독립적으로 테스트 가능 |
| **재사용성** | Service 메서드를 다른 곳에서도 사용 가능 |
| **유지보수성** | 로직 변경 시 해당 레이어만 수정 |
| **확장성** | 새로운 Repository나 Service 추가가 쉬움 |

### 8.5 스크립트 제거 고려사항

**스크립트는 트리거 역할만 수행**하므로, 필요시 제거 가능합니다.

**제거 가능 조건:**
- ✅ 다른 코드에서 import하지 않음
- ✅ 기능이 Service 레이어로 완전히 이동
- ✅ Python 코드에서 직접 Service 호출 가능

**제거 시 대안:**
```python
# Python 코드에서 직접 호출
from ifrs_agent.database.base import get_session
from ifrs_agent.service.mapping_suggestion_service import MappingSuggestionService

db = get_session()
service = MappingSuggestionService(db)
stats = service.auto_suggest_mappings_batch(
    source_standard="GRI",
    target_standard="IFRS_S2",
    batch_size=100
)
```

**유지 권장 이유:**
- CLI에서 직접 실행 가능한 편의성
- 배치 작업/자동화에 유용
- 사용자가 터미널에서 쉽게 실행 가능

---

## 9. ERP 데이터 검증 및 수정 요청 파이프라인

### 9.1 개요

ERP 시스템에서 ESG 플랫폼으로 데이터가 들어올 때, 전처리, 검증, 이상 탐지 및 수정 요청을 자동화하는 파이프라인입니다.

**실제 기업들의 표준 방식:**
- **SAP Green Ledger**: ERP 트랜잭션 기반 데이터 수집 → 재무 수준의 정확성 검증 → 이상 탐지
- **SAP Sustainability Control Tower**: 데이터 정확성 검증, 완전성 점검, 워크플로우, 기결산 프로세스
- **Oracle Fusion Cloud Sustainability**: 자동 수집 → 자동 검증 → 감사 가능한 데이터 기록

**우리 플랫폼의 고도화된 접근:**
- 전처리: Python 로직 (빠르고 정확)
- 검증: Python 로직 + 규칙 기반 (표준 방식)
- 이상 탐지: 전년도 비교 + LLM 기반 맥락 분석 (고도화)
- 수정 요청: LLM 기반 지능형 요청 생성 (고도화)

### 9.2 파이프라인 아키텍처

```
ERP 시스템 (SAP/Oracle/더존)
    ↓
[1. 데이터 수집] (SourceSystemConnector)
    - ERP API 호출
    - 원시 데이터 수집
    ↓
[2. 전처리] (ERPDataPreprocessor - Python 로직)
    - 데이터 타입 변환
    - 단위 통일 (kWh → MWh, kg → t)
    - 필드명 매핑 (ERP 필드 → ESG 필드)
    - 누락값 처리
    - 중복 제거
    ↓
[3. 검증] (ERPDataValidator - Python 로직)
    - 필수 필드 검증
    - 범위 검증 (0-100%, 최소/최대값)
    - 일관성 검증 (합계, 비율)
    - 전년도 비교 (이상 수치 탐지)
    - 업계 평균 비교
    ↓
[4. 이상 탐지 에이전트] (AnomalyDetectionAgent - LLM)
    - 전년도 대비 급격한 변화 분석
    - 맥락 기반 정상/오류 구분
    - 원인 추론
    - 확인/수정 필요 여부 판단
    ↓
[5. 수정 요청 에이전트] (CorrectionRequestAgent - LLM)
    - 구체적이고 실행 가능한 수정 요청 생성
    - 심각도 분류 (critical/high/medium/low)
    - 수정 방법 제안
    - 기한 설정
    ↓
[6. 사용자 알림 및 처리] (4단계 역할 구조 기반)
    - 이메일/앱 알림
    - 플랫폼에서 확인/수정
    - Workflow 승인 프로세스:
      • 현업팀 (역할 3) → 데이터 입력 및 검토 요청
      • ESG팀 (역할 2) → 데이터 검토 및 승인 요청
      • 최종 승인권자 (역할 1) → 최종 승인 및 저장
    ↓
ESG 플랫폼 DB
```

### 9.3 구성 요소 상세

#### 9.3.1 전처리 모듈 (Python 로직)

**역할**: ERP 원시 데이터를 ESG 플랫폼 형식으로 변환

**주요 기능**:
- 데이터 타입 변환 (문자열 → 숫자, 날짜 파싱)
- 단위 통일 (kWh → MWh, kg → t, m³ → cubic_meter)
- 필드명 매핑 (ERP 필드명 → ESG 표준 필드명)
- 누락값 처리 (전년도 값으로 채우기, 기본값 설정)
- 중복 제거 (같은 날짜/기간의 중복 레코드)

**처리 속도**: 빠름 (Python 로직, LLM 호출 없음)

#### 9.3.2 검증 모듈 (Python 로직)

**역할**: 데이터 품질 검증 및 이상 수치 탐지

**주요 기능**:
- 필수 필드 검증 (누락 필드 확인)
- 범위 검증 (백분율 0-100%, 임직원 수 1-10,000,000 등)
- 일관성 검증 (성별 비율 합계 100%, Scope 1+2+3 = 총 배출량)
- 전년도 비교 (변화율 계산, 임계값 초과 시 이상 수치 기록)
- 업계 평균 비교 (업종별 평균 대비 이상치 탐지)

**처리 속도**: 빠름 (Python 로직, DB 조회 포함)

#### 9.3.3 이상 탐지 에이전트 (LLM 기반)

**역할**: 맥락을 고려한 이상 수치 분석

**주요 기능**:
- 전년도 대비 급격한 변화의 원인 추론
- 정상 변화와 오류 구분 (예: 태양광 패널 설치로 인한 재생에너지 비율 증가는 정상)
- 가능한 원인 제시 (설비 투자, 계약 체결, 데이터 오류 등)
- 확인/수정 필요 여부 판단

**모델**: Llama 3.3 70B (Supervisor와 동일)

**처리 속도**: 중간 (LLM 호출 필요)

#### 9.3.4 수정 요청 에이전트 (LLM 기반)

**역할**: 구체적이고 실행 가능한 수정 요청 생성

**주요 기능**:
- 검증 결과를 바탕으로 수정 요청 생성
- 심각도 분류 (critical/high/medium/low)
- 구체적인 수정 방법 제안
- 기한 설정 (critical: 1일, high: 3일, medium: 5일)
- 확인 요청 vs 수정 요청 구분

**모델**: Llama 3.3 70B (Supervisor와 동일)

**처리 속도**: 중간 (LLM 호출 필요)

### 9.4 실제 기업 방식과의 비교

| 구성 요소 | 실제 기업 방식 (SAP/Oracle) | 우리 플랫폼 방식 | 차별점 |
|----------|---------------------------|----------------|--------|
| **전처리** | Python/Java 로직 | Python 로직 | ✅ 일치 |
| **데이터 검증** | 규칙 기반 검증 | 규칙 기반 검증 | ✅ 일치 |
| **이상 탐지** | 통계적 방법 (전년도 비교) | 전년도 비교 + LLM 분석 | ✅ 고도화 |
| **수정 요청** | 워크플로우 시스템 | LLM 기반 수정 요청 생성 | ✅ 고도화 |
| **감사 추적** | 데이터 리니지 추적 | 데이터 리니지 추적 | ✅ 일치 |

**우리 플랫폼의 차별점:**
- **LLM 기반 이상 수치 분석**: 맥락을 고려하여 정상 변화와 오류를 정확히 구분
  - 예: "26% 증가" → 통계적 방법은 "이상 수치"로 판단하지만, LLM은 "태양광 패널 설치로 인한 정상 변화"로 판단
- **지능형 수정 요청 생성**: 상황에 맞는 구체적이고 실행 가능한 수정 요청 자동 생성
  - 예: "임직원 수 확인 필요" → "ERP 시스템의 인사 모듈에서 정확한 임직원 수 확인 후 재입력 필요"

### 9.5 데이터 흐름 예시

**시나리오**: 매월 1일 오전 9시, SAP ERP에서 ESG 데이터 자동 수집

1. **데이터 수집**: SAP API 호출 → 에너지 사용량 1,250,000 kWh 수집
2. **전처리**: 1,250,000 kWh → 1,250 MWh 변환, 필드명 매핑
3. **검증**: 범위 검증 통과, 전년도(1,000 MWh)와 비교 → +25% 증가 (정상)
4. **이상 탐지**: 재생에너지 비율 12.3% → 15.5% (+26% 증가, 임계값 20% 초과)
5. **LLM 분석**: "태양광 패널 설치로 인한 정상 변화 가능성 높음, 확인 권장"
6. **수정 요청**: "재생에너지 비율 확인 요청 - 태양광 패널 설치 완료 여부 확인 필요"
7. **사용자 확인**: 담당자가 확인 후 "정상 변화" 승인
8. **최종 저장**: ESG 플랫폼 DB에 저장

### 9.6 구현 우선순위

**Phase 1 (즉시 구현)**:
- 전처리 모듈 (Python 로직)
- 기본 검증 모듈 (Python 로직)

**Phase 2 (단기 - 3개월)**:
- 전년도 비교 이상 탐지
- 업계 평균 비교

**Phase 3 (중기 - 6개월)**:
- 이상 탐지 에이전트 (LLM 기반)
- 수정 요청 에이전트 (LLM 기반)

**Phase 4 (장기 - 12개월)**:
- 실시간 이상 탐지
- 예측 기반 이상 탐지 (머신러닝)

---

## 10. 사용자 역할 및 권한 관리 (4단계 구조)

### 10.1 개요

본 시스템은 **KPMG 기반 4단계 역할 구조**를 채택하여 기업 내 ESG 데이터 관리 및 보고서 생성 프로세스를 체계화합니다.

**설계 원칙:**
- 명확한 역할 분담 및 책임 소재
- 자동화된 승인 워크플로우
- 실시간 상태 추적 및 알림
- 부서별 데이터 입력 권한 분리
- **HRIS 기반 자동 역할 할당** (사용자 선택 불가, 보안 강화)

### 10.1.1 회사 등록 및 사용자 등록 Workflow (2단계 구조)

**Step 1: 회사 등록 (HRIS 불필요)**

1. **회사정보 입력 및 DART API 연동**
   - 회사명, 사업자등록번호 입력
   - DART API 호출로 회사 정보 자동 조회
   - 회사 ID 생성
   - 대표이사 이메일 획득

2. **회사정보 확인**
   - DART API로 불러온 회사정보 확인 (조회 전용)
   - "확인 완료" 체크박스 클릭

3. **회사 등록 완료 및 초대 링크 발송**
   - 회사 등록 완료
   - 대표이사 이메일로 초대 링크 자동 발송
   - 초대 링크 유효기간 설정 (7일)

**Step 2: 최초 관리자 생성 (방법 A: 대표이사 이메일 초대 링크, HRIS 불필요)**

1. **초대 링크 수신 및 검증**
   - 대표이사 이메일로 초대 링크 수신
   - 초대 링크 클릭
   - 초대 토큰 검증
   - 회사 정보 확인

2. **비밀번호 설정**
   - 비밀번호 설정 (특수문자, 영문, 숫자 포함, 8~14자)
   - 비밀번호 확인 입력

3. **최초 관리자 계정 생성**
   - 이메일, 비밀번호 저장 (암호화)
   - 자동으로 "최종 승인권자" 역할 부여
   - 최초 관리자 플래그 설정 (is_first_admin=True)
   - 회사 정보 연동

**Step 3: 일반 사용자 등록**

1. **회사정보 입력 및 DART API 연동**
   - 회사명, 사업자등록번호 입력
   - DART API 호출로 회사 정보 자동 조회
   - 회사 등록 상태 확인 (이미 등록된 회사인지 확인)

2. **회사정보 확인**
   - DART API로 불러온 회사정보 확인 (조회 전용)
   - "확인 완료" 체크박스 클릭

3. **사용자 이메일 입력 및 인증**
   - 사용자 이메일 주소 입력
   - 이메일 인증 코드 발송 및 검증
   - 인증 완료 확인

4. **비밀번호 설정**
   - 비밀번호 설정 (특수문자, 영문, 숫자 포함, 8~14자)
   - 비밀번호 확인 입력

5. **HRIS 사용자 정보 자동 조회 및 역할 할당** ⭐ 핵심
   - 회사 ID와 이메일로 HRIS API 호출
   - HRIS가 회사 소속 여부 자동 검증 (도메인 검증 불필요)
   - 사용자 정보 자동 조회 (직급, 부서, 사번 등)
   - **역할 자동 할당** (사용자 선택 불가):
     - **역할 1: 최종 승인권자** (직급: 대표이사, 사장, CEO)
     - **역할 2: ESG팀** (부서: ESG팀)
     - **역할 3: 현업팀** (부서: 환경안전팀, 인사팀, 재무팀, 경영지원팀)
     - **역할 4: 일반 사용자** (기본값, HRIS 조회 실패 시)
   - **HRIS 조회 실패 시**: 최초 관리자 승인 필요

6. **사용자 계정 생성**
   - 이메일, 비밀번호 저장 (암호화)
   - 역할 정보 저장
   - 직급/부서 정보 저장 (HRIS에서 가져온 정보 또는 승인 대기)
   - HRIS 연동 정보 저장
   - 최초 관리자에게 승인 요청 알림 (HRIS 조회 실패 시)

**기술 구현:**

```python
class CompanyRegistrationService:
    """회사 등록 서비스"""
    
    async def register_company(
        self,
        business_number: str,
        company_name: str
    ) -> Dict:
        """
        회사 등록 (HRIS 불필요)
        
        Args:
            business_number: 사업자등록번호
            company_name: 회사명
        
        Returns:
            {
                "company_id": "company_123",
                "invite_link": "https://...",
                "ceo_email": "ceo@company.com",
                "message": "회사 등록 완료. 대표이사 이메일로 초대 링크를 발송했습니다."
            }
        """
        # DART API로 회사 정보 조회
        company_info = await self.dart_client.get_company_info(
            business_number=business_number
        )
        
        # 회사 생성
        company = await self._create_company(company_info)
        
        # 최초 관리자 초대 링크 생성
        invite_token = await self._generate_invite_token(
            company_id=company["id"],
            ceo_email=company_info["ceo_email"]
        )
        
        # 대표이사 이메일로 초대 링크 발송
        invite_link = f"https://platform.com/invite/{invite_token}"
        await self._send_invite_email(
            email=company_info["ceo_email"],
            company_name=company_info["company_name"],
            invite_link=invite_link
        )
        
        return {
            "company_id": company["id"],
            "invite_link": invite_link,
            "ceo_email": company_info["ceo_email"],
            "message": "회사 등록 완료. 대표이사 이메일로 초대 링크를 발송했습니다."
        }

class AdminInviteService:
    """최초 관리자 초대 서비스"""
    
    async def accept_invite(
        self,
        invite_token: str,
        password: str
    ) -> Dict:
        """
        초대 링크 수락 및 최초 관리자 생성 (HRIS 불필요)
        
        Args:
            invite_token: 초대 토큰
            password: 비밀번호
        
        Returns:
            {
                "user_id": "user_123",
                "role": "final_approver",
                "is_first_admin": True,
                "message": "최초 관리자로 등록되었습니다."
            }
        """
        # 초대 토큰 검증
        invite = await self._verify_invite_token(invite_token)
        if not invite:
            raise InvalidInviteTokenError("유효하지 않은 초대 링크입니다.")
        
        # 최초 관리자 생성 (HRIS 불필요)
        admin = await self._create_user(
            email=invite["email"],
            password=password,
            company_id=invite["company_id"],
            role="final_approver",  # 자동으로 최종 승인권자
            is_first_admin=True  # 최초 관리자 플래그
        )
        
        return {
            "user_id": admin["id"],
            "role": "final_approver",
            "is_first_admin": True,
            "message": "최초 관리자로 등록되었습니다."
        }

class HRISClient:
    """HRIS 시스템 클라이언트"""
    
    async def get_user_by_company_and_email(
        self, 
        company_id: str, 
        email: str
    ) -> Dict:
        """
        회사 ID와 이메일로 사용자 정보 조회
        HRIS가 자동으로 회사 소속 여부를 검증
        
        Returns:
            {
                "exists": True,
                "email": "user@company.com",
                "name": "홍길동",
                "position": "부사장",
                "department": "ESG팀",
                "employee_id": "EMP001",
                "company_id": "company_123"
            }
        """
        # HRIS API 호출
        response = await self.api_client.get(
            f"/api/companies/{company_id}/users",
            params={"email": email}
        )
        
        if response.get("exists"):
            return response
        else:
            raise UserNotFoundInCompanyError(
                f"User {email} not found in company {company_id}"
            )

class SignupService:
    """회원가입 서비스"""
    
    async def signup(
        self, 
        email: str, 
        password: str, 
        company_id: str
    ) -> Dict:
        """
        회원가입 프로세스
        
        Args:
            email: 사용자 이메일
            password: 비밀번호
            company_id: 회사 ID (DART에서 가져온 정보)
        """
        # 1. 이메일 인증 확인
        if not await self._verify_email(email):
            raise EmailNotVerifiedError()
        
        # 2. 회사에 최초 관리자가 있는지 확인
        first_admin = await self._get_first_admin(company_id)
        if not first_admin:
            raise NoAdminError("회사에 관리자가 없습니다. 먼저 회사 등록을 완료해주세요.")
        
        # 3. HRIS에서 사용자 정보 조회
        # HRIS가 자동으로 회사 소속 여부 검증
        try:
            user_info = await self.hris_client.get_user_by_company_and_email(
                company_id=company_id,
                email=email
            )
        except UserNotFoundInCompanyError:
            # HRIS에 해당 회사에 사용자가 없음
            # 최초 관리자 승인 필요
            user = await self._create_user(
                email=email,
                password=password,
                company_id=company_id,
                role="viewer",
                requires_approval=True
            )
            
            # 최초 관리자에게 승인 요청 알림
            await self._notify_admin_for_approval(
                admin_id=first_admin["id"],
                user_id=user["id"],
                user_email=email
            )
            
            return {
                "user_id": user["id"],
                "role": "viewer",
                "requires_approval": True,
                "message": "HRIS에 등록되지 않은 사용자입니다. 최초 관리자 승인이 필요합니다."
            }
        
        # 4. 역할 자동 할당
        role = self._auto_assign_role(
            position=user_info["position"],
            department=user_info["department"]
        )
        
        # 5. 사용자 계정 생성
        user = await self._create_user(
            email=email,
            password=password,
            company_id=company_id,
            role=role,
            department=user_info["department"],
            position=user_info["position"],
            employee_id=user_info["employee_id"]
        )
        
        return {
            "user_id": user["id"],
            "role": role,
            "requires_approval": role in ["dept_user", "viewer"]
        }
    
    def _auto_assign_role(
        self, 
        position: str, 
        department: str
    ) -> str:
        """
        HRIS 정보 기반 역할 자동 할당
        사용자 선택 불가, 시스템이 자동으로 할당
        """
        # 역할 1: 최종 승인권자
        if position in ["대표이사", "사장", "CEO", "CEO", "대표"]:
            return "final_approver"
        
        # 역할 2: ESG팀
        if department in ["ESG팀", "ESG", "지속가능경영팀"]:
            return "esg_team"
        
        # 역할 3: 현업팀
        if department in ["환경안전팀", "인사팀", "재무팀", "경영지원팀"]:
            return "dept_user"
        
        # 역할 4: 일반 사용자 (기본값)
        return "viewer"
```

**보안 특징:**
- ✅ **회사 등록과 사용자 등록 분리**: 회사 등록은 HRIS 불필요
- ✅ **최초 관리자 생성**: 대표이사 이메일 초대 링크 방식 (HRIS 불필요)
- ✅ **순환 문제 해결**: HRIS 조회 실패 시에도 최초 관리자는 생성 가능
- ✅ 사용자가 역할을 직접 선택할 수 없음 (보안 강화)
- ✅ HRIS 기반 회사 소속 여부 자동 검증 (일반 사용자, 도메인 검증 불필요)
- ✅ 역할 할당 근거 표시 (직급/부서 정보)
- ✅ HRIS 조회 실패 시 최초 관리자 승인 필요

### 10.2 4단계 역할 구조

#### 10.2.1 역할 1: 최종 승인권자 (CEO, 대표이사, 사장)

**주요 권한:**
- 전체 ESG 데이터 조회 및 수정
- 사용자 관리 (사용자 초대, 권한 변경, 승인)
- 데이터 소스 관리 (API 연동 설정)
- 최종 승인 및 보고서 제출

**Workflow 역할:**
- ESG팀이 제출한 최종 데이터 검토
- IFRS S1·S2 기준 준수 확인
- 최종 승인 및 보고서 생성 승인

**기술 구현:**
```python
class FinalApprover(BaseModel):
    """최종 승인권자"""
    user_id: str
    company_id: str
    role: str = "final_approver"
    
    def approve_final_report(self, report_id: str) -> bool:
        """최종 보고서 승인"""
        # IFRS 기준 준수 확인
        # 최종 승인 처리
        # 보고서 생성 트리거
        pass
```

#### 10.2.2 역할 2: ESG팀 (ESG 담당자, ESG 협업팀)

**주요 권한:**
- 전체 ESG 데이터 조회 및 수정
- 현업팀 데이터 검토 및 승인
- 데이터 소스 설정 가능
- 보고서 생성 및 검토

**Workflow 역할:**
- 현업팀이 제출한 데이터 검토
- 데이터 완성도 및 정확성 확인
- 이상치 확인 및 수정 요청
- 최종 승인권자에게 승인 요청

**기술 구현:**
```python
class ESGTeam(BaseModel):
    """ESG팀"""
    user_id: str
    company_id: str
    role: str = "esg_team"
    
    def review_dept_data(self, dept_data: Dict) -> ReviewResult:
        """현업팀 데이터 검토"""
        # 데이터 검증
        # 이상치 확인
        # 승인 또는 반려 결정
        pass
```

#### 10.2.3 역할 3: 현업팀 (부서 담당자)

**주요 권한:**
- 담당 섹션만 입력/수정 가능
  - 환경안전팀 → 환경 데이터 섹션
  - 인사팀 → 사회 데이터 섹션
  - 재무팀 → 지배구조 데이터 섹션
  - 경영지원팀 → 기업 기본정보 섹션
- ESG팀에 검토 요청
- 템플릿 및 파일 업로드

**Workflow 역할:**
- 부서별 ESG 데이터 입력
- 데이터 검증 및 완성도 확인
- ESG팀에 검토 요청

**기술 구현:**
```python
class DeptUser(BaseModel):
    """현업팀 (부서 담당자)"""
    user_id: str
    company_id: str
    role: str = "dept_user"
    department: str  # "environment", "hr", "finance", "management"
    
    def input_dept_data(self, section: str, data: Dict) -> bool:
        """담당 섹션 데이터 입력"""
        # 권한 확인 (담당 섹션만)
        # 데이터 입력
        # 검토 요청
        pass
```

#### 10.2.4 역할 4: 일반 사용자

**주요 권한:**
- 모든 섹션 조회만 가능
- 수정 불가

**Workflow 역할:**
- 정보 확인만

**기술 구현:**
```python
class Viewer(BaseModel):
    """일반 사용자"""
    user_id: str
    company_id: str
    role: str = "viewer"
    
    def view_data(self, section: str) -> Dict:
        """데이터 조회 (읽기 전용)"""
        # 조회 권한 확인
        # 데이터 반환
        pass
```

### 10.3 승인 Workflow 프로세스

```
┌─────────────────────────────────────────┐
│ Step 1: 현업팀 (역할 3) - 데이터 입력   │
├─────────────────────────────────────────┤
│ • 환경안전팀 → 환경 데이터 입력         │
│ • 인사팀 → 사회 데이터 입력             │
│ • 재무팀 → 지배구조 데이터 입력         │
│ • 경영지원팀 → 기업 기본정보 입력       │
│                                         │
│ 입력 완료 후 "ESG팀에 검토 요청" 클릭    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Step 2: ESG팀 (역할 2) - 데이터 검토    │
├─────────────────────────────────────────┤
│ • 현업팀이 제출한 데이터 검토           │
│ • 데이터 완성도 및 정확성 확인          │
│ • 이상치 확인 및 수정 요청              │
│ • 필요시 데이터 직접 수정               │
│                                         │
│ ┌─────────────┬─────────────┐           │
│ │ 승인        │ 반려        │           │
│ └─────────────┴─────────────┘           │
│                                         │
│ 승인 완료 후 "최종 승인 요청" 클릭       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Step 3: 최종 승인권자 (역할 1) - 최종 승인│
├─────────────────────────────────────────┤
│ • 전체 ESG 데이터 최종 검토             │
│ • IFRS S1·S2 기준 준수 확인             │
│ • 경영진 관점에서 데이터 검토           │
│                                         │
│ ┌─────────────┬─────────────┐           │
│ │ 최종 승인   │ 반려        │           │
│ └─────────────┴─────────────┘           │
│                                         │
│ 최종 승인 완료 후 "보고서 생성" 가능     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Step 4: AI 기반 보고서 자동 생성        │
├─────────────────────────────────────────┤
│ • IFRS S1·S2 기준 보고서 자동 생성      │
│ • PDF/Word 다운로드                     │
│ • 보고서 공유 및 제출                   │
└─────────────────────────────────────────┘
```

### 10.4 데이터베이스 스키마

```python
class User(BaseModel):
    """사용자 정보"""
    id: str
    email: str
    company_id: str
    
    # 4단계 역할 구조
    role: str  # "final_approver", "esg_team", "dept_user", "viewer"
    
    # 현업팀인 경우 부서 정보
    department: Optional[str]  # "environment", "hr", "finance", "management"
    
    # 승인 상태
    is_approved: bool
    approved_by: Optional[str]

class WorkflowApproval(BaseModel):
    """승인 워크플로우"""
    id: str
    report_id: str
    from_user_id: str  # 제출 사용자
    to_user_id: Optional[str]  # 승인 사용자
    status: str  # "pending", "approved", "rejected"
    role_level: int  # 1: 최종 승인권자, 2: ESG팀, 3: 현업팀
    submitted_at: datetime
    approved_at: Optional[datetime]
    feedback: Optional[str]  # 반려 시 피드백
```

### 10.5 구현 우선순위

**Phase 1 (MVP - 즉시 구현)**:
- 4단계 역할 구조 데이터베이스 모델
- 기본 권한 체크 로직
- 역할별 UI 차별화

**Phase 2 (단기 - 3개월)**:
- 승인 워크플로우 자동화
- 실시간 상태 추적
- 알림 시스템

**Phase 3 (중기 - 6개월)**:
- 경영진 대시보드 (최종 승인권자)
- ESG팀 통합 관리 대시보드
- 부서별 데이터 입력 가이드

# Aggregation Node 관련성 기반 검색 구현 완료

**작성일**: 2026-04-05  
**버전**: 1.0  
**상태**: ✅ 구현 완료

---

## 구현 개요

DP(Data Point)와 의미적으로 관련된 aggregation 데이터만 가져오도록 검색 로직을 고도화했습니다.

### 핵심 개선

| 항목 | 기존 | 개선 후 |
|------|------|---------|
| **검색 기준** | category 문자열/임베딩 | DP 메타데이터 + SR 컨텍스트 복합 임베딩 |
| **소스 유형 결정** | 항상 둘 다 조회 | 전년도 SR 본문 패턴 분석으로 결정 |
| **폴백 전략** | category 무시하고 전체 조회 | 관련 없으면 빈 결과 반환 |
| **관련성 필터** | 없음 | 유사도 임계값 (0.5) 적용 |

---

## 구현된 파일

### 1. Pattern Detector (패턴 감지기)

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/aggregation_node/pattern_detector.py`

**기능**:
- SR 본문에서 뉴스/기사 인용 패턴 감지
- SR 본문에서 계열사/사업장 언급 패턴 감지
- 패턴 기반 데이터 소스 유형 결정

**주요 함수**:
```python
def detect_data_source_patterns(body_text: str) -> Dict[str, Any]
def determine_source_type(patterns: Dict[str, Any]) -> str
```

**패턴 규칙**:
- **뉴스 패턴**: 인증 획득, 수상 내역, 언론 보도, 외부 평가 등
- **계열사 패턴**: 데이터센터, 사업장, kWh, tCO2eq, 발전량 등

### 2. SR Body Context Query (SR 본문 컨텍스트 조회)

**파일**: `backend/domain/shared/tool/ifrs_agent/database/sr_body_context_query.py`

**기능**:
- toc_path + subtitle 기준 SR 본문 조회
- 정확 매칭 → 부분 매칭 → 첫 번째 요소 매칭 폴백

**주요 함수**:
```python
async def query_sr_body_by_context(
    company_id: str,
    year: int,
    toc_path: List[str],
    subtitle: Optional[str] = None
) -> Optional[Dict[str, Any]]

async def query_sr_body_by_page(
    company_id: str,
    year: int,
    page_number: int
) -> Optional[Dict[str, Any]]
```

### 3. Relevance Analyzer (관련성 분석기)

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/aggregation_node/relevance_analyzer.py`

**기능**:
- 전년도 SR 본문 분석 및 소스 유형 결정
- DP 메타데이터 + SR 컨텍스트 복합 임베딩 생성

**주요 함수**:
```python
async def analyze_prior_year_body(
    company_id: str,
    dp_id: Optional[str],
    year: int,
    toc_path: List[str],
    subtitle: Optional[str] = None
) -> Dict[str, Any]

async def build_relevance_query_embedding(
    dp_metadata: Dict[str, Any],
    sr_context: Dict[str, Any]
) -> List[float]

def build_relevance_query_text(
    dp_metadata: Dict[str, Any],
    sr_context: Dict[str, Any]
) -> str
```

### 4. Aggregation Relevance Query (관련성 기반 쿼리)

**파일**: `backend/domain/shared/tool/ifrs_agent/database/aggregation_relevance.py`

**기능**:
- 관련성 임베딩 기반 subsidiary 데이터 검색
- 관련성 임베딩 기반 external 데이터 검색
- 유사도 임계값 필터링

**주요 함수**:
```python
async def query_subsidiary_data_relevant(
    params: Dict[str, Any]
) -> List[Dict[str, Any]]

async def query_external_data_relevant(
    params: Dict[str, Any]
) -> List[Dict[str, Any]]
```

**SQL 쿼리 예시**:
```sql
-- subsidiary 검색
SELECT *
FROM subsidiary_data_contributions
WHERE company_id = $1
  AND report_year = $2
  AND description_embedding IS NOT NULL
  AND (description_embedding <-> $3::vector) < $4
ORDER BY similarity
LIMIT $5

-- external 검색
SELECT *
FROM external_company_data
WHERE anchor_company_id = $1
  AND report_year = $2
  AND source_type IN ('press', 'news')
  AND (
      (category_embedding IS NOT NULL AND (category_embedding <-> $3::vector) < $4)
      OR
      (body_embedding IS NOT NULL AND (body_embedding <-> $3::vector) < $4)
  )
ORDER BY similarity
LIMIT $5
```

### 5. Agent 수정

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/aggregation_node/agent.py`

**변경 사항**:
- `collect()` 메서드에 관련성 기반 검색 로직 추가
- `_collect_relevant()` 신규 메서드 추가
- `_collect_year_relevant()` 신규 메서드 추가
- 환경 변수 `USE_RELEVANCE_AGG`로 on/off 제어

**새 payload 구조**:
```python
{
    "company_id": str,
    "category": str,  # 레거시 호환용
    "dp_id": str,
    "years": [2024, 2023],
    # 신규 필드
    "dp_metadata": {
        "unified_column_id": str,
        "column_name_ko": str,
        "column_description": str,
        "column_topic": str,
        "column_subtopic": str
    },
    "sr_context": {
        "toc_path": List[str],
        "subtitle": str
    }
}
```

### 6. Bootstrap 수정

**파일**: `backend/domain/v1/ifrs_agent/hub/bootstrap.py`

**추가된 툴**:
- `query_sr_body_by_context`
- `query_sr_body_by_page`
- `query_subsidiary_data_relevant`
- `query_external_data_relevant`

### 7. Orchestrator 수정

**파일**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`

**변경 사항**:
- `_parallel_collect()`에서 `dp_metadata`, `sr_context` 전달
- user_input에서 메타데이터 추출하여 aggregation_node에 전달

### 8. 테스트

**파일**: `backend/domain/v1/ifrs_agent/tests/test_aggregation_relevance.py`

**테스트 케이스**:
- 뉴스 패턴 감지
- 계열사 패턴 감지
- 패턴 없음 감지
- 소스 유형 결정 (external_only, subsidiary_only, both, skip)
- 관련성 쿼리 텍스트 생성
- 전체 파이프라인 통합 테스트 (DB 연결 필요)

---

## 실행 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Aggregation Relevance Pipeline                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [1] 전년도 SR 본문 분석                                             │
│      ↓                                                              │
│      • query_sr_body_by_context() 호출                              │
│      • detect_data_source_patterns() 패턴 분석                      │
│      • determine_source_type() 소스 유형 결정                       │
│                                                                     │
│  [2] skip이면 빈 결과 반환                                           │
│      ↓                                                              │
│      • {"2024": {"subsidiary_data": [], "external_company_data": []}}│
│                                                                     │
│  [3] 관련성 임베딩 생성                                              │
│      ↓                                                              │
│      • build_relevance_query_embedding()                            │
│      • DP 메타데이터 + SR 컨텍스트 결합                              │
│      • embed_text() 호출 → 1024차원 벡터                            │
│                                                                     │
│  [4] 소스 유형에 따라 조회                                           │
│      ↓                                                              │
│      • external_only → query_external_data_relevant()               │
│      • subsidiary_only → query_subsidiary_data_relevant()           │
│      • both → 둘 다 병렬 조회                                        │
│                                                                     │
│  [5] 유사도 임계값 필터 (0.5)                                        │
│      ↓                                                              │
│      • 유사도 < 0.5인 결과만 반환                                    │
│      • 최종 결과 포맷팅                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 사용 예시

### 시나리오 A: 기후 인센티브 DP (뉴스 기반)

**입력**:
```python
{
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
    "years": [2024, 2023],
    "dp_metadata": {
        "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
        "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이...",
        "column_topic": "거버넌스",
        "column_subtopic": "GOV-3"
    },
    "sr_context": {
        "toc_path": ["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"],
        "subtitle": "기후 관련 인센티브"
    }
}
```

**처리**:
1. 전년도 SR 본문: "...보건복지부 건강친화기업 인증을 획득...관련 성과를 부서장 평가에도 반영..."
2. 패턴 감지: `has_news_citation=True`, `has_subsidiary_mention=False`
3. 소스 유형: `external_only`

**결과**:
```python
{
    "2024": {
        "subsidiary_data": [],  # 조회 안 함
        "external_company_data": [
            {
                "title": "삼성SDS, 보건복지부 건강친화기업 인증 획득",
                "body_text": "...부서장 평가에 건강관리 성과 반영...",
                "similarity": 0.32
            }
        ]
    }
}
```

### 시나리오 B: 재생에너지 DP (계열사 기반)

**입력**:
```python
{
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "dp_id": "UCM_ESRSE1_E1_6__IFRS2_29_a",
    "years": [2024, 2023],
    "dp_metadata": {
        "column_name_ko": "재생에너지 사용량",
        "column_description": "재생에너지 전력 사용량 및 비율...",
        "column_topic": "환경",
        "column_subtopic": "E1-6"
    },
    "sr_context": {
        "toc_path": ["ESG PERFORMANCE", "ENVIRONMENTAL", "재생에너지"],
        "subtitle": "태양광 발전"
    }
}
```

**처리**:
1. 전년도 SR 본문: "...동탄 데이터센터는 준공 시 건물 옥상에 352kW 태양광 발전설비를 구축..."
2. 패턴 감지: `has_news_citation=False`, `has_subsidiary_mention=True`
3. 소스 유형: `subsidiary_only`

**결과**:
```python
{
    "2024": {
        "subsidiary_data": [
            {
                "subsidiary_name": "동탄 데이터센터",
                "facility_name": "태양광 발전설비",
                "description": "2024년 태양광 발전량 172,497kWh 달성...",
                "quantitative_data": {"태양광_발전량_kWh": 172497},
                "similarity": 0.28
            }
        ],
        "external_company_data": []  # 조회 안 함
    }
}
```

---

## 설정 및 제어

### 환경 변수

```bash
# 관련성 기반 검색 활성화 (기본값: true)
USE_RELEVANCE_AGG=true

# 비활성화 시 레거시 방식 사용
USE_RELEVANCE_AGG=false
```

### 임계값 설정

```python
# aggregation_relevance.py
DEFAULT_SIMILARITY_THRESHOLD = 0.5  # 0~1, 낮을수록 엄격

# pattern_detector.py
MIN_CONFIDENCE = 0.3  # 최소 패턴 감지 신뢰도
```

---

## 레거시 호환성

### 기존 API 유지

- `category` 파라미터 계속 지원
- `dp_metadata`, `sr_context` 없으면 기존 로직 사용
- 환경 변수로 on/off 제어 가능

### 롤백 방법

```bash
# 환경 변수 설정
export USE_RELEVANCE_AGG=false

# 또는 .env 파일
USE_RELEVANCE_AGG=false
```

---

## 테스트 실행

### 단위 테스트

```bash
# 패턴 감지 테스트
pytest backend/domain/v1/ifrs_agent/tests/test_aggregation_relevance.py::TestPatternDetector -v

# 관련성 분석 테스트
pytest backend/domain/v1/ifrs_agent/tests/test_aggregation_relevance.py::TestRelevanceAnalyzer -v
```

### 통합 테스트 (DB 연결 필요)

```bash
# 전체 파이프라인 테스트
pytest backend/domain/v1/ifrs_agent/tests/test_aggregation_relevance.py::TestIntegration -v
```

---

## 다음 단계

1. **시드 데이터 적재**:
   - `subsidiary_data_contributions` 테이블에 `description_embedding` 생성
   - `external_company_data` 테이블에 `category_embedding`, `body_embedding` 생성

2. **Orchestrator 확장**:
   - `c_rag`, `dp_rag` 결과에서 `toc_path`, `subtitle` 추출
   - `dp_metadata` 자동 생성 로직 추가

3. **성능 최적화**:
   - 임베딩 캐싱
   - 벡터 인덱스 튜닝 (HNSW 파라미터)

4. **모니터링**:
   - 관련성 검색 히트율 추적
   - 유사도 분포 분석
   - 패턴 감지 정확도 측정

---

## 요약

| 항목 | 상태 |
|------|------|
| **Pattern Detector** | ✅ 구현 완료 |
| **SR Body Context Query** | ✅ 구현 완료 |
| **Relevance Analyzer** | ✅ 구현 완료 |
| **Aggregation Relevance Query** | ✅ 구현 완료 |
| **Agent 수정** | ✅ 구현 완료 |
| **Bootstrap 수정** | ✅ 구현 완료 |
| **Orchestrator 수정** | ✅ 구현 완료 |
| **테스트 작성** | ✅ 구현 완료 |
| **문서화** | ✅ 완료 |

---

## 참고 문서

- [AGGREGATION_RELEVANCE_DESIGN.md](./AGGREGATION_RELEVANCE_DESIGN.md) - 상세 설계 문서
- [AGGREGATION_NODE_IMPLEMENTATION.md](./AGGREGATION_NODE_IMPLEMENTATION.md) - 기존 구현 문서

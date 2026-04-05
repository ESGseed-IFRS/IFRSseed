# Aggregation Node 관련성 기반 검색 설계

**작성일**: 2026-04-05  
**버전**: 1.0  
**목적**: DP(Data Point)에 적합한 aggregation 데이터만 가져오도록 검색 로직 고도화

---

## 1. 문제 정의

### 1.1 현재 상황

현재 `aggregation_node`는 다음과 같은 단순 폴백 전략을 사용합니다:

```
1단계: category 정확 매칭
2단계: category 벡터 유사도 검색
3단계: 폴백 (company_id + year만으로 조회)
```

**문제점**:
- `UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i` (기후 고려 인센티브 반영 여부) 같은 DP에 대해
- "협력회사 ESG 관리" 카테고리의 데이터가 반환됨 → **DP와 무관한 데이터**
- 폴백 단계에서 category 필터 없이 조회하여 발생

### 1.2 목표

**DP와 의미적으로 관련된 데이터만** 가져오도록:
1. 전년도 SR 본문 분석으로 데이터 소스 유형 판단
2. DP 메타데이터 + SR 본문 컨텍스트 기반 임베딩 매칭
3. 관련 없는 데이터는 반환하지 않음 (빈 결과 허용)

---

## 2. 제안 로직

### 2.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Aggregation Relevance Pipeline                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [1] 전년도 SR 본문 분석 (Prior Year Body Analysis)                  │
│      ↓                                                              │
│      • 해당 DP의 전년도 SR 본문 조회 (toc_path, subtitle 기준)        │
│      • 본문 내 패턴 분석:                                            │
│        - 기사/뉴스 인용 패턴 → external_company_data 우선            │
│        - 계열사/사업장 언급 패턴 → subsidiary_data 우선               │
│        - 둘 다 없음 → aggregation 스킵                               │
│                                                                     │
│  [2] 데이터 소스 결정 (Source Type Decision)                         │
│      ↓                                                              │
│      • external_only: 기사 데이터만 조회                             │
│      • subsidiary_only: 계열사 데이터만 조회                         │
│      • both: 둘 다 조회                                              │
│      • skip: aggregation 데이터 없음 (빈 결과 반환)                  │
│                                                                     │
│  [3] 관련성 기반 검색 (Relevance-Based Query)                        │
│      ↓                                                              │
│      • DP 메타데이터 (description, topic, subtopic) 임베딩           │
│      • SR 본문 컨텍스트 (toc_path, subtitle) 임베딩                  │
│      • 복합 임베딩으로 유사도 검색                                    │
│                                                                     │
│  [4] 관련성 임계값 필터 (Relevance Threshold)                        │
│      ↓                                                              │
│      • 유사도 < 0.7 → 결과에서 제외                                  │
│      • 최종 결과 반환                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 단계별 상세

#### 단계 1: 전년도 SR 본문 분석

**목적**: 해당 DP가 과거에 어떤 유형의 데이터를 참조했는지 판단

**입력**:
- `company_id`: 회사 UUID
- `dp_id`: UCM ID 또는 원본 DP ID
- `year`: 현재 보고 연도 (예: 2024)
- `toc_path`: 현재 요청의 목차 경로 (예: `["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"]`)
- `subtitle`: 현재 요청의 부제목 (예: "기후 관련 인센티브")

**로직**:
```python
async def analyze_prior_year_body(
    company_id: str,
    dp_id: str,
    year: int,
    toc_path: List[str],
    subtitle: str
) -> Dict[str, Any]:
    """
    전년도 SR 본문을 분석하여 데이터 소스 유형 판단.
    
    Returns:
        {
            "source_type": "external_only" | "subsidiary_only" | "both" | "skip",
            "prior_body_text": str,  # 분석에 사용된 본문
            "detected_patterns": {
                "has_news_citation": bool,
                "has_subsidiary_mention": bool,
                "confidence": float
            }
        }
    """
    prior_year = year - 1
    
    # 1. 전년도 SR 본문 조회 (toc_path + subtitle 기준)
    prior_body = await query_sr_body_by_context(
        company_id=company_id,
        year=prior_year,
        toc_path=toc_path,
        subtitle=subtitle
    )
    
    if not prior_body:
        return {"source_type": "skip", "prior_body_text": None, "detected_patterns": {}}
    
    # 2. 패턴 분석
    patterns = detect_data_source_patterns(prior_body["content_text"])
    
    # 3. 소스 유형 결정
    if patterns["has_news_citation"] and patterns["has_subsidiary_mention"]:
        source_type = "both"
    elif patterns["has_news_citation"]:
        source_type = "external_only"
    elif patterns["has_subsidiary_mention"]:
        source_type = "subsidiary_only"
    else:
        source_type = "skip"
    
    return {
        "source_type": source_type,
        "prior_body_text": prior_body["content_text"],
        "detected_patterns": patterns
    }
```

**패턴 감지 규칙**:

```python
def detect_data_source_patterns(body_text: str) -> Dict[str, Any]:
    """
    본문에서 데이터 소스 유형 패턴 감지.
    """
    # 기사/뉴스 인용 패턴
    news_patterns = [
        r"언론\s*보도",
        r"기사\s*내용",
        r"뉴스\s*기사",
        r"보도\s*자료",
        r"미디어\s*커버리지",
        r"외부\s*평가",
        r"제3자\s*검증",
        r"인증\s*획득",
        r"수상\s*내역",
        r"외부\s*기관",
    ]
    
    # 계열사/사업장 언급 패턴
    subsidiary_patterns = [
        r"데이터센터",
        r"사업장",
        r"캠퍼스",
        r"공장",
        r"물류센터",
        r"연구소",
        r"지사",
        r"법인",
        r"자회사",
        r"계열사",
        r"그룹사",
        r"kWh",  # 에너지 수치
        r"tCO2eq",  # 탄소 수치
        r"MW",  # 전력 용량
        r"발전량",
        r"절감량",
        r"증설",
        r"준공",
    ]
    
    has_news = any(re.search(p, body_text, re.IGNORECASE) for p in news_patterns)
    has_subsidiary = any(re.search(p, body_text, re.IGNORECASE) for p in subsidiary_patterns)
    
    # 신뢰도 계산 (매칭된 패턴 수 기반)
    news_count = sum(1 for p in news_patterns if re.search(p, body_text, re.IGNORECASE))
    sub_count = sum(1 for p in subsidiary_patterns if re.search(p, body_text, re.IGNORECASE))
    confidence = min(1.0, (news_count + sub_count) / 5)
    
    return {
        "has_news_citation": has_news,
        "has_subsidiary_mention": has_subsidiary,
        "news_pattern_count": news_count,
        "subsidiary_pattern_count": sub_count,
        "confidence": confidence
    }
```

#### 단계 2: 관련성 기반 검색 쿼리 생성

**목적**: DP 메타데이터 + SR 컨텍스트를 결합한 검색 쿼리 생성

**복합 임베딩 생성**:
```python
async def build_relevance_query_embedding(
    dp_metadata: Dict[str, Any],
    sr_context: Dict[str, Any]
) -> List[float]:
    """
    DP 메타데이터와 SR 컨텍스트를 결합한 검색용 임베딩 생성.
    
    Args:
        dp_metadata: {
            "unified_column_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
            "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
            "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이...",
            "column_topic": "거버넌스",
            "column_subtopic": "GOV-3"
        }
        sr_context: {
            "toc_path": ["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"],
            "subtitle": "기후 관련 인센티브"
        }
    
    Returns:
        1024차원 임베딩 벡터
    """
    # 검색 쿼리 텍스트 구성
    query_parts = []
    
    # DP 메타데이터
    if dp_metadata.get("column_name_ko"):
        query_parts.append(dp_metadata["column_name_ko"])
    if dp_metadata.get("column_description"):
        # 설명에서 핵심 키워드 추출 (처음 200자)
        desc = dp_metadata["column_description"][:200]
        query_parts.append(desc)
    if dp_metadata.get("column_topic"):
        query_parts.append(dp_metadata["column_topic"])
    if dp_metadata.get("column_subtopic"):
        query_parts.append(dp_metadata["column_subtopic"])
    
    # SR 컨텍스트
    if sr_context.get("toc_path"):
        toc_str = " > ".join(sr_context["toc_path"])
        query_parts.append(toc_str)
    if sr_context.get("subtitle"):
        query_parts.append(sr_context["subtitle"])
    
    # 결합
    query_text = " | ".join(query_parts)
    
    # 임베딩 생성
    embedding = await embed_text({"text": query_text})
    return embedding
```

#### 단계 3: 관련성 필터링 쿼리

**subsidiary_data_contributions 쿼리**:
```sql
-- 관련성 기반 subsidiary 데이터 검색
SELECT 
    subsidiary_name,
    facility_name,
    description,
    quantitative_data,
    category,
    report_year,
    related_dp_ids,
    data_source,
    (description_embedding <-> $3::vector) as similarity
FROM subsidiary_data_contributions
WHERE company_id = $1::uuid
  AND report_year = $2
  AND description_embedding IS NOT NULL
  AND (description_embedding <-> $3::vector) < 0.5  -- 유사도 임계값
ORDER BY similarity
LIMIT $4
```

**external_company_data 쿼리**:
```sql
-- 관련성 기반 external 데이터 검색
-- title 임베딩과 body 임베딩 모두 고려
SELECT 
    title,
    body_text,
    source_url,
    source_type,
    fetched_at,
    report_year,
    related_dp_ids,
    LEAST(
        COALESCE((category_embedding <-> $3::vector), 1.0),
        COALESCE((body_embedding <-> $3::vector), 1.0)
    ) as similarity
FROM external_company_data
WHERE anchor_company_id = $1::uuid
  AND report_year = $2
  AND source_type IN ('press', 'news')
  AND (
      (category_embedding IS NOT NULL AND (category_embedding <-> $3::vector) < 0.5)
      OR
      (body_embedding IS NOT NULL AND (body_embedding <-> $3::vector) < 0.5)
  )
ORDER BY similarity
LIMIT $4
```

---

## 3. 데이터베이스 스키마

### 3.1 현재 스키마 (변경 없음)

**subsidiary_data_contributions**:
| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | UUID | PK |
| `company_id` | UUID | FK → companies |
| `subsidiary_name` | VARCHAR(200) | 계열사/자회사명 |
| `facility_name` | VARCHAR(200) | 사업장/시설명 |
| `report_year` | INTEGER | 보고 연도 |
| `category` | TEXT | 카테고리 (정확 매칭용) |
| `category_embedding` | vector(1024) | 카테고리 임베딩 |
| `description` | TEXT | 상세 설명 |
| `description_embedding` | vector(1024) | **설명 임베딩 (관련성 검색 핵심)** |
| `related_dp_ids` | TEXT[] | 관련 DP ID 배열 |
| `quantitative_data` | JSONB | 정량 데이터 |
| `data_source` | VARCHAR(100) | 데이터 출처 |

**external_company_data**:
| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | UUID | PK |
| `anchor_company_id` | UUID | FK → companies |
| `title` | TEXT | 기사 제목 |
| `body_text` | TEXT | 기사 본문 |
| `category` | TEXT | 카테고리 |
| `category_embedding` | vector(1024) | **카테고리 임베딩 (제목 기반)** |
| `body_embedding` | vector(1024) | **본문 임베딩** |
| `report_year` | INTEGER | 보고 연도 |
| `related_dp_ids` | TEXT[] | 관련 DP ID 배열 |
| `source_type` | VARCHAR(50) | 'press' / 'news' |
| `source_url` | TEXT | 원본 URL |
| `fetched_at` | TIMESTAMPTZ | 수집 시점 |

### 3.2 인덱스 활용

```sql
-- 기존 인덱스 (이미 생성됨)
CREATE INDEX idx_subsidiary_description_embedding
ON subsidiary_data_contributions
USING hnsw (description_embedding vector_cosine_ops)
WHERE description_embedding IS NOT NULL;

CREATE INDEX idx_ext_company_category_embedding
ON external_company_data
USING hnsw (category_embedding vector_cosine_ops)
WHERE category_embedding IS NOT NULL;

-- 추가 권장 인덱스 (body_embedding용)
CREATE INDEX idx_ext_company_body_embedding
ON external_company_data
USING hnsw (body_embedding vector_cosine_ops)
WHERE body_embedding IS NOT NULL;
```

---

## 4. UCM ↔ DP 매핑

### 4.1 UCM 구조

```python
# unified_column_mappings 테이블
{
    "unified_column_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
    "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
    "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이 반영되는지와 방법을 공개합니다...",
    "column_category": "E",  # E/S/G
    "column_topic": "거버넌스",
    "column_subtopic": "GOV-3",
    "mapped_dp_ids": ["ESRSE1-GOV-3-13", "IFRS2-29-g-i"],  # 원본 DP ID 배열
    "unified_embedding": [...]  # 1024차원
}
```

### 4.2 매핑 전략

1. **UCM ID 입력 시**:
   - `unified_column_mappings` 테이블에서 메타데이터 조회
   - `mapped_dp_ids`로 원본 DP ID 확보
   - `unified_embedding` 또는 `column_description` 기반 검색

2. **원본 DP ID 입력 시**:
   - `datapoints` 테이블에서 직접 조회
   - 또는 `related_dp_ids` 배열 매칭

3. **관련성 검색 시**:
   - UCM의 `column_topic` + `column_subtopic` → 카테고리 매칭
   - UCM의 `column_description` → 의미적 유사도 검색

---

## 5. 구현 계획

### 5.1 파일 구조

```
backend/domain/shared/tool/ifrs_agent/database/
├── aggregation_query.py          # 기존 (수정)
├── aggregation_relevance.py      # 신규: 관련성 분석 로직
└── sr_body_context_query.py      # 신규: SR 본문 컨텍스트 조회

backend/domain/v1/ifrs_agent/spokes/agents/aggregation_node/
├── agent.py                      # 기존 (수정)
├── relevance_analyzer.py         # 신규: 관련성 분석기
└── pattern_detector.py           # 신규: 패턴 감지기
```

### 5.2 구현 순서

| 순서 | 작업 | 파일 | 설명 |
|------|------|------|------|
| 1 | SR 본문 컨텍스트 조회 | `sr_body_context_query.py` | toc_path, subtitle 기반 조회 |
| 2 | 패턴 감지기 | `pattern_detector.py` | 뉴스/계열사 패턴 분석 |
| 3 | 관련성 분석기 | `relevance_analyzer.py` | 전년도 분석 + 소스 유형 결정 |
| 4 | 관련성 기반 쿼리 | `aggregation_relevance.py` | 복합 임베딩 검색 |
| 5 | Agent 수정 | `agent.py` | 새 로직 통합 |
| 6 | 테스트 | `test_aggregation_relevance.py` | 관련성 검증 |

### 5.3 주요 함수 시그니처

```python
# sr_body_context_query.py
async def query_sr_body_by_context(
    company_id: str,
    year: int,
    toc_path: List[str],
    subtitle: str
) -> Optional[Dict[str, Any]]:
    """toc_path + subtitle 기준 SR 본문 조회"""

# pattern_detector.py
def detect_data_source_patterns(body_text: str) -> Dict[str, Any]:
    """본문에서 데이터 소스 유형 패턴 감지"""

# relevance_analyzer.py
async def analyze_prior_year_body(
    company_id: str,
    dp_id: str,
    year: int,
    toc_path: List[str],
    subtitle: str
) -> Dict[str, Any]:
    """전년도 SR 본문 분석하여 소스 유형 결정"""

async def build_relevance_query_embedding(
    dp_metadata: Dict[str, Any],
    sr_context: Dict[str, Any]
) -> List[float]:
    """DP + SR 컨텍스트 결합 임베딩 생성"""

# aggregation_relevance.py
async def query_subsidiary_data_relevant(
    params: Dict[str, Any],
    relevance_embedding: List[float],
    similarity_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """관련성 기반 subsidiary 데이터 검색"""

async def query_external_data_relevant(
    params: Dict[str, Any],
    relevance_embedding: List[float],
    similarity_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """관련성 기반 external 데이터 검색"""
```

---

## 6. Agent 수정 사항

### 6.1 `AggregationNodeAgent.collect()` 수정

```python
async def collect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    계열사·외부 기업 데이터 수집 (관련성 기반).
    
    Args:
        payload: {
            "company_id": str (UUID),
            "category": str,
            "dp_id": str (선택),
            "years": List[int] (기본 [2024, 2023]),
            # 신규 필드
            "dp_metadata": Dict (UCM 메타데이터),
            "sr_context": {
                "toc_path": List[str],
                "subtitle": str
            }
        }
    """
    company_id = payload.get("company_id")
    dp_id = payload.get("dp_id")
    years = payload.get("years", [2024, 2023])
    dp_metadata = payload.get("dp_metadata", {})
    sr_context = payload.get("sr_context", {})
    
    # 1. 전년도 SR 본문 분석
    prior_analysis = await analyze_prior_year_body(
        company_id=company_id,
        dp_id=dp_id,
        year=years[0],  # 현재 연도
        toc_path=sr_context.get("toc_path", []),
        subtitle=sr_context.get("subtitle", "")
    )
    
    source_type = prior_analysis.get("source_type", "skip")
    
    # 2. skip이면 빈 결과 반환
    if source_type == "skip":
        logger.info("aggregation_node: 관련 데이터 소스 없음, skip")
        return {str(y): {"subsidiary_data": [], "external_company_data": []} for y in years}
    
    # 3. 관련성 임베딩 생성
    relevance_embedding = await build_relevance_query_embedding(
        dp_metadata=dp_metadata,
        sr_context=sr_context
    )
    
    # 4. 소스 유형에 따라 조회
    result = {}
    for year in years:
        year_data = await self._collect_year_relevant(
            company_id=company_id,
            year=year,
            source_type=source_type,
            relevance_embedding=relevance_embedding
        )
        result[str(year)] = year_data
    
    return result
```

### 6.2 `_collect_year_relevant()` 신규 메서드

```python
async def _collect_year_relevant(
    self,
    company_id: str,
    year: int,
    source_type: str,
    relevance_embedding: List[float]
) -> Dict[str, Any]:
    """
    관련성 기반 연도별 데이터 수집.
    
    Args:
        source_type: "external_only" | "subsidiary_only" | "both"
    """
    subsidiary_data = []
    external_data = []
    
    if source_type in ("subsidiary_only", "both"):
        subsidiary_data = await self.infra.call_tool(
            "query_subsidiary_data_relevant",
            {
                "company_id": company_id,
                "year": year,
                "relevance_embedding": relevance_embedding,
                "similarity_threshold": 0.5,
                "limit": 5
            }
        )
    
    if source_type in ("external_only", "both"):
        external_data = await self.infra.call_tool(
            "query_external_data_relevant",
            {
                "company_id": company_id,
                "year": year,
                "relevance_embedding": relevance_embedding,
                "similarity_threshold": 0.5,
                "limit": 3
            }
        )
    
    return {
        "subsidiary_data": subsidiary_data if isinstance(subsidiary_data, list) else [],
        "external_company_data": external_data if isinstance(external_data, list) else []
    }
```

---

## 7. Orchestrator 수정 사항

### 7.1 `_parallel_collect()` 수정

```python
# aggregation_node 호출 시 dp_metadata, sr_context 전달
aggregation_payload = {
    "company_id": company_id,
    "years": years,
    # 신규 필드
    "dp_metadata": {
        "unified_column_id": user_input.get("dp_id"),
        "column_name_ko": fact_data.get("ucm", {}).get("column_name_ko"),
        "column_description": fact_data.get("ucm", {}).get("column_description"),
        "column_topic": fact_data.get("ucm", {}).get("column_topic"),
        "column_subtopic": fact_data.get("ucm", {}).get("column_subtopic"),
    },
    "sr_context": {
        "toc_path": ref_data.get("2024", {}).get("toc_path", []),
        "subtitle": ref_data.get("2024", {}).get("subtitle", "")
    }
}

if user_input.get("dp_id"):
    aggregation_payload["dp_id"] = user_input["dp_id"]

aggregation_task = self.infra.call_agent(
    "aggregation_node",
    "collect",
    self._agent_payload(aggregation_payload),
    timeout=heavy_timeout,
)
```

---

## 8. 예시 시나리오

### 8.1 시나리오 A: 기후 인센티브 DP (뉴스 기반)

**입력**:
```python
{
    "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
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

**전년도 SR 본문 분석**:
```
본문: "...보건복지부 건강친화기업 인증을 획득...관련 성과를 부서장 평가에도 반영..."
패턴 감지: has_news_citation=True (인증 획득), has_subsidiary_mention=False
→ source_type = "external_only"
```

**결과**:
```python
{
    "2024": {
        "subsidiary_data": [],  # 조회 안 함
        "external_company_data": [
            {
                "title": "삼성SDS, 보건복지부 건강친화기업 인증 획득",
                "body_text": "...부서장 평가에 건강관리 성과 반영...",
                "similarity": 0.32  # 임계값 0.5 이하
            }
        ]
    }
}
```

### 8.2 시나리오 B: 재생에너지 DP (계열사 기반)

**입력**:
```python
{
    "dp_id": "UCM_ESRSE1_E1_6__IFRS2_29_a",
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

**전년도 SR 본문 분석**:
```
본문: "...동탄 데이터센터는 준공 시 건물 옥상에 352kW 태양광 발전설비를 구축...
      2024년 7월 동탄 데이터센터 옥상 및 주차장에 태양광 발전설비 374kW를 추가 증설..."
패턴 감지: has_news_citation=False, has_subsidiary_mention=True (데이터센터, kW, 발전량)
→ source_type = "subsidiary_only"
```

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

### 8.3 시나리오 C: 관련 데이터 없음

**입력**:
```python
{
    "dp_id": "UCM_ESRSS1_S1_1__IFRS2_25_a",
    "dp_metadata": {
        "column_name_ko": "인적자본 정책",
        "column_description": "인적자본 관련 정책 및 활동...",
        "column_topic": "사회",
        "column_subtopic": "S1-1"
    },
    "sr_context": {
        "toc_path": ["ESG PERFORMANCE", "SOCIAL", "인적자본"],
        "subtitle": "인적자본 정책"
    }
}
```

**전년도 SR 본문 분석**:
```
본문: "...당사는 인적자본 관리를 위해 다양한 정책을 운영하고 있습니다..."
패턴 감지: has_news_citation=False, has_subsidiary_mention=False
→ source_type = "skip"
```

**결과**:
```python
{
    "2024": {
        "subsidiary_data": [],
        "external_company_data": []
    },
    "2023": {
        "subsidiary_data": [],
        "external_company_data": []
    }
}
```

---

## 9. 설정 값

### 9.1 임계값

| 항목 | 값 | 설명 |
|------|------|------|
| `SIMILARITY_THRESHOLD` | 0.5 | 벡터 유사도 임계값 (낮을수록 엄격) |
| `MIN_PATTERN_CONFIDENCE` | 0.3 | 최소 패턴 감지 신뢰도 |
| `SUBSIDIARY_LIMIT` | 5 | 계열사 데이터 최대 건수 |
| `EXTERNAL_LIMIT` | 3 | 외부 데이터 최대 건수 |

### 9.2 패턴 가중치

```python
# 뉴스 패턴 (우선순위 순)
NEWS_PATTERNS = {
    "인증 획득": 1.0,
    "수상 내역": 1.0,
    "언론 보도": 0.9,
    "외부 평가": 0.8,
    "제3자 검증": 0.8,
}

# 계열사 패턴 (우선순위 순)
SUBSIDIARY_PATTERNS = {
    "데이터센터": 1.0,
    "사업장": 0.9,
    "kWh": 0.9,
    "tCO2eq": 0.9,
    "발전량": 0.8,
    "절감량": 0.8,
}
```

---

## 10. 테스트 계획

### 10.1 단위 테스트

1. **패턴 감지 테스트**:
   - 뉴스 패턴만 있는 본문 → `external_only`
   - 계열사 패턴만 있는 본문 → `subsidiary_only`
   - 둘 다 있는 본문 → `both`
   - 둘 다 없는 본문 → `skip`

2. **임베딩 생성 테스트**:
   - DP 메타데이터만 → 유효한 임베딩
   - SR 컨텍스트만 → 유효한 임베딩
   - 둘 다 → 결합된 임베딩

3. **관련성 쿼리 테스트**:
   - 유사도 임계값 이하 → 결과 포함
   - 유사도 임계값 초과 → 결과 제외

### 10.2 통합 테스트

1. **시나리오 A**: 기후 인센티브 → 뉴스 데이터만
2. **시나리오 B**: 재생에너지 → 계열사 데이터만
3. **시나리오 C**: 인적자본 → 빈 결과

### 10.3 성능 테스트

- 전년도 SR 본문 조회 시간 < 500ms
- 관련성 임베딩 생성 시간 < 1s
- 전체 aggregation 시간 < 5s

---

## 11. 마이그레이션

### 11.1 기존 로직과의 호환성

- **기존 API 유지**: `category` 파라미터 계속 지원
- **점진적 전환**: `dp_metadata`, `sr_context` 없으면 기존 로직 사용
- **폴백**: 전년도 SR 본문 없으면 기존 폴백 로직

### 11.2 롤백 계획

```python
# 환경 변수로 새 로직 on/off
USE_RELEVANCE_BASED_AGGREGATION = os.getenv("USE_RELEVANCE_AGG", "true") == "true"

if USE_RELEVANCE_BASED_AGGREGATION and dp_metadata and sr_context:
    # 새 로직
    result = await self._collect_relevant(...)
else:
    # 기존 로직
    result = await self._collect_legacy(...)
```

---

## 12. 요약

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| **검색 기준** | category 문자열/임베딩 | DP 메타데이터 + SR 컨텍스트 복합 임베딩 |
| **소스 유형 결정** | 항상 둘 다 조회 | 전년도 SR 본문 패턴 분석으로 결정 |
| **폴백 전략** | category 무시하고 전체 조회 | 관련 없으면 빈 결과 반환 |
| **관련성 필터** | 없음 | 유사도 임계값 (0.5) 적용 |
| **결과 품질** | DP와 무관한 데이터 포함 | DP와 의미적으로 관련된 데이터만 |

---

## 13. 다음 단계

1. **Phase 1**: `pattern_detector.py` 구현 및 테스트
2. **Phase 2**: `sr_body_context_query.py` 구현
3. **Phase 3**: `relevance_analyzer.py` 구현
4. **Phase 4**: `aggregation_relevance.py` 구현
5. **Phase 5**: Agent 수정 및 통합 테스트
6. **Phase 6**: Orchestrator 수정 및 E2E 테스트

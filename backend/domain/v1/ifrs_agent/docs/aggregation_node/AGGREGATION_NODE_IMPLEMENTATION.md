# aggregation_node 구현 완료

**작성일**: 2026-04-05  
**최종 수정**: 2026-04-07 (프롬프트 기반 검색으로 전환)  
**목적**: 계열사/자회사·외부 기업 데이터 집계·조회 노드 구현

---

## 개요

`aggregation_node`는 문단 생성 시 **그룹 전체 맥락**을 제공하기 위해:
- **`subsidiary_data_contributions`**: 계열사/자회사 사업장별 상세 데이터 (정량+서술)
- **`external_company_data`**: 배치 크롤된 언론보도/뉴스 스냅샷

두 테이블을 검색·병합하여 `gen_node`에 전달합니다.

## 주요 변경 (2026-04-07)

### 1. Subsidiary 검색 방식
- **변경 전**: `description_embedding` 기반 관련성 검색
- **변경 후**: **`category_embedding` 기반 검색** (사용자 카테고리와 직접 매칭)
- **이유**: 카테고리 수준 매칭이 더 직관적이고 정확함

### 2. External 검색 방식
- **변경 전**: 관련성 임베딩 기반 자동 검색
- **변경 후**: **프롬프트 해석 기반 조건부 검색**
- **핵심**: 
  - Phase 0에서 프롬프트 분석 → `needs_external_data` 판단
  - 필요할 때만 External 조회 (불필요한 조회 방지)
  - 프롬프트 쿼리로 `body_embedding` 검색 (더 구체적)

---

## 아키텍처

```
Orchestrator
    ↓ (병렬 호출)
┌─────────────┬─────────────┬──────────────────┐
│   c_rag     │   dp_rag    │ aggregation_node │
│  (SR 본문)  │ (DP 데이터) │ (계열사·외부)    │
└─────────────┴─────────────┴──────────────────┘
    ↓           ↓              ↓
  ref_data   fact_data      agg_data
              ↓
           gen_node (문단 생성)
```

---

## 구현 구조

### 1. Tool 레이어 (`aggregation_query.py`)

**파일**: `backend/domain/shared/tool/ifrs_agent/database/aggregation_query.py`

#### 1.1 `query_subsidiary_data` (변경됨)

**검색 전략** (category_embedding 기반):
1. **정확 매칭**: `category` 문자열 일치
2. **벡터 유사도**: **`category_embedding`** 코사인 유사도 (정확 매칭 실패 시)
3. **DP 필터**: `related_dp_ids` 교차 (선택적)

**주요 변경**: `description_embedding` → `category_embedding`

**입력**:
```python
{
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "year": 2024,
    "category": "재생에너지",
    "dp_id": "ESRS2-E1-6",  # 선택
    "limit": 5
}
```

**출력**:
```python
[
    {
        "subsidiary_name": "동탄 데이터센터",
        "facility_name": "태양광 발전설비",
        "description": "2024년 태양광 발전량 172,497kWh 달성...",
        "quantitative_data": {"태양광_발전량_kWh": 172497},
        "category": "재생에너지",
        "report_year": 2024,
        "related_dp_ids": ["ESRS2-E1-6"],
        "data_source": "자회사 제출"
    }
]
```

#### 1.2 `query_external_by_prompt` (신규)

**검색 전략** (프롬프트 기반):
1. **프롬프트 임베딩**: `query_text` 임베딩 vs `body_embedding`
2. **키워드 부스팅**: `keywords`로 title/body_text 필터링 (선택)
3. **기본 필터**: `anchor_company_id`, `report_year`, `source_type IN ('press', 'news')`

**입력**:
```python
{
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "year": 2024,
    "query_text": "대학생 알고리즘 대회 IT 인재 채용 우수인재",
    "keywords": ["알고리즘대회", "IT인재", "우수인재"],  # 선택
    "limit": 3
}
```

**출력**:
```python
[
    {
        "title": "삼성SDS, 대학생 알고리즘 경진대회 개최",
        "body_text": "...",
        "source_url": "https://...",
        "source_type": "press",
        "fetched_at": "2024-03-15",
        "report_year": 2024,
        "related_dp_ids": []
    }
]
```

#### 1.3 `query_external_company_data` (레거시 - 폴백용)

**검색 전략**:
1. **기본 필터**: `anchor_company_id`, `report_year`, `source_type IN ('press', 'news')`
2. **벡터 유사도**: `body_embedding` 코사인 유사도 (category 임베딩)
3. **DP 필터**: `related_dp_ids` 교차 (선택적)

**사용 시점**: 프롬프트가 없을 때 폴백

---

### 2. Agent 레이어 (`AggregationNodeAgent`)

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/aggregation_node/agent.py`

#### 2.1 `collect()` 메서드 (변경됨)

**역할**:
- 프롬프트 해석 결과에 따라 조건부 External 실행
- Subsidiary는 항상 실행 (category_embedding 기반)

**입력** (확장됨):
```python
{
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "category": "재생에너지",
    "dp_id": "ESRS2-E1-6",  # 선택
    "years": [2024, 2023],
    # 신규 필드 (프롬프트 기반)
    "include_external": True,  # External 실행 여부
    "external_query": "대학생 알고리즘 대회 IT 인재",
    "external_keywords": ["알고리즘대회", "IT인재"]
}
```

**출력**:
```python
{
    "2024": {
        "subsidiary_data": [...],       # 최대 5건 (항상)
        "external_company_data": [...]  # 최대 3건 (조건부)
    },
    "2023": {
        "subsidiary_data": [...],
        "external_company_data": [...]
    }
}
```

#### 2.2 `_collect_year_with_prompt()` 메서드 (신규)

**역할**:
- Subsidiary: 항상 조회 (category_embedding)
- External: `include_external=True`일 때만 조회
  - `external_query` 있으면 프롬프트 검색
  - 없으면 category 폴백

#### 2.3 `_collect_year()` 메서드 (레거시)

**역할**:
- 하위 호환용 (기존 방식)
- 두 테이블 모두 조회

---

### 3. Orchestrator 연동 (변경됨)

**파일**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`

#### 3.1 Phase 0: 프롬프트 해석

```python
# prompt_interpretation.py에서 확장
{
    "search_intent": "...",
    "content_focus": "...",
    "needs_external_data": True,  # 신규
    "external_search_query": "대학생 알고리즘 대회 IT 인재",  # 신규
    "external_keywords": ["알고리즘대회", "IT인재"]  # 신규
}
```

#### 3.2 `_parallel_collect()` 수정

```python
# aggregation_node: 계열사·외부 기업 데이터
aggregation_task = None
if "aggregation_node" in self.infra.agent_registry.list_agents():
    # 프롬프트 해석 결과 전달
    prompt_interpretation = user_input.get("prompt_interpretation", {})
    
    aggregation_payload = {
        "company_id": company_id,
        "category": category,
        "years": years,
        # 신규: External 제어
        "include_external": prompt_interpretation.get("needs_external_data", True),
        "external_query": prompt_interpretation.get("external_search_query", ""),
        "external_keywords": prompt_interpretation.get("external_keywords", [])
    }
    
    # DP가 있으면 전달 (related_dp_ids 필터용)
    if user_input.get("dp_id"):
        aggregation_payload["dp_id"] = user_input["dp_id"]
    
    aggregation_task = self.infra.call_agent(
        "aggregation_node",
        "collect",
        self._agent_payload(aggregation_payload),
        timeout=heavy_timeout,
    )
```

#### 3.2 병렬 실행

```python
# c_rag, dp_rag, aggregation_node 병렬 실행
if dp_rag_task and aggregation_task:
    c_rag_result, dp_rag_result, agg_result = await asyncio.gather(
        c_rag_task, dp_rag_task, aggregation_task,
        return_exceptions=True
    )
```

---

## 검색 전략 상세

### 정확 매칭 → 벡터 폴백 패턴

```python
# 1단계: 정확 매칭
WHERE category = :user_category

# 2단계: 벡터 유사도 (정확 매칭 실패 시)
WHERE (category_embedding <-> :category_embedding) < threshold
ORDER BY similarity
```

**장점**:
- 카테고리 문자열 일치가 가장 정확
- 유사 표현 ("재생에너지" vs "신재생에너지")도 벡터로 커버
- `c_rag`와 동일한 패턴

---

## 데이터 흐름 (변경됨)

```
사용자 요청: 
  category="인재 채용"
  prompt="대학생 알고리즘 대회와 IT 우수인재 확보에 대해 작성해봐"
    ↓
Phase 0: 프롬프트 해석 (Gemini)
    ↓
  needs_external_data: True
  external_search_query: "대학생 알고리즘 대회 IT 인재 채용"
  external_keywords: ["알고리즘대회", "IT인재"]
    ↓
Orchestrator._parallel_collect()
    ↓ (병렬)
┌────────────────────────────────────────────────────┐
│ aggregation_node.collect()                         │
│   include_external=True                            │
│   external_query="대학생 알고리즘 대회..."          │
│   ↓                                                │
│ _collect_year_with_prompt(2024) ║ (2023)          │
│   ↓ (병렬)                      ║                 │
│ query_subsidiary (category_embedding)              │
│   ↓                                                │
│ 정확 매칭 → 벡터 검색 → 상위 5건                  │
│   ↓                                                │
│ query_external_by_prompt (프롬프트 임베딩)         │
│   ↓                                                │
│ body_embedding 검색 + 키워드 부스팅 → 상위 3건    │
└────────────────────────────────────────────────────┘
    ↓
agg_data = {
    "2024": {
        "subsidiary_data": [...],  # 인재 채용 관련 계열사 데이터
        "external_company_data": [...]  # 알고리즘 대회 보도자료
    },
    "2023": {...}
}
    ↓
gen_node (문단 생성)
```

**조건부 실행 예시**:
- 프롬프트 없음 → `include_external=True` (기본), category 폴백
- 프롬프트 "인재상 및 채용절차" → `needs_external_data=False`, External skip
- 프롬프트 "알고리즘 대회" → `needs_external_data=True`, 프롬프트 검색

---

## 핵심 설계 결정 (업데이트됨)

| 항목 | 결정 | 이유 |
|------|------|------|
| **Subsidiary 검색** | `category_embedding` 기반 | 사용자 카테고리와 직접 매칭, 더 직관적 |
| **External 검색** | 프롬프트 기반 조건부 | 불필요한 조회 방지, 정확도 향상 |
| **검색 우선순위** | 정확 매칭 → 벡터 유사도 | 카테고리 문자열 일치가 가장 정확 |
| **DP 필터** | 선택적 (있으면 적용) | DP 없는 요청도 지원, 있으면 정확도 향상 |
| **연도 처리** | 연도별 독립 조회 후 병합 | `c_rag`와 동일 패턴, 병렬 가능 |
| **결과 제한** | subsidiary 5개, external 3개 | `gen_node` 컨텍스트 길이 고려 |
| **임베딩 모델** | BGE-M3 (기존과 동일) | `c_rag`, `dp_rag`와 통일 |
| **LLM** | Phase 0에서만 (프롬프트 해석) | aggregation_node 자체는 순수 DB 조회 |
| **타임아웃** | `heavy_timeout` (300s) | 벡터 검색·임베딩 생성 고려 |
| **병렬성** | 유지 (c_rag, dp_rag와 동시) | Phase 0 결과를 미리 전달하여 병렬 실행 |

---

## 테스트 시나리오

**파일**: `backend/domain/v1/ifrs_agent/tests/test_aggregation_node.py`

1. **툴 단독 테스트**: `query_subsidiary_data`, `query_external_company_data`
2. **에이전트 테스트**: `AggregationNodeAgent.collect()`
3. **DP 필터 테스트**: `related_dp_ids` 교차 검증
4. **Orchestrator 통합**: `_parallel_collect`에서 `agg_data` 포함 확인

---

## 구현된 파일

| 파일 | 역할 |
|------|------|
| `aggregation_query.py` | DB 조회 툴 (subsidiary + external) |
| `aggregation_node/agent.py` | 에이전트 클래스 및 핸들러 |
| `aggregation_node/__init__.py` | 패키지 진입점 |
| `bootstrap.py` | 툴·에이전트 등록 |
| `orchestrator.py` | `_parallel_collect`에서 aggregation_node 호출 |
| `test_aggregation_node.py` | 통합 테스트 |

---

## 사용 예시

### 시나리오 A: 프롬프트 있음 (External 필요)

**API 요청**:
```bash
POST /api/v1/ifrs_agent/create
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "인재 채용",
  "prompt": "대학생 알고리즘 대회와 IT 우수인재 확보에 대해 작성해봐"
}
```

**Phase 0 해석 결과**:
```json
{
  "needs_external_data": true,
  "external_search_query": "대학생 알고리즘 대회 IT 인재 채용",
  "external_keywords": ["알고리즘대회", "IT인재"]
}
```

**응답 (references.agg_data)**:
```json
{
  "references": {
    "agg_data": {
      "2024": {
        "subsidiary_data": [
          {
            "subsidiary_name": "삼성SDS",
            "category": "인재 채용",
            "description": "2024년 신입사원 500명 채용..."
          }
        ],
        "external_company_data": [
          {
            "title": "삼성SDS, 대학생 알고리즘 경진대회 개최",
            "body_text": "IT 인재 발굴을 위한...",
            "source_url": "https://..."
          }
        ]
      }
    }
  }
}
```

### 시나리오 B: 프롬프트 없음 (External skip)

**API 요청**:
```bash
POST /api/v1/ifrs_agent/create
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "인재상 및 채용절차"
}
```

**Phase 0 해석 결과**:
```json
{
  "needs_external_data": false
}
```

**응답 (references.agg_data)**:
```json
{
  "references": {
    "agg_data": {
      "2024": {
        "subsidiary_data": [...],
        "external_company_data": []  // skip
      }
    }
  }
}
```

---

## 다음 단계

1. **시드 데이터 적재**:
   - `subsidiary_data_contributions_dummy.json` → DB
   - `external_company_data` 크롤 또는 더미 적재

2. **테스트 실행**:
   ```bash
   python backend/domain/v1/ifrs_agent/tests/test_aggregation_node.py
   ```

3. **gen_node 확장**:
   - `agg_data` 활용하여 계열사 사례·외부 보도 통합
   - 문단에 "동탄 DC 태양광 172,497kWh" 같은 구체적 사례 포함

---

## 핵심 개선 (2026-04-07 업데이트)

### 기존 개선
1. **그룹 전체 맥락**: 모회사 SR + 계열사 상세 + 언론 보도 통합
2. **구체적 사례**: "그룹 전체 재생에너지 확대" → "동탄 DC 태양광 172,497kWh"
3. **외부 검증**: 언론 보도로 공시 내용 교차 검증
4. **확장 가능**: DP 필터로 정확도 향상, 연도 추가 가능

### 신규 개선 (프롬프트 기반)
1. **정확도 향상**: 
   - Subsidiary: category_embedding으로 직접 매칭
   - External: 프롬프트 의도 기반 검색
2. **성능 최적화**: 
   - External 불필요 시 조회 생략
   - 불필요한 벡터 검색 방지
3. **유연성**: 
   - 프롬프트 있으면 정밀 검색
   - 없으면 category 폴백
4. **병렬성 유지**: 
   - Phase 0 결과를 미리 전달
   - c_rag, dp_rag와 동시 실행

---

## 제약 사항

1. **임베딩 의존**: `category_embedding`, `content_embedding`이 NULL이면 벡터 검색 불가
2. **시드 데이터 필요**: 두 테이블에 데이터가 없으면 빈 리스트 반환
3. **LLM 없음**: 순수 SQL 검색, 의미 해석은 `gen_node`에서

---

## 요약

- **Tool**: `query_subsidiary_data`, `query_external_company_data` (정확 매칭 → 벡터)
- **Agent**: `AggregationNodeAgent.collect()` (연도별 병렬 조회)
- **Orchestrator**: `_parallel_collect`에서 `agg_data` 병합
- **테스트**: 5개 시나리오 (툴·에이전트·Orchestrator 통합)
- **상태**: ✅ 구현 완료, ⏳ 시드 데이터 적재 및 실행 테스트 대기

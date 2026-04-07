# Aggregation Node 구현 변경 사항

**날짜**: 2026-04-07  
**변경 유형**: 검색 전략 개선 (관련성 모드 → 프롬프트 기반)

---

## 변경 전후 비교

### Subsidiary 검색

| 항목 | 기존 (관련성 모드) | 신규 (프롬프트 모드) |
|------|-------------------|---------------------|
| **검색 컬럼** | `description_embedding` | `category_embedding` |
| **쿼리 벡터** | `relevance_embedding` (DP+SR 복합) | 사용자 `category` 임베딩 |
| **장점** | DP 메타 반영 | 직관적, 예측 가능 |
| **단점** | 너무 세부적, 복잡 | - |

### External 검색

| 항목 | 기존 (관련성 모드) | 신규 (프롬프트 모드) |
|------|-------------------|---------------------|
| **실행 조건** | 항상 (source_type 판단) | 조건부 (`needs_external_data`) |
| **판단 기준** | SR 본문 패턴 분석 | 프롬프트 LLM 해석 |
| **쿼리 벡터** | `relevance_embedding` | 프롬프트 텍스트 임베딩 |
| **검색 컬럼** | `category_embedding` OR `body_embedding` | `body_embedding` + 키워드 |
| **장점** | 자동화 | 정확, 효율적 |
| **단점** | 불안정, 항상 실행 | 프롬프트 의존 |

---

## 구현 상세

### 1. Phase 0 확장 (`prompt_interpretation.py`)

**신규 필드**:
```python
{
    "needs_external_data": bool,           # External 필요 여부
    "external_search_query": str,          # 검색 쿼리
    "external_keywords": List[str]         # 키워드 배열
}
```

**LLM 프롬프트 확장**:
- External 필요 판단 기준 추가
- 대회/수상/협약/보도 패턴 감지
- 키워드 추출 지시

**폴백 로직**:
- 간단한 패턴 매칭으로 `needs_external_data` 판단
- 키워드 추출

---

### 2. 신규 툴 (`aggregation_query.py`)

**`query_external_by_prompt`**:

**입력**:
```python
{
    "company_id": str,
    "year": int,
    "query_text": str,      # 프롬프트 또는 검색 쿼리
    "keywords": List[str],  # 키워드 부스팅용
    "limit": int            # 기본 3
}
```

**검색 로직**:
1. `query_text` 임베딩 생성
2. `body_embedding` 벡터 검색
3. 키워드 ILIKE 필터 (선택)
4. 유사도 정렬, 상위 N건

**SQL**:
```sql
SELECT * FROM external_company_data
WHERE anchor_company_id = $1
  AND report_year = $2
  AND source_type IN ('press', 'news')
  AND body_embedding IS NOT NULL
  AND (title ILIKE '%keyword%' OR body_text ILIKE '%keyword%')
ORDER BY (body_embedding <-> $query_embedding)
LIMIT 3;
```

---

### 3. Agent 수정 (`agent.py`)

**`collect` 메서드**:
- 신규 필드 수신: `include_external`, `external_query`, `external_keywords`
- `_collect_with_prompt` 호출

**`_collect_with_prompt` (신규)**:
- 연도별 `_collect_year_with_prompt` 병렬 실행

**`_collect_year_with_prompt` (신규)**:
- Subsidiary: 항상 `query_subsidiary_data` 호출
- External: 조건부 실행
  - `external_query` 있으면 `query_external_by_prompt`
  - 없으면 `query_external_company_data` (폴백)
  - `include_external=False`면 skip

---

### 4. Orchestrator 연동 (`orchestrator.py`)

**`_parallel_collect` 수정**:

```python
# 프롬프트 해석 결과 추출
prompt_interpretation = user_input.get("prompt_interpretation", {})

# aggregation_payload 구성
aggregation_payload = {
    "company_id": company_id,
    "category": category,
    "years": years,
    # 신규: External 제어
    "include_external": prompt_interpretation.get("needs_external_data", True),
    "external_query": prompt_interpretation.get("external_search_query", ""),
    "external_keywords": prompt_interpretation.get("external_keywords", [])
}
```

---

## 실행 흐름 예시

### 예시 1: External 필요

```
사용자 입력:
  category: "인재 채용"
  prompt: "대학생 알고리즘 대회와 IT 우수인재 확보"

↓ Phase 0: 프롬프트 해석
  needs_external_data: True
  external_search_query: "대학생 알고리즘 대회 IT 인재 채용"
  external_keywords: ["알고리즘대회", "IT인재"]

↓ Phase 1: Aggregation
  Subsidiary:
    category="인재 채용" → category_embedding 검색
    → 5건 (계열사 채용 데이터)
  
  External:
    query_text="대학생 알고리즘 대회 IT 인재 채용"
    keywords=["알고리즘대회", "IT인재"]
    → body_embedding 검색 + 키워드 필터
    → 3건 (알고리즘 대회 보도자료)

↓ 결과
  agg_data = {
    "2024": {
      "subsidiary_data": [5건],
      "external_company_data": [3건]
    }
  }
```

### 예시 2: External 불필요

```
사용자 입력:
  category: "인재상 및 채용절차"
  prompt: ""

↓ Phase 0: 프롬프트 해석
  needs_external_data: False (패턴 없음)

↓ Phase 1: Aggregation
  Subsidiary:
    category="인재상 및 채용절차" → category_embedding 검색
    → 5건
  
  External:
    skip (include_external=False)

↓ 결과
  agg_data = {
    "2024": {
      "subsidiary_data": [5건],
      "external_company_data": []
    }
  }
```

---

## 장점 정리

### 1. 정확도 향상

**Subsidiary**:
- 사용자 카테고리와 직접 매칭
- "재생에너지" → "재생에너지" 계열사 데이터

**External**:
- 프롬프트 의도 반영
- "알고리즘 대회" → "알고리즘 대회" 보도자료

### 2. 성능 최적화

- External 불필요 시 조회 생략
- 벡터 검색 횟수 감소
- 키워드 필터로 후보 축소

### 3. 유연성

- 프롬프트 있으면 정밀 검색
- 없으면 category 폴백
- 하위 호환 유지

### 4. 병렬성 유지

- Phase 0 결과를 미리 전달
- c_rag, dp_rag와 동시 실행
- 전체 파이프라인 지연 없음

---

## 제거된 기능

### 관련성 모드 (`USE_RELEVANCE_AGG`)

**제거 이유**:
1. 복잡도 높음 (`analyze_prior_year_body`, `pattern_detector`)
2. 불안정 (SR 본문 패턴 의존)
3. 전년도 본문 없으면 skip
4. 프롬프트 모드가 더 정확하고 단순

**파일 상태**:
- `relevance_analyzer.py`: 유지 (참고용)
- `pattern_detector.py`: 유지 (참고용)
- `aggregation_relevance.py`: 유지 (참고용)
- `agent.py`: `_collect_relevant` 메서드 유지 (하위 호환)

**환경 변수**:
- `USE_RELEVANCE_AGG`: 무시됨 (프롬프트 모드가 기본)

---

## 다음 단계

### 즉시
1. 단위 테스트 작성
   - `test_query_external_by_prompt`
   - `test_prompt_interpretation_external`
   - `test_aggregation_conditional_external`

2. 통합 테스트
   - 시나리오 1, 2, 3 실행
   - 프롬프트 패턴별 검증

### 단기
1. DB 데이터 확인
   - `subsidiary_data_contributions.category_embedding` 채워짐 확인
   - `external_company_data.body_embedding` 채워짐 확인

2. 성능 모니터링
   - External skip 비율 측정
   - 벡터 검색 시간 측정

### 중기
1. 키워드 추출 고도화
2. 유사도 임계값 동적 조정
3. External 소스 확장 (RSS, 블로그)

---

**최종 수정**: 2026-04-07  
**상태**: ✅ 구현 완료, 테스트 대기

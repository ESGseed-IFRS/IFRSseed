# 프롬프트 기반 Aggregation 설계

**작성일**: 2026-04-07  
**목적**: 프롬프트 해석 기반 조건부 External 검색 설계

---

## 1. 배경

### 기존 문제점

1. **Subsidiary 검색 부정확**:
   - `description_embedding` 기반 → 너무 세부적
   - 사용자 카테고리와 직접 매칭 어려움

2. **External 검색 비효율**:
   - 항상 실행 → 불필요한 조회 많음
   - Category로 보도자료 매칭 어려움
   - 예: "인재상" 카테고리로 "알고리즘 대회" 보도 찾기 불가능

3. **관련성 모드 복잡도**:
   - `analyze_prior_year_body` → `source_type` 판단
   - SR 본문 패턴 분석 → 불안정
   - 전년도 본문 없으면 skip

---

## 2. 새로운 설계

### 핵심 아이디어

1. **Subsidiary**: `category_embedding` 기반 (단순화)
2. **External**: 프롬프트 해석 기반 조건부 실행
3. **병렬성 유지**: Phase 0 결과를 미리 전달

### 데이터 흐름

```
사용자 요청
    ↓
Phase 0: 프롬프트 해석 (Gemini)
    ├─ needs_external_data: bool
    ├─ external_search_query: str
    └─ external_keywords: List[str]
    ↓
Phase 1: 병렬 수집 (c_rag, dp_rag, aggregation_node)
    ├─ c_rag: SR 본문·이미지
    ├─ dp_rag: DP 팩트 데이터
    └─ aggregation_node:
        ├─ Subsidiary (항상): category_embedding
        └─ External (조건부): 프롬프트 임베딩
    ↓
Phase 2: 데이터 선택·필터링
    ↓
Phase 3: gen_node 생성
```

---

## 3. Phase 0: 프롬프트 해석 확장

### 3.1 LLM 프롬프트

```python
sys_prompt = """당신은 지속가능경영보고서(SR) 초안 작성 도우미의 의도 분석기입니다.

## 출력 JSON 스키마
{
  "search_intent": "...",
  "content_focus": "...",
  "needs_external_data": false,
  "external_search_query": "",
  "external_keywords": []
}

## External 데이터 필요 판단 기준

다음 패턴이 프롬프트에 있으면 needs_external_data = true:
- 대회/행사: "알고리즘 대회", "해커톤", "컨퍼런스"
- 수상/인증: "수상", "인증 획득", "장관상"
- 협약/제휴: "MOU", "업무협약", "파트너십"
- 외부 평가: "외부 기관", "제3자 검증"
- 언론 보도: "보도자료", "뉴스", "기사"
- 채용/인재: "우수인재", "인재확보" (외부 활동 맥락)
"""
```

### 3.2 예시

**입력**:
```
category: "인재 채용"
prompt: "대학생 알고리즘 대회와 IT 우수인재 확보에 대해 작성해봐"
```

**출력**:
```json
{
  "search_intent": "인재 채용 알고리즘 대회",
  "content_focus": "대학생 알고리즘 대회 및 IT 우수인재 확보 활동",
  "needs_external_data": true,
  "external_search_query": "대학생 알고리즘 대회 IT 인재 채용 우수인재",
  "external_keywords": ["알고리즘대회", "IT인재", "우수인재", "채용"]
}
```

---

## 4. Subsidiary 검색 (변경)

### 4.1 검색 전략

**변경 전**: `description_embedding` vs `relevance_embedding`
**변경 후**: `category_embedding` vs `category` 텍스트 임베딩

### 4.2 SQL 쿼리

```sql
-- 1단계: 정확 매칭
SELECT * FROM subsidiary_data_contributions
WHERE company_id = $1
  AND report_year = $2
  AND category = $3  -- "재생에너지"
LIMIT 5;

-- 2단계: 벡터 검색 (정확 매칭 실패 시)
SELECT * FROM subsidiary_data_contributions
WHERE company_id = $1
  AND report_year = $2
  AND category_embedding IS NOT NULL
ORDER BY (category_embedding <-> $3::vector)  -- category 임베딩
LIMIT 5;
```

### 4.3 장점

- 사용자 카테고리와 직접 매칭
- 더 직관적이고 예측 가능
- description보다 넓은 범위 (사업장 전체)

---

## 5. External 검색 (신규)

### 5.1 조건부 실행

```python
if include_external:
    if external_query:
        # 프롬프트 기반 검색
        results = query_external_by_prompt(
            query_text=external_query,
            keywords=external_keywords
        )
    else:
        # 폴백: category 기반
        results = query_external_company_data(
            category=category
        )
else:
    # skip
    results = []
```

### 5.2 프롬프트 기반 검색

**툴**: `query_external_by_prompt`

**SQL**:
```sql
SELECT * FROM external_company_data
WHERE anchor_company_id = $1
  AND report_year = $2
  AND source_type IN ('press', 'news')
  AND body_embedding IS NOT NULL
  -- 키워드 필터 (선택)
  AND (
    title ILIKE '%알고리즘대회%' OR body_text ILIKE '%알고리즘대회%'
    OR title ILIKE '%IT인재%' OR body_text ILIKE '%IT인재%'
  )
ORDER BY (body_embedding <-> $3::vector)  -- 프롬프트 임베딩
LIMIT 3;
```

### 5.3 장점

- 프롬프트 의도 직접 반영
- 불필요한 조회 방지 (성능 향상)
- 키워드 부스팅으로 정확도 향상

---

## 6. 비교표

### Subsidiary

| 항목 | 기존 (관련성 모드) | 신규 (프롬프트 모드) |
|------|-------------------|---------------------|
| **검색 컬럼** | `description_embedding` | `category_embedding` |
| **쿼리 벡터** | `relevance_embedding` | `category` 텍스트 임베딩 |
| **매칭 수준** | 사업장 상세 설명 | 사업장 카테고리 |
| **정확도** | 너무 세부적 | 적절한 수준 |

### External

| 항목 | 기존 (관련성 모드) | 신규 (프롬프트 모드) |
|------|-------------------|---------------------|
| **실행 조건** | 항상 (source_type 판단) | 조건부 (needs_external_data) |
| **쿼리 벡터** | `relevance_embedding` | 프롬프트 임베딩 |
| **판단 기준** | SR 본문 패턴 분석 | 프롬프트 LLM 해석 |
| **정확도** | 불안정 (패턴 의존) | 높음 (의도 직접 반영) |

---

## 7. 구현 파일

| 파일 | 변경 내용 |
|------|----------|
| `prompt_interpretation.py` | `needs_external_data`, `external_search_query`, `external_keywords` 추가 |
| `aggregation_query.py` | `query_external_by_prompt` 툴 추가 |
| `aggregation_node/agent.py` | `_collect_with_prompt`, `_collect_year_with_prompt` 추가 |
| `orchestrator.py` | 프롬프트 해석 결과를 aggregation_payload에 전달 |
| `bootstrap.py` | `query_external_by_prompt` 툴 등록 |

---

## 8. 테스트 시나리오

### 시나리오 A: External 필요

**입력**:
```
category: "인재 채용"
prompt: "대학생 알고리즘 대회와 IT 우수인재 확보"
```

**기대 결과**:
- `needs_external_data`: True
- Subsidiary: "인재 채용" 카테고리 계열사 데이터
- External: "알고리즘 대회" 보도자료

### 시나리오 B: External 불필요

**입력**:
```
category: "인재상 및 채용절차"
prompt: ""
```

**기대 결과**:
- `needs_external_data`: False
- Subsidiary: "인재상 및 채용절차" 카테고리 계열사 데이터
- External: [] (skip)

### 시나리오 C: 프롬프트 없음 (폴백)

**입력**:
```
category: "재생에너지"
prompt: ""
```

**기대 결과**:
- `needs_external_data`: True (기본값)
- Subsidiary: "재생에너지" 카테고리 계열사 데이터
- External: "재생에너지" category 폴백 검색

---

## 9. 마이그레이션 가이드

### 기존 코드 (관련성 모드)

```python
# 사용 안 함 (주석 처리)
# USE_RELEVANCE_BASED_AGGREGATION = False
```

### 신규 코드 (프롬프트 모드)

```python
# 기본 동작 (환경 변수 불필요)
aggregation_payload = {
    "include_external": prompt_interpretation.get("needs_external_data", True),
    "external_query": prompt_interpretation.get("external_search_query", ""),
    "external_keywords": prompt_interpretation.get("external_keywords", [])
}
```

---

## 10. 향후 개선

1. **키워드 추출 고도화**: LLM으로 더 정확한 키워드 추출
2. **유사도 임계값 조정**: 벡터 검색 threshold 동적 조정
3. **External 소스 확장**: RSS, 블로그 등 추가
4. **캐싱**: 동일 프롬프트 재사용 시 캐싱

---

## 요약

| 항목 | 내용 |
|------|------|
| **목표** | 프롬프트 기반 정확한 External 검색 |
| **핵심 변경** | Subsidiary: category_embedding, External: 조건부 프롬프트 검색 |
| **장점** | 정확도↑, 성능↑, 병렬성 유지 |
| **상태** | ✅ 구현 완료 |

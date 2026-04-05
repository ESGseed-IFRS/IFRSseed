# 정성 DP 전용 라우팅 설계

**작성일**: 2026-04-05  
**목적**: `dp_type`이 `qualitative` / `narrative` / `binary`인 DP를 위한 데이터 수집 경로 설계

---

## 1. 배경

### 현재 상황 (2026-04-05)

- **오케스트레이터**: `_check_dp_type_for_routing`으로 `quantitative`만 `dp_rag` 호출.
- **정성 DP**: `fact_data = {}` (빈 dict) — **데이터 소스 없음**.

### 문제

정성 DP는 **수치가 아니라 서술·정책·예/아니오 + 설명**을 요구하는데, 현재는 **어디서도 가져오지 않음**.

예:
- "인센티브에 기후 고려 반영 **여부·방법**" → 회사 정책 문서·SR 본문·폼 답변
- "이사회 구성 **다양성 정책**" → 거버넌스 문서·SR 서술
- "공급망 ESG 평가 **수행 여부**" → 예/아니오 + 설명

---

## 2. 설계 옵션

### 옵션 A: `c_rag` 통합 (간단, 즉시 적용 가능)

#### 아이디어

- 정성 DP도 **`c_rag`에 라우팅**.
- `c_rag`가 SR 본문·이미지에서 **DP 주제와 관련된 문단**을 검색해 반환.
- 오케스트레이터가 `fact_data` 대신 `narrative_data` 슬롯에 저장.

#### 장점

- 기존 `c_rag` 인프라 재사용 (벡터 검색·하이브리드 검색 이미 구현됨).
- 빠른 구현 — `_parallel_collect`에서 정성 DP일 때 `c_rag` 호출만 추가.

#### 단점

- SR 본문에 **해당 정보가 없으면** 빈 결과.
- 정성 DP 전용 **폼 답변·별도 문서**는 커버 안 됨.

#### 구현 예시

```python
# orchestrator._parallel_collect
if user_input.get("dp_id"):
    dp_type_check = await self._check_dp_type_for_routing(user_input["dp_id"])
    
    if dp_type_check["is_quantitative"]:
        dp_rag_task = ...
    else:
        # 정성 DP → c_rag로 라우팅 (주제 키워드로 검색)
        narrative_task = self.infra.call_agent(
            "c_rag", "collect",
            {
                "company_id": company_id,
                "category": category,
                "years": years,
                "narrative_query": dp_meta.get("description")  # DP 설명을 쿼리로
            }
        )
```

---

### 옵션 B: `narrative_rag` 신규 노드 (정교, 장기)

#### 아이디어

- 정성 DP 전용 **`narrative_rag` 에이전트** 신규 구현.
- 데이터 소스:
  1. **SR 본문** (c_rag와 동일)
  2. **정성 DP 전용 폼 답변** (예: `qualitative_dp_responses` 테이블)
  3. **정책 문서·첨부 파일** (별도 벡터 DB 또는 파일 스토리지)

#### 장점

- 정성 DP에 최적화된 검색·매칭 로직.
- SR 본문 외 **다양한 소스** 통합 가능.
- `fact_data`와 분리된 `narrative_data` 구조 — 명확한 책임 분리.

#### 단점

- 신규 에이전트 구현 필요 (시간·복잡도).
- 정성 DP 전용 테이블·폼 UI도 함께 개발해야 함.

#### 구현 예시

```python
# orchestrator._parallel_collect
if not dp_type_check["is_quantitative"]:
    narrative_task = self.infra.call_agent(
        "narrative_rag", "collect",
        {
            "company_id": company_id,
            "dp_id": user_input["dp_id"],
            "year": 2024,
            "sources": ["sr_body", "qualitative_forms", "policy_docs"]
        }
    )
```

**narrative_rag 응답 구조**:
```json
{
  "dp_id": "UCM_...",
  "narrative_text": "당사는 임원 보수에 기후 목표 달성률을 20% 반영하고 있습니다...",
  "sources": [
    {"type": "sr_body", "page": 12, "paragraph": "..."},
    {"type": "qualitative_form", "question_id": "Q123", "answer": "..."}
  ],
  "confidence": 0.85,
  "error": null
}
```

---

### 옵션 C: 하이브리드 (단기 + 장기)

1. **단기 (즉시)**: 옵션 A — `c_rag` 통합.
2. **중기**: 정성 DP 전용 폼 UI + 테이블 구축.
3. **장기**: `narrative_rag` 구현 — SR·폼·문서 통합 검색.

---

## 3. 권장 방향 (옵션 C — 하이브리드)

### Phase 1 (즉시): `c_rag` 통합

- 오케스트레이터에서 정성 DP → `c_rag` 호출 (주제 키워드로 검색).
- 응답을 `narrative_data` 슬롯에 저장.
- gen_node가 `fact_data` 없고 `narrative_data`만 있으면 서술 위주 문단 생성.

### Phase 2 (중기): 정성 DP 폼

- 관리자/사용자가 정성 DP 답변을 입력하는 **폼 UI**.
- `qualitative_dp_responses` 테이블 (스키마 예시):
  ```sql
  CREATE TABLE qualitative_dp_responses (
      id UUID PRIMARY KEY,
      company_id UUID NOT NULL,
      dp_id TEXT NOT NULL,
      report_year INT NOT NULL,
      response_text TEXT,
      response_type TEXT,  -- 'yes_no', 'narrative', 'policy'
      attachments JSONB,
      created_at TIMESTAMP,
      UNIQUE(company_id, dp_id, report_year)
  );
  ```

### Phase 3 (장기): `narrative_rag`

- 신규 에이전트 구현.
- SR 본문·폼·정책 문서 통합 검색.
- 오케스트레이터에서 `c_rag` 대신 `narrative_rag` 호출.

---

## 4. Phase 1 구현 상세 (c_rag 통합)

### 4.1 오케스트레이터 수정

```python
# _parallel_collect
if user_input.get("dp_id"):
    dp_type_check = await self._check_dp_type_for_routing(user_input["dp_id"])
    
    if dp_type_check["is_quantitative"]:
        # 정량 DP → dp_rag
        dp_rag_task = self.infra.call_agent("dp_rag", "collect", ...)
        narrative_task = None
    else:
        # 정성 DP → c_rag (주제 키워드 검색)
        dp_meta = await self.infra.call_tool("query_dp_metadata", {"dp_id": user_input["dp_id"]})
        
        narrative_task = self.infra.call_agent(
            "c_rag", "collect",
            {
                "company_id": company_id,
                "category": category,
                "years": years,
                "narrative_query": dp_meta.get("description") or dp_meta.get("name_ko")
            }
        )
        dp_rag_task = None

# 대기
if dp_rag_task:
    c_rag_result, dp_rag_result, agg_result = await asyncio.gather(...)
    narrative_result = {}
elif narrative_task:
    c_rag_result, narrative_result, agg_result = await asyncio.gather(...)
    dp_rag_result = {}
else:
    c_rag_result, agg_result = await asyncio.gather(...)
    dp_rag_result = {}
    narrative_result = {}

return {
    "ref_data": c_rag_result,
    "fact_data": dp_rag_result,
    "narrative_data": narrative_result,  # 신규 슬롯
    "agg_data": agg_result
}
```

### 4.2 c_rag 수정 (선택적)

- `payload`에 `narrative_query` 있으면 **해당 키워드로 벡터 검색**.
- 없으면 기존 `category` 기반 검색 (하위 호환).

### 4.3 gen_node 수정

```python
# gen_node
if state.get("fact_data") and state["fact_data"].get("value"):
    # 정량 DP → 수치 위주 문단
    prompt = f"다음 수치를 바탕으로 문단 작성: {state['fact_data']['value']} {state['fact_data']['unit']}"
elif state.get("narrative_data"):
    # 정성 DP → 서술 위주 문단
    prompt = f"다음 내용을 바탕으로 문단 작성: {state['narrative_data']['body_text']}"
else:
    # 둘 다 없음 → SR 본문만
    prompt = "SR 본문을 참고하여 문단 작성"
```

---

## 5. 테스트 시나리오

### 시나리오 1: 정량 DP (기존)

**입력**: `dp_id="ESRS2-E1-6"` (Scope 1 배출량)

**예상**:
- `_check_dp_type_for_routing` → `is_quantitative=True`
- `dp_rag` 호출 → `fact_data: {value: 473.9, unit: "tCO2e"}`
- `narrative_data: {}`

### 시나리오 2: 정성 DP (c_rag 통합)

**입력**: `dp_id="UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i"` (인센티브 여부·방법)

**예상**:
- `_check_dp_type_for_routing` → `is_quantitative=False`
- `c_rag` 호출 (narrative_query="인센티브 제도에 기후 고려 반영")
- `narrative_data: {body_text: "당사는 임원 보수에 기후 목표 달성률을 반영...", page_number: 12}`
- `fact_data: {}`

### 시나리오 3: 정성 DP + SR 본문 없음

**입력**: `dp_id="SOME_QUAL_DP"`, SR 본문에 관련 내용 없음

**예상**:
- `c_rag` → `narrative_data: {body_text: "", error: "No matching content"}`
- gen_node → "데이터 부족" 경고 또는 빈 문단

---

## 6. 다음 단계

1. **Phase 1 구현** (이번 세션):
   - 오케스트레이터 `_parallel_collect` 수정 (정성 DP → c_rag).
   - gen_node 스텁 개선 (`narrative_data` 처리).

2. **Phase 2 설계** (후속):
   - `qualitative_dp_responses` 테이블 스키마.
   - 폼 UI 와이어프레임.

3. **Phase 3 구현** (장기):
   - `narrative_rag` 에이전트.
   - 통합 테스트.

---

**최종 수정**: 2026-04-05

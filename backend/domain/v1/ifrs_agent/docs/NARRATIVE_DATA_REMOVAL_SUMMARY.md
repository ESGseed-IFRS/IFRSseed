# narrative_data 제거 및 정성 DP 통합 처리 완료

**작성일**: 2026-04-05  
**목적**: `narrative_data` 제거 및 정성 DP를 `dp_rag`로 통합 처리

---

## 배경

### 이전 설계의 문제점

1. **논리적 모순**: 사용자가 카테고리로 SR 본문을 이미 가져왔는데, 정성 DP description으로 SR 본문을 또 검색하는 중복 구조
2. **역할 혼란**: 
   - `c_rag`: SR 본문·이미지 검색 (카테고리 기반)
   - `dp_rag`: DP 기준·실데이터 제공
   - `narrative_data`: DP description으로 SR 본문 재검색 (역할 불명확)
3. **정성 DP의 본질 오해**: 정성 DP에 필요한 건 "과거 SR 본문"이 아니라 "DP 요구사항·기준(rulebook)"

### 올바른 설계 방향

- **정량 DP**: `dp_rag` → `fact_data` (value, unit, rulebook)
- **정성 DP**: `dp_rag` → `fact_data` (value=None, description, rulebook)
- **SR 본문 참조**: `c_rag` → `ref_data` (카테고리 기반, 모든 DP 공통)

---

## 변경 사항

### 1. dp_rag 확장 (정성 DP 처리)

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/agent.py`

```python
# DP 유형 체크 — 정성 DP는 실데이터 조회 생략
dp_type = (dp_meta.get("dp_type") if dp_meta else None) or "quantitative"
is_qualitative = dp_type in ("qualitative", "narrative", "binary")

# UCM 전용 DP (dp_meta=None)의 경우: UCM 정성적 키워드 체크
if not dp_meta and ucm_info:
    qualitative_hits = _ucm_qualitative_keyword_hits(ucm_info)
    if qualitative_hits >= 2:  # 2개 이상 키워드 발견 시 정성으로 판단
        is_qualitative = True
        dp_type = "narrative"

if is_qualitative:
    # 정성 DP: 실데이터 없음, description + rulebook만 반환
    return {
        "dp_id": dp_id,
        "value": None,  # 정성 DP는 수치 없음
        "dp_metadata": {...},  # name_ko, description, dp_type
        "rulebook": {...},  # rulebook_content, disclosure_requirement
        "confidence": 1.0,
        ...
    }
```

**정성 키워드 목록** (`_UCM_QUALITATIVE_KEYWORDS`):
- 한국어: 여부, 방법, 설명, 기술, 공개, 보고, 정책, 절차, 프로세스, 체계, 구조, 조직, 거버넌스, 전략, 계획, 목표, 이니셔티브, 프로그램, 활동, 조치, 대응, 관리, 평가, 검토, 분석, 식별, 파악, 고려, 반영, 통합
- 영어: whether, how, describe, disclose, report, policy, procedure, process, structure, governance, strategy

**효과**:
- 정성 DP도 `dp_rag`가 처리
- `fact_data`에 DP 요구사항·기준 제공
- 물리 테이블 매핑 생략 (정성 DP는 실데이터 없음)
- **UCM 전용 DP에서도 정성 판단 가능** (dp_meta 없어도 UCM description 기반 판단)

### 2. orchestrator 단순화

**파일**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`

**제거**:
- `_check_dp_type_for_routing` 호출 (정량/정성 분기 불필요)
- `narrative_task` (c_rag 두 번째 호출)
- `narrative_data` 슬롯

**변경**:
```python
# 이전: 정량/정성 분기
if dp_type_check["is_quantitative"]:
    dp_rag_task = ...
else:
    narrative_task = c_rag(narrative_query=dp_description)

# 이후: 통합
if user_input.get("dp_id"):
    dp_rag_task = ...  # 정량/정성 모두 처리
```

### 3. c_rag 단순화

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/c_rag/agent.py`

**제거**:
- `narrative_query` 파라미터
- `_query_sr_body`의 `narrative_query` 우선 로직

**변경**:
```python
# 이전
search_text = narrative_query if narrative_query else category

# 이후
search_text = category  # 항상 카테고리 기반
```

### 4. WorkflowState 정리

**파일**: `backend/domain/v1/ifrs_agent/models/langgraph/state.py`

```python
# 제거
narrative_data: Dict[str, Any]

# 주석 수정
fact_data: Dict[str, Any]  # dp_rag 결과 (정량: 실데이터, 정성: DP 기준·설명)
```

### 5. API router 정리

**파일**: `backend/api/v1/ifrs_agent/router.py`

```python
# 제거
"narrative_sr_pages": [...],
"narrative_data": {...},

# 유지
"sr_pages": [...],  # c_rag (카테고리)
"sr_data": {...},
"fact_data": {...},  # dp_rag (정량 또는 정성)
```

### 6. gen_node 스텁 수정

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/stubs.py`

```python
# 이전: narrative_data 별도 처리
elif narrative_data:
    body_text = narrative_data.get("2024", {}).get("sr_body")
    text_parts.append(f"[정성 DP 서술] {body_text[:200]}...")

# 이후: fact_data 통합 처리
elif fact_data and fact_data.get("dp_metadata"):
    # 정성 DP: value 없음, description + rulebook 기반
    description = dp_meta.get("description")
    rulebook_content = rulebook.get("rulebook_content")
    text_parts.append(f"[정성 DP] {dp_name}")
    text_parts.append(f"요구사항: {description[:100]}...")
    text_parts.append(f"기준: {rulebook_content[:100]}...")
```

### 7. 테스트 수정

**파일**: `backend/domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py`

- `test_qualitative_dp_routing_ucm`: 정성 DP는 `dp_rag`가 통합 처리 (별도 라우팅 체크 불필요)
- `test_parallel_collect_with_qualitative_dp`: `narrative_data` → `fact_data` (value=None, dp_metadata)
- `test_gen_node_with_narrative_data` → `test_gen_node_with_qualitative_dp`: `fact_data`로 정성 처리

---

## 데이터 흐름 비교

### 이전 (잘못된 설계)

```
정성 DP 요청 (category="거버넌스", dp_id="인센티브 여부")
  ↓
_parallel_collect:
  1. c_rag(category="거버넌스") → ref_data (거버넌스 관련 SR 본문)
  2. c_rag(narrative_query="인센티브 여부·방법") → narrative_data (인센티브 관련 SR 본문)
  3. dp_rag 생략 → fact_data = {}
  ↓
gen_node:
  - ref_data: 거버넌스 개요
  - narrative_data: 인센티브 상세 ← 중복이고 혼란스러움
  - fact_data: 없음 ← DP 기준이 없음!
```

### 이후 (올바른 설계)

```
정성 DP 요청 (category="거버넌스", dp_id="인센티브 여부")
  ↓
_parallel_collect:
  1. c_rag(category="거버넌스") → ref_data (거버넌스 관련 SR 본문)
  2. dp_rag(dp_id="인센티브 여부") → fact_data:
     - value: None (정성 DP는 수치 없음)
     - dp_metadata: {name_ko, description, dp_type}
     - rulebook: {rulebook_content, disclosure_requirement}
  ↓
gen_node:
  - ref_data: 거버넌스 개요 (카테고리 맥락)
  - fact_data: DP 요구사항 + 기준 (무엇을 써야 하는지)
  → LLM이 rulebook 기준에 맞춰 문단 생성
```

---

## 핵심 개선

1. **역할 명확화**:
   - `c_rag`: SR 본문 참조 (카테고리 기반, 모든 DP 공통)
   - `dp_rag`: DP 기준·데이터 (정량: value, 정성: description + rulebook)

2. **중복 제거**:
   - SR 본문 검색은 1회만 (`c_rag`, 카테고리 기반)
   - DP description으로 SR 재검색 제거

3. **논리 정합성**:
   - 정성 DP에 필요한 건 "DP 요구사항·기준"
   - `dp_rag`가 rulebook을 제공 → gen_node가 기준에 맞춰 생성

4. **코드 단순화**:
   - `narrative_data` 슬롯 제거
   - `_check_dp_type_for_routing` 불필요
   - 정량/정성 분기 제거

---

## 영향 받은 파일

| 파일 | 변경 내용 |
|------|----------|
| `dp_rag/agent.py` | 정성 DP 처리 로직 추가 (dp_type 체크, value=None 반환) |
| `orchestrator/orchestrator.py` | narrative_data 제거, dp_rag 통합 라우팅 |
| `c_rag/agent.py` | narrative_query 파라미터 제거 |
| `langgraph/state.py` | narrative_data 필드 제거 |
| `langgraph/workflow.py` | narrative_data 상태 업데이트 제거 |
| `api/router.py` | narrative_data/narrative_sr_pages 제거 |
| `stubs.py` | gen_node 정성 DP 처리 로직 수정 |
| `tests/test_orchestrator_dp_routing_integration.py` | 테스트 시나리오 수정 |

---

## 다음 단계 (선택)

1. **정성 DP 전용 폼 답변 테이블** (`qualitative_dp_responses`):
   - SR 본문에 없는 정보를 사용자가 직접 입력
   - `dp_rag`가 조회해서 `fact_data`에 포함

2. **gen_node 실제 구현**:
   - 정량: `fact_data.value` + `rulebook` → 수치 기반 문단
   - 정성: `fact_data.description` + `rulebook` → 요구사항 기반 문단

3. **validator_node 실제 구현**:
   - 정량: 수치 검증 (범위, 단위)
   - 정성: 요구사항 충족 여부 (LLM 판단)

---

## 요약

- **제거**: `narrative_data`, `narrative_query`, 정량/정성 분기 로직
- **통합**: 정성 DP도 `dp_rag`가 처리 (`fact_data`에 description + rulebook)
- **명확화**: `c_rag` (SR 참조) vs `dp_rag` (DP 기준·데이터)
- **결과**: 논리적 일관성 확보, 코드 단순화, 중복 제거

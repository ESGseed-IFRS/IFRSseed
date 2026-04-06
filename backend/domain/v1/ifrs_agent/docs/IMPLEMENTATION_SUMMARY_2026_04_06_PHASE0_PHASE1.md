# Phase 0 & Phase 1 구현 요약

> 구현일: 2026-04-06  
> 관련 설계: `PHASE3_FLEXIBLE_INPUT_DESIGN.md`

---

## 1. 구현 범위

### Phase 0: 프롬프트 해석
- 사용자 자유 프롬프트 → `search_intent`, `content_focus`, `ref_pages` 추출
- 정규식 기반 페이지 번호 추출 (전년/전전년)
- Gemini 2.5 Flash LLM 기반 JSON 해석
- 폴백 휴리스틱 로직

### Phase 1: 다중 DP 병렬 수집
- `dp_ids: List[str]` 지원 (1개 이상)
- 각 DP별 `dp_rag` 병렬 호출
- `fact_data_by_dp: Dict[str, Dict]` 구조로 병합
- `gen_input`에 `dp_data_list` 전달

### Phase 1.5: DP 계층 검증
- `child_dps`, `parent_indicator` 필드 노출
- 상위 DP 감지 시 `needs_dp_selection` 응답
- 사용자에게 하위 DP 선택 요청

---

## 2. 변경 파일 목록

### 2.1 신규 파일
- `backend/domain/v1/ifrs_agent/hub/orchestrator/prompt_interpretation.py`
  - `extract_ref_pages_from_text()`: 정규식 페이지 추출
  - `interpret_prompt_with_gemini()`: LLM 해석
  - `heuristic_interpretation()`: 폴백 로직

### 2.2 수정 파일

#### Orchestrator
- `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`
  - `_interpret_user_prompt()`: Phase 0 실행
  - `_parallel_collect()`: 다중 DP 병렬 호출
  - `_merge_and_filter_data()`: `fact_data_by_dp` 처리
  - `_build_gen_input()`: `dp_data_list` 구성
  - `_validate_dp_hierarchy()`: Phase 1.5 검증 (신규)
  - `_create_new_report()`: Phase 1.5 검증 호출

#### State
- `backend/domain/v1/ifrs_agent/models/langgraph/state.py`
  - `fact_data_by_dp: Dict[str, Dict[str, Any]]` 추가
  - `prompt_interpretation: Dict[str, Any]` 추가

#### c_rag
- `backend/domain/v1/ifrs_agent/spokes/agents/c_rag/agent.py`
  - `ref_pages` 직접 조회 모드 추가
  - `search_intent` 임베딩 결합
  - `content_focus` LLM 재선택 반영

#### gen_node
- `backend/domain/v1/ifrs_agent/spokes/agents/gen_node/prompts.py`
  - `_build_latest_data_section()`: `dp_data_list` 루프 처리
  - `_build_requirements_section()`: 다중 DP rulebook/ucm 처리

#### Tools
- `backend/domain/shared/tool/ifrs_agent/database/dp_query.py`
  - `query_dp_metadata()`: `child_dps`, `parent_indicator` 필드 노출
- `backend/domain/shared/tool/ifrs_agent/database/sr_body_context_query.py`
  - `query_sr_body_by_page()`: 페이지 직접 조회 (Phase 0에서 이미 구현됨)

#### API
- `backend/api/v1/ifrs_agent/router.py`
  - `CreateReportRequest`: `prompt`, `ref_pages`, `dp_ids` 필드 추가
  - `WorkflowResponse`: `prompt_interpretation`, `dp_selection_required` 필드 추가

---

## 3. 주요 데이터 흐름

### 3.1 Phase 0 (프롬프트 해석)
```
사용자 입력 (prompt, ref_pages)
  ↓
orchestrator._interpret_user_prompt()
  ↓
prompt_interpretation.py
  ├─ extract_ref_pages_from_text() → 정규식 추출
  ├─ merge_ref_pages() → API ref_pages와 병합
  └─ interpret_prompt_with_gemini() → LLM 해석
  ↓
{
  "search_intent": str,
  "content_focus": str,
  "ref_pages": {"2024": 89, "2023": 75},
  "dp_validation_needed": bool
}
  ↓
user_input에 병합
```

### 3.2 Phase 1 (다중 DP 수집)
```
orchestrator._parallel_collect(user_input)
  ↓
dp_ids = ["GRI2-11", "IFRS1-25-a", ...]
  ↓
asyncio.gather([
  dp_rag.collect(dp_id="GRI2-11"),
  dp_rag.collect(dp_id="IFRS1-25-a"),
  ...
])
  ↓
fact_data_by_dp = {
  "GRI2-11": {...},
  "IFRS1-25-a": {...}
}
  ↓
orchestrator._build_gen_input()
  ↓
gen_input = {
  "dp_data_list": [
    {"dp_id": "GRI2-11", ...},
    {"dp_id": "IFRS1-25-a", ...}
  ]
}
  ↓
gen_node.generate(gen_input)
```

### 3.3 Phase 1.5 (DP 계층 검증)
```
orchestrator._validate_dp_hierarchy(fact_data_by_dp)
  ↓
각 DP의 dp_metadata 확인
  ├─ child_dps가 있는가?
  ├─ parent_indicator가 None인가?
  └─ description에 "하위" 키워드가 있는가?
  ↓
problematic_dps = [
  {
    "dp_id": "ESRS2-MDR-P",
    "child_dps": ["ESRS2-MDR-P-63", ...],
    "reason": "하위 DP 5개 존재"
  }
]
  ↓
status: "needs_dp_selection"
dp_selection_required: problematic_dps
```

---

## 4. API 사용 예시

### 4.1 Phase 0: 프롬프트 + 페이지 지정
```json
POST /ifrs-agent/reports/create
{
  "company_id": "c001",
  "category": "재생에너지",
  "prompt": "전년 89페이지, 전전년 75페이지 참고하여 재생에너지 사용량 작성",
  "max_retries": 3
}
```

**응답:**
```json
{
  "workflow_id": "...",
  "status": "success",
  "generated_text": "...",
  "prompt_interpretation": {
    "search_intent": "재생에너지 사용량",
    "content_focus": "",
    "ref_pages": {"2024": 89, "2023": 75},
    "dp_validation_needed": false
  }
}
```

### 4.2 Phase 1: 다중 DP
```json
POST /ifrs-agent/reports/create
{
  "company_id": "c001",
  "category": "거버넌스",
  "dp_ids": ["GRI2-11", "GRI2-12", "GRI2-13"],
  "max_retries": 3
}
```

**응답:**
```json
{
  "workflow_id": "...",
  "status": "success",
  "generated_text": "...",
  "gen_input": {
    "dp_data_list": [
      {"dp_id": "GRI2-11", ...},
      {"dp_id": "GRI2-12", ...},
      {"dp_id": "GRI2-13", ...}
    ]
  }
}
```

### 4.3 Phase 1.5: DP 계층 검증 실패
```json
POST /ifrs-agent/reports/create
{
  "company_id": "c001",
  "category": "정책",
  "dp_ids": ["ESRS2-MDR-P"],
  "max_retries": 3
}
```

**응답:**
```json
{
  "workflow_id": "...",
  "status": "needs_dp_selection",
  "error": "상위 DP가 감지되었습니다. 하위 DP를 선택해주세요.",
  "dp_selection_required": [
    {
      "dp_id": "ESRS2-MDR-P",
      "name_ko": "MDR-P: 정책",
      "description": "문단 63~65 하위 DP 포함...",
      "child_dps": ["ESRS2-MDR-P-63", "ESRS2-MDR-P-64", "ESRS2-MDR-P-65"],
      "parent_indicator": null,
      "reason": "하위 DP 3개 존재 (description에 하위 항목 언급)"
    }
  ]
}
```

---

## 5. 테스트 체크리스트

### Phase 0
- [ ] `prompt`에 "전년 89p" 입력 → `ref_pages["2024"] = 89`
- [ ] `prompt`에 "전전년 75페이지" 입력 → `ref_pages["2023"] = 75`
- [ ] `ref_pages` API 파라미터와 프롬프트 병합 확인
- [ ] Gemini 해석 JSON 파싱 확인
- [ ] 폴백 휴리스틱 동작 확인

### Phase 1
- [ ] `dp_ids` 2개 이상 입력 → `fact_data_by_dp` 2개 항목
- [ ] `gen_input.dp_data_list` 길이 확인
- [ ] gen_node 프롬프트에 다중 DP 섹션 생성 확인
- [ ] 하위 호환: `dp_id` 단일 입력 → `dp_ids`로 변환

### Phase 1.5
- [ ] `child_dps`가 있는 DP 입력 → `needs_dp_selection` 응답
- [ ] `dp_selection_required` 배열에 `child_dps` 포함 확인
- [ ] UCM은 검증 제외 확인
- [ ] 하위 DP 입력 시 정상 진행 확인

---

## 6. 알려진 제약사항

### Phase 0
- `dp_validation_needed` 값은 생성되지만 아직 완전히 활용되지 않음 (Phase 1.5에서 부분 활용)
- 프롬프트 정규식은 "전년", "전전년" 한국어 패턴만 지원

### Phase 1
- 레거시 `fact_data` 필드는 유지 (하위 호환)
- 다중 DP 시 LLM 데이터 선택은 첫 번째 DP 기준

### Phase 1.5
- DP 계층 검증은 `child_dps` 존재 여부만 체크
- description 키워드 매칭은 단순 문자열 검색
- UCM 계층 구조는 별도 처리 필요

---

## 7. 다음 단계 (미구현)

### Phase 2: 고급 프롬프트 기능
- toc_path 기반 목차 탐색
- subtitle 매칭
- 다중 페이지 범위 지정

### Phase 3: 완전한 DP 계층 처리
- 자동 하위 DP 추천
- DP 그룹 일괄 처리
- UCM 계층 통합

---

## 8. 참고 문서

- 설계: `PHASE3_FLEXIBLE_INPUT_DESIGN.md`
- Phase 2 구현: `IMPLEMENTATION_SUMMARY_2026_04_06_PHASE2.md`
- 버그픽스: `BUGFIX_2026_04_06_NONE_HANDLING.md`

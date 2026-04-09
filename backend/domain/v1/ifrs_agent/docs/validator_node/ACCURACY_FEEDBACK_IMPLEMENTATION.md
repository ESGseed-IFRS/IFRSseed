# validator_node 정확도·피드백 확장 — 구현서

**목적**: [ACCURACY_FEEDBACK_DESIGN.md](./ACCURACY_FEEDBACK_DESIGN.md)의 설계를 코드에 옮기기 위한 **파일·함수·데이터 흐름·테스트·롤아웃**을 구체화한다.  
**전제**: 현행 구현은 `spokes/agents/validator_node/` (`agent.py`, `rules.py`, `llm_validate.py`, `prompts.py`, `payload.py`).

---

## 1. 범위와 하위 호환

### 1.1 반드시 유지할 계약

- 입력: 기존 `payload` 키와 동일.  
- 출력 최소 키: **`is_valid`**, **`errors`** (리스트), **`warnings`** (리스트, 없으면 `[]`).  
- 오케스트레이터: `hub/orchestrator/orchestrator.py` — `feedback = validation.get("errors", [])` **변경 금지**(동작 유지).

### 1.2 추가 허용 키(클라이언트 가법)

| 키 | 설명 |
|----|------|
| `schema_version` | `"validator_ui_v1"` 권장 |
| `accuracy` | 설계서 §4.2 |
| `feedback_items` | 설계서 §4.3 |
| `rationale` | 설계서 §4.4 |

### 1.3 기능 플래그(권장)

- `payload.runtime_config["validator_ui_extended"]` 또는 환경변수 `VALIDATOR_UI_EXTENDED=1`  
- **false**일 때: 기존과 동일한 키만 채우거나, 확장 필드를 **최소화**(점수 생략 가능).  
- 기본값 정책은 팀 결정(프로덕션에서는 단계적 활성화 권장).

---

## 2. 타입·데이터 구조(권장)

### 2.1 내부: `RuleSignals` (신규, 예: `rules.py` 또는 `signals.py`)

규칙 단계가 LLM 없이 채울 수 있는 차원 점수·메모.

```python
# 의미적 예시 — 실제 필드명은 팀 컨벤션에 맞출 것
@dataclass
class RuleSignals:
    dimension_scores: Dict[str, int]  # dimension_id -> 0-100
    dimension_notes_ko: Dict[str, str]
    checks: List[Dict[str, Any]]  # 선택: { "id": "non_empty", "passed": True }
```

**매핑 예시**:

- `format_completeness`: `rule_non_empty` + `rule_min_length` 통과 시 100, 실패 시 0.  
- `numeric_presence`: `rule_numeric_consistency_light` 통과 시 100, 실패 시 0 (create만).  
- `dp_availability`: `rule_fact_dp_warnings`가 비어 있으면 100, 경고 있으면 80~90(정책 상수).

### 2.2 LLM 응답 JSON (확장)

`parse_validator_json`이 파싱하는 객체에 다음을 **선택적으로** 포함한다.

```json
{
  "is_valid": true,
  "errors": [],
  "rationale_ko": "한 줄 요약",
  "accuracy_dimensions": {
    "fact_consistency": { "score": 85, "notes_ko": "..." },
    "greenwashing_risk": { "score": 70, "notes_ko": "..." }
  },
  "feedback_items": [
    {
      "severity": "suggestion",
      "dimension_id": "greenwashing_risk",
      "issue_ko": "...",
      "suggestion_ko": "...",
      "quote": null
    }
  ]
}
```

**하위 호환**: 위 키가 없으면 기존 `llm_result_to_rule_result` 동작과 동일하게 `errors`만 반영.

---

## 3. 파일별 변경 지침

### 3.1 `prompts.py`

- `SYSTEM_PROMPT`에 다음을 명시:
  - 출력 JSON에 **`accuracy_dimensions`**, **`feedback_items`**, **`rationale_ko`** 허용(선택).
  - **`is_valid: false`일 때** `errors`는 기존 규칙(한국어, 구체적, 최대 5개).
  - **`is_valid: true`일 때** `errors: []`이며, **`feedback_items`에는 severity `suggestion`만**(선택) — 과도한 실패 유도 방지.
- `temperature`는 기존 `0.2` 유지 (`llm_validate.py`).

### 3.2 `llm_validate.py`

1. **`llm_result_to_rule_result` 확장** → `ExtendedLlmResult` 같은 튜플/데이터클래스로 분리하거나, `Dict`로 통합 반환:
   - `RuleResult(errors, warnings)`  
   - `llm_accuracy_partial` (dict | None)  
   - `llm_feedback_items` (list | None)  
   - `rationale_ko` (str | None)
2. **`parse_validator_json` 실패 시**: 확장 필드 없이 기존 오류 메시지 유지.
3. **API 키 없음 / LLM 스킵**: `RuleSignals`만으로 LLM 차원은 **중립 점수**(예: 70) 또는 **null** 처리 — 설계서의 `is_valid` 상한·하한과 함께 문서화.

### 3.3 `rules.py`

1. `run_rules` 반환을 `RuleResult`만이 아니라 **`RuleSignals`를 함께** 반환하도록 시그니처 변경하거나, `run_rules` 래퍼 `run_rules_with_signals` 추가.
2. 기존 메시지 문자열은 **그대로** `errors`/`warnings`에 유지.

### 3.4 `agent.py` — `ValidatorNodeAgent.validate`

병합 순서(권장):

1. `run_rules` → `rule_res`, `signals`.
2. 규칙 `errors`가 있고 **정책상 LLM 스킵**이면 LLM 호출 생략 → LLM 차원은 폴백.
3. `run_llm_validate` → LLM 확장 결과.
4. **`merge_accuracy(rule_signals, llm_partial, is_valid)`** 로 `accuracy` 객체 생성.
5. **`build_feedback_items`**:  
   - 규칙 실패 메시지를 `severity: error`, `source: rules` 항목으로 **선택적** 변환(중복 완화는 옵션).  
   - LLM `feedback_items` 병합.
6. **`rationale`**: `rule_summary_ko`는 signals에서 생성, `llm_summary_ko`는 `rationale_ko`.
7. 최종 반환 dict 조립.

**`is_valid` 결정**: 기존과 동일 — 규칙 `errors` + LLM `errors` 병합 후 빈 리스트 여부.

### 3.5 `__init__.py`

- 공개 심볼에 변경 없음(핸들러 팩토리 동일).

---

## 4. 점수 병합 알고리즘(권장 의사코드)

```text
함수 compute_overall(signals, llm_dims, is_valid):
    각 dimension_id에 대해:
        규칙 담당 차원은 signals.score 사용
        LLM 담당 차원은 llm_dims.score 사용 (없으면 폴백 70 또는 null 제외)
    가중치 합으로 overall.score 계산 (0-100 반올림)

    만약 is_valid == false:
        overall.score = min(overall.score, 59)   # 상한 정책
    만약 is_valid == true:
        overall.score = max(overall.score, 60)     # 하한 정책 — 팀 조정 가능

    overall.band = map_score_to_band(overall.score)
```

가중치 상수는 **`validator_node` 모듈 내 단일 테이블**로 관리(테스트에서 고정).

---

## 5. `errors`와 `feedback_items` 중복 정책

| 옵션 | 장점 | 단점 |
|------|------|------|
| A. 중복 허용 | 구현 빠름, gen은 `errors`만 사용 | UI에서 같은 말 두 번 |
| B. `errors`는 유지, `feedback_items`는 LLM 구조화만 | gen 안전 | 규칙 실패는 구조화 약함 |
| C. 규칙 실패도 `feedback_items`에 넣고 `errors`는 동일 문장으로 복제 | 일관 | 유지보수 비용 |

**권장**: 1차는 **A 또는 B** — 구현 단순. 프론트는 `feedback_items` 우선 표시, 없으면 `errors` 폴백.

---

## 6. 테스트 케이스(필수)

| ID | 시나리오 | 기대 |
|----|----------|------|
| T1 | 규칙만 실패(짧은 문단), LLM 스킵 | `is_valid` false, `errors` 비어 있지 않음, 확장 필드가 있으면 규칙 기반 점수만 반영 |
| T2 | 규칙 통과 + LLM 통과 | `is_valid` true, `accuracy.overall.score` ≥ 하한 |
| T3 | LLM JSON에 확장 키 없음 | 파싱 성공 시 기존과 동일 동작, 확장 필드 null/생략 |
| T4 | LLM JSON 파싱 실패 | 기존 오류 문자열, `is_valid` false |
| T5 | `validator_ui_extended=false` | 확장 필드 미포함 또는 최소(회귀 방지) |

기존 `tests/test_validator_node.py`에 케이스 추가.

---

## 7. 오케스트레이터·API 수정 필요 여부

- **필수 아님**: `state["validation"]`에 추가 키가 실리면 **자동 전달**되는 구조라면 프론트만 소비.  
- **권장**: 워크플로 이벤트(`workflow_events`)의 `validator_done` `safe_summary`에 **`overall.score`만** 넣어 대시보드 관측 가능(PII 없이).

---

## 8. 문서 동기화

구현 완료 후 다음을 갱신한다.

- [LOGIC_SPEC.md](./LOGIC_SPEC.md) §3 반환 스키마 — 확장 필드 추가.  
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §2.3 — `validation` 객체 설명 한 단락 추가.

---

## 9. 구현 체크리스트

- [ ] `RuleSignals`(또는 동등) 도입 및 `run_rules` 연동  
- [ ] `prompts.py` 확장 스키마 반영  
- [ ] `llm_validate.py` 파싱·병합 확장  
- [ ] `agent.py` 최종 응답 조립 + 플래그  
- [ ] 단위 테스트 T1–T5  
- [ ] `LOGIC_SPEC` / `IMPLEMENTATION_GUIDE` 보조 업데이트(선택과 병행)

---

## 10. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-09 | 초안 작성 |

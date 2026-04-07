# validator_node 구현 가이드

이 문서는 코드베이스에 이미 존재하는 **오케스트레이터·인프라 계약**에 맞춰 `validator_node`를 **단계적으로** 구현할 때의 기준, 흔한 실수, **로직을 바꾸기 쉬운 구조**를 정리한다.

---

## 1. 목표와 역할

- **입력**: 생성 문단(`generated_text`) + 수집된 사실 데이터(`fact_data`, `fact_data_by_dp`) + 주제(`category`) + (`_agent_payload`로 항상 붙는) `runtime_config`.
- **출력**: 최소 **`is_valid: bool`**, **`errors: List[str]`**. 실패 시 `errors`는 다음 `gen_node` 호출의 **`feedback`**으로 그대로 전달된다.
- **역할**: 규칙·LLM 등으로 품질·일관성·과장(그린워싱) 의심을 판단하고, 재시도 시 gen이 고칠 수 있도록 **구체적인 수정 지시**를 `errors`에 담는 것이 이상적이다.

---

## 2. 현재 코드베이스 계약 (반드시 준수)

### 2.1 호출 경로

- **등록**: `hub/bootstrap.py` — `infra.agent_registry.register("validator_node", ...)`
- **호출**: `Orchestrator._generation_validation_loop` 및 `_refine_existing_report`에서 `infra.call_agent("validator_node", "validate", payload)`  
- **중요**: `InfraLayer.call_agent`는 `action` 문자열(`"validate"`)을 **핸들러에 넘기지 않는다**. 레지스트리에 등록된 것은 **`async def handler(payload: Dict) -> Dict` 단일 진입점**뿐이다. (`spokes/infra/infra_layer.py`)

즉, 구현체는 **`(agent_name, action)` 분기 없이** `payload`만 처리하면 된다.

### 2.2 Create 경로(Phase 3 루프) 페이로드

`orchestrator.py`의 `_generation_validation_loop` 기준(의미 요약):

| 필드 | 출처 |
|------|------|
| `generated_text` | 직전 `gen_node` 결과 |
| `fact_data` | `state["fact_data"]` (레거시 단일/병합) |
| `fact_data_by_dp` | `state["fact_data_by_dp"]` — **다중 DP** |
| `category` | `state["user_input"]["category"]` |
| `runtime_config` | `_agent_payload`가 병합 (`models/runtime_config.py`) |

`runtime_config`에는 `gemini_api_key`, `gen_node_model` 등이 포함될 수 있다. **로그에 payload 전체를 찍지 말 것.**

### 2.3 Create 경로에서 기대하는 응답

오케스트레이터가 사용하는 키:

- **`is_valid`**: `True`면 루프 종료(성공).
- **`is_valid`가 falsy**: `errors`를 읽어 `state["feedback"]`에 넣고 `status`를 `"retry"`로 두고 **다음 루프에서 gen 재호출**.

```text
validation.get("errors", [])  →  state["feedback"]  →  gen_node payload["feedback"]
```

### 2.4 Refine 경로 차이

`_refine_existing_report`에서는 validator가 **필수 통과가 아니다**. 현재 오케스트레이터가 넘기는 페이로드는 **Create보다 적다**:

| 필드 | Refine 경로 |
|------|-------------|
| `generated_text` | refine된 텍스트 |
| `fact_data` | `existing_page["state"].get("fact_data", {})` |
| `category` | 기존 페이지 state의 `user_input.category` |
| `fact_data_by_dp` | **전달되지 않음**(현행 코드) |

반환은 `validation` 전체가 클라이언트에 실리고, `is_valid`가 거짓이면 **`warnings` 키**를 `validation.get("warnings", [])`로 채우는 형태를 기대한다(`orchestrator.py` refine 분기).

**실구현 시**: 동일 핸들러에서 `fact_data_by_dp`가 비어 있으면 refine으로 추정해 규칙을 완화하거나, 이후 오케스트레이터에서 `fact_data_by_dp`·`mode: "refine"`을 추가해 **명시적 분기**하는 편이 덜 헷갈린다.

### 2.5 LangGraph 상태와의 정렬

`models/langgraph/state.py`의 `WorkflowState`에 `validation`, `feedback`이 정의되어 있다. 반환 스키마를 바꿀 때는 **오케스트레이터·API 응답**까지 함께 검토한다.

### 2.6 스텁(현행 동작)

`spokes/agents/stubs.py`의 `validator_node_stub`은 항상 `{"is_valid": True, "errors": []}`를 반환한다. 실구현 교체 시 **동일 키를 유지**하면 나머지 파이프라인을 건드리지 않아도 된다.

---

## 3. 권장 패키지 구조 (gen_node와 정렬)

유지보수와 테스트를 위해 `gen_node`와 같은 패턴을 권장한다.

```text
spokes/agents/validator_node/
  __init__.py          # make_validator_node_handler export
  agent.py             # ValidatorNodeAgent + handler factory
  prompts.py           # LLM 단계 도입 시 (선택)
  checks/              # (선택) 규칙 모듈 분리 — 아래 "유연한 로직" 참고
```

- **`make_validator_node_handler(infra)`**: `bootstrap`에서 `register("validator_node", make_validator_node_handler(infra))` 형태.  
  당장 툴 호출이 없어도 `infra`를 받아 두면 이후 DB·툴 연동 시 시그니처 변경을 줄일 수 있다.

---

## 4. 단계별 구현 로드맵

아래 순서는 **의존성이 적은 것부터** 쌓아, 각 단계에서 동작·테스트가 가능하도록 한다.

### Phase A — 스캐폴드와 계약 고정

1. `validator_node` 패키지 추가, `make_validator_node_handler`가 스텁과 **동일 반환 형태**를 유지하도록 연결.
2. `bootstrap.py`에서 스텁 대신 새 핸들러 등록(기능은 스텁과 동일하게 시작 가능).
3. 단위 테스트: 고정 `payload` → `is_valid`/`errors` 타입·키 검증.

**실수 방지**: 반환에 `error`만 넣고 `is_valid`를 빼면 루프가 **실패로 오인**할 수 있다. 항상 **`is_valid`를 명시**한다.

### Phase B — 규칙 기반 검증(무 LLM)

목적: 비용·지연 없이 명백한 오류를 걸러내고, LLM 실패 시에도 **최소 안전망**을 둔다.

예시 후보(프로덕트 정책에 맞게 조정):

- `generated_text` 공백/너무 짧음.
- `fact_data` / `fact_data_by_dp`에 **수치·단위**가 있는데 본문과 **문자열 수준으로 충돌**하는 패턴(보수적으로만).
- 금지 표현 리스트(내부 정책) 등.

**실수 방지**:

- `fact_data_by_dp`는 **dict of dict**이다. 단일 `fact_data`만 보면 다중 DP 시나리오를 놓친다.
- 규칙이 과하면 항상 실패해 **재시도 3회 소진**까지 간다. Phase B는 **명백한 케이스**에 한정하는 것이 안전하다.

### Phase C — LLM 기반 검증(선택, 문서·정책 정합)

`runtime_config["gemini_api_key"]` 사용, 모델은 초기에는 `gen_node_model`과 동일해도 되고, 이후 `settings`에 `validator_model` 같은 필드를 두고 `AgentRuntimeConfig`에 추가하는 방식으로 분리 가능.

- 프롬프트: `generated_text`, 요약된 `fact_data`/`fact_data_by_dp`, `category`를 넣고, 출력은 **구조화(JSON)** 로 강제하는 편이 `errors` 파싱에 유리하다.
- **실수 방지**: LLM 응답 파싱 실패 시 — 전체 파이프라인을 죽이지 말고, `is_valid: False`, `errors: ["validator LLM parse error: ..."]` 또는 정책에 따라 **규칙만 통과시키는 폴백**을 문서화한다.

### Phase D — Refine·경고·메타데이터

- refine용 `warnings`, 디버깅용 `checks` / `rationale` 등은 **필수 키가 아니므로** 오케스트레이터가 읽는 부분만 맞추면 된다.
- Create 루프는 현재 **`warnings` 필수 의존은 없음**(refine 쪽에서 일부 사용).

---

## 5. 재시도 루프와 gen_node 연동(주의)

오케스트레이터는 `validation.errors` → `state["feedback"]` → 다음 `gen_node` 호출 시 **`payload["feedback"]`**으로 넘긴다.

**현재 코드베이스 확인**: `gen_node`의 `resolve_gen_input_from_payload`는 `feedback`을 **gen_input에서 제외**하는 예약 키로만 쓰고 있다. **프롬프트에 validator 피드백을 반영하는 로직은 prompts 쪽에 반드시 추가**해야, 재시도가 의미 있다.  
validator만 고치고 gen이 피드백을 읽지 않으면 **루프가 같은 결과를 반복**할 수 있다.

권장:

- validator 구현과 **병행 또는 직후**에 `gen_node`에 “이전 검증 피드백” 섹션을 추가하는 작업을 같은 마일스톤에 둔다.

---

## 6. 유연하게 로직을 바꾸기 위한 설계 팁

### 6.1 검증 단계를 파이프라인으로 쪼개기

예: `[구조 검사] → [수치 일치(규칙)] → [LLM 품질]` 순. 각 단계는 `(context) -> ValidationStepResult` 형태로 두고, **중간에 끊을지**(`is_valid` + `errors`)만 통일한다.

- 새 규칙 추가 시 **한 파일/한 클래스**만 수정.
- LLM on/off는 **설정 플래그**로 (`Settings` + env) 제어.

### 6.2 설정으로 하드코딩 분리

- 최소 길이, 재시도 시에만 LLM 호출, 그린워싱 키워드 목록 등은 코드 상수보다 **설정**이면 운영 중 조정이 쉽다.

### 6.3 타임아웃

`InfraLayer`의 `default_timeout`(`ifrs_infra_timeout_sec` 등) 안에서 끝나야 한다. LLM이 길면 **validator 전용 타임아웃**을 `call_agent(..., timeout=...)` 수준에서 조정하는 방안을 오케스트레이터와 합의한다(별도 변경이 필요할 수 있음).

### 6.4 로깅

- `generated_text` 일부만, **개인정보·전체 fact**는 마스킹 또는 길이 제한.
- API 키는 절대 로그에 남기지 않는다.

---

## 7. 구현 전 체크리스트

- [ ] 반환 dict에 **`is_valid`**, **`errors`**(리스트) 포함.
- [ ] Create·Refine 각각에서 오케스트레이터가 넘기는 **키 이름**과 맞춤.
- [ ] `fact_data`와 **`fact_data_by_dp`** 모두 고려(다중 DP).
- [ ] `feedback` → gen 프롬프트 반영 여부 확인(재시도 효과).
- [ ] 스텁 제거 후 **bootstrap 등록 한 곳**만 바꿔 교체 가능한지 확인.
- [ ] 단위 테스트(규칙) + 통합 테스트(스텁 LLM 또는 mock).

---

## 8. 참고 파일 (경로)

| 내용 | 파일 |
|------|------|
| Phase 3 루프·페이로드 | `hub/orchestrator/orchestrator.py` (`_generation_validation_loop`, `_refine_existing_report`) |
| 런타임 설정 슬라이스 | `models/runtime_config.py` |
| 워크플로 상태 | `models/langgraph/state.py` |
| 에이전트 호출 규약 | `spokes/infra/infra_layer.py` |
| 스텁 | `spokes/agents/stubs.py` |
| gen 핸들러 패턴 | `spokes/agents/gen_node/agent.py` (`make_gen_node_handler`) |
| 에이전트 등록 | `hub/bootstrap.py` |

---

## 9. 문서 유지보수

오케스트레이터 페이로드나 반환 스키마가 바뀌면 **이 문서의 §2·§5·체크리스트**를 먼저 갱신한다. 구현 세부(프롬프트 문구)는 `validator_node` 패키지 내 주석·`prompts.py`에 두고, 본 문서는 **계약과 단계**에 집중하는 것이 좋다.

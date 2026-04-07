# validator_node 로직 구현서

이 문서는 [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)의 계약을 만족하면서, **파일·함수·처리 순서까지 바로 코딩에 옮길 수 있는 수준**으로 로직을 규정한다. 구현 시 본 문서의 **§8 반환 스키마**를 그대로 맞추면 오케스트레이터와 호환된다.

---

## 1. 패키지·파일 배치

아래 경로를 기준으로 생성한다.

| 경로 | 역할 |
|------|------|
| `spokes/agents/validator_node/__init__.py` | `make_validator_node_handler` export |
| `spokes/agents/validator_node/agent.py` | 핸들러 팩토리, `ValidatorNodeAgent.validate`, 파이프라인 조립 |
| `spokes/agents/validator_node/payload.py` | 페이로드 정규화·모드 판별(create/refine) |
| `spokes/agents/validator_node/rules.py` | 규칙 전용(무 LLM), `RuleResult` |
| `spokes/agents/validator_node/llm_validate.py` | (선택) Gemini 호출·JSON 파싱 |
| `spokes/agents/validator_node/prompts.py` | LLM 시스템/유저 프롬프트 템플릿 |

`bootstrap.py` 변경 한 줄:

```python
# from ...stubs import validator_node_stub
from backend.domain.v1.ifrs_agent.spokes.agents.validator_node import make_validator_node_handler

# infra.agent_registry.register("validator_node", validator_node_stub)
infra.agent_registry.register("validator_node", make_validator_node_handler(infra))
```

---

## 2. 데이터 계약 (입력)

핸들러는 **단일 인자** `payload: Dict[str, Any]`만 받는다.

### 2.1 필수로 사용할 키

| 키 | 타입 | 설명 |
|----|------|------|
| `generated_text` | `str` | 검증 대상 본문 |
| `category` | `str` | 사용자 주제/카테고리 |
| `fact_data` | `dict` | 대표 단일 DP 요약(`orchestrator`의 `_representative_fact_data` 등) |
| `fact_data_by_dp` | `dict` | `{ dp_id: fact_dict, ... }` — **Create 경로에서 주로 채워짐** |
| `runtime_config` | `dict` | `gemini_api_key`, `gen_node_model` 등 (`models/runtime_config.py` 참고) |

### 2.2 Refine 경로

`fact_data_by_dp`가 비어 있거나 없을 수 있다. 이 경우 `payload.py`에서 `ValidationMode.REFINE`으로 분류한다(아래 §4).

### 2.3 `fact_dict`에서 읽을 수 있는 필드 (dp_rag·오케스트레이터와 정합)

규칙 검증에서 쓸 **대표 필드**만 명시한다. 없으면 스킵.

- `value`, `unit` — 정량
- `error` — 해당 DP 조회 실패 시 문자열; **이 DP는 “근거로 삼지 말 것”** 처리
- `dp_metadata`: `name_ko`, `description`, `dp_type` 등
- `suitability_warning` — 있으면 LLM/규칙에 **경고 맥락**으로 포함

---

## 3. 출력(반환) 스키마 — 반드시 준수

```python
# 성공(통과)
{"is_valid": True, "errors": []}

# 실패(재시도 유도) — errors는 str 리스트, gen의 feedback으로 전달
{"is_valid": False, "errors": ["한국어로 구체적 수정 요청 1", "..."]}

# 선택(권장): refine·디버깅
{"is_valid": ..., "errors": [...], "warnings": [...]}  # warnings는 refine 응답에서 사용 가능
```

- **`is_valid` 키는 항상 포함.** 생략 시 오케스트레이터가 실패로 처리할 수 있음.
- **`errors`는 항상 리스트** (빈 리스트 허용).

---

## 4. 모드 판별 (`payload.py`)

다음 헬퍼를 구현한다.

```python
from enum import Enum

class ValidationMode(str, Enum):
    CREATE = "create"
    REFINE = "refine"

def resolve_validation_mode(payload: dict) -> ValidationMode:
    if payload.get("mode") == "refine":
        return ValidationMode.REFINE
    fdb = payload.get("fact_data_by_dp")
    if not fdb or not isinstance(fdb, dict) or len(fdb) == 0:
        return ValidationMode.REFINE
    return ValidationMode.CREATE
```

**주의**: 현행 오케스트레이터는 refine 시 `mode`를 넣지 않으므로, **`fact_data_by_dp` 공란**으로 refine을 추정한다. 나중에 오케스트레이터에 `"mode": "refine"`을 넣으면 우선한다.

---

## 5. 파이프라인 순서 (`agent.py`)

`ValidatorNodeAgent.validate(self, payload)`의 처리 순서를 고정한다.

1. **정규화**: `generated_text`를 `str`로, 공백만 있으면 `""`.
2. **모드**: `resolve_validation_mode(payload)`.
3. **규칙 단계** `run_rules(...)` — 항상 실행.
4. 규칙에서 **하드 실패**가 있으면 → LLM 생략 가능(설정에 따라).
5. **LLM 단계** `run_llm_validate(...)` — `runtime_config["gemini_api_key"]`가 비어 있으면 **스킵하고 규칙 결과만 반환**(또는 “키 없음”을 경고 1건으로 처리 — 팀 정책 선택).
6. **병합**: 규칙 `errors` + LLM `errors`를 합쳐 최종 `is_valid` 결정.

### 5.1 `is_valid` 결정 규칙(권장)

- 규칙 또는 LLM 중 **어느 한쪽이라도** `errors`가 비어 있지 않으면 `is_valid = False`.
- 둘 다 비어 있으면 `is_valid = True`.

---

## 6. 규칙 레이어 (`rules.py`)

### 6.1 결과 타입

```python
from dataclasses import dataclass
from typing import List

@dataclass
class RuleResult:
    errors: List[str]
```

### 6.2 함수 목록 (구현 순서)

아래를 **위에서 아래 순**으로 호출하고, `errors`를 누적한다.

| 함수명 | 입력 | 실패 시 `errors` 예시 |
|--------|------|-------------------------|
| `rule_non_empty_text(text: str)` | `generated_text` | `"생성 문단이 비어 있습니다. 제공된 데이터에 맞는 본문을 작성하세요."` |
| `rule_min_length(text: str, min_chars: int = 80)` | 설정 가능 | `"문단이 너무 짧습니다. …"` |
| `rule_fact_dp_errors(fact_data_by_dp: dict)` | 각 `fact.get("error")` | DP별로 **한 줄**: `"DP {dp_id} 데이터 조회에 실패했습니다. 해당 수치를 인용하지 마세요."` — *주의*: 이건 “본문이 잘못”이 아니라 **근거 부족 알림**에 가깝다. **너무 자주 실패를 유발하면** 이 규칙은 경고만 하거나 생략할 것. |
| `rule_numeric_consistency_light(text: str, fact_data: dict, fact_data_by_dp: dict)` | §6.3 | 아래 참고 |

**정책**: Phase 1 구현에서는 `rule_fact_dp_errors`를 **경고 전용**으로 두거나 생략하고, **비어 있음·최소 길이**만 강제해도 된다.

### 6.3 가벼운 수치 일치 (`rule_numeric_consistency_light`)

목적: 환각으로 **명백히 다른 숫자**를 쓴 경우만 잡는다(과도한 NLP는 피함).

알고리즘(권장):

1. `candidates: List[tuple[str, str]]` — `(표시용 라벨, 숫자 문자열)` 수집.
2. `fact_data`에서 `value`가 숫자형이거나 숫자만 추출 가능하면 후보에 추가.
3. `fact_data_by_dp`의 각 값에 대해 동일.
4. 생성문 `text`에서 **공백·쉼표 제거한 숫자 토큰**과 비교하기보다, 각 후보 `v`에 대해:
   - `v`를 정규화한 문자열 `n`이 `text`에 **부분 문자열로 존재**하는지 검사 (예: `1234567`, `1,234,567` 둘 다 시도).
5. 후보 수치가 여럿일 때, **하나도 본문에 안 나오면** 실패하지 않는다(“인용 안 함”은 허용).
6. 본문에 **다른 큰 숫자**가 팩트와 충돌하는 경우는 1차 버전에서 **스킵**(오탐 방지).

실패 예:

- 팩트에 `value=100`만 있는데 본문에 `100`과 `999`가 같이 있고 맥락상 배출량으로 읽히면… → 1차에서는 **스킵**해도 됨.

**최소 구현**: `value`가 int/float이면 `str(int(value))` / 소수 규칙 정한 문자열이 본문에 없으면 → `"제공된 데이터의 수치(예: {label}={value})가 본문에 반영되지 않았습니다. …"` 정도의 **소프트** 메시지는 재시도 품질에 도움. (이건 실패로 볼지 팀 정책.)

---

## 7. LLM 레이어 (`llm_validate.py` + `prompts.py`)

### 7.1 호출 조건

- `runtime_config.get("gemini_api_key")`가 비어 있으면 **LLM 스킵**, `RuleResult`만 반환.
- 모델 ID: `runtime_config.get("gen_node_model") or "gemini-2.5-pro"` (gen_node와 동일 기본값으로 맞춤).

### 7.2 입력 요약(토큰 절약)

LLM에 넣을 문자열을 **고정 템플릿**으로 만든다.

- `category`
- `generated_text` — 최대 길이 제한 (예: 12000자), 초과 시 `…(truncated)`
- `facts_summary` — `fact_data_by_dp`에서 각 DP마다 한 줄: `dp_id`, `name_ko`, `value`, `unit`, `error`(있으면)
- `representative_fact` — `fact_data` JSON을 2000자 이내로 직렬화(또는 주요 키만)

### 7.3 출력 형식 (모델에 강제)

모델 응답은 **JSON 한 덩어리만** 출력하도록 프롬프트에 명시한다.

```json
{
  "is_valid": true,
  "errors": [],
  "rationale_ko": "한 줄 요약"
}
```

실패 시:

```json
{
  "is_valid": false,
  "errors": [
    "구체적 수정 요청 1",
    "구체적 수정 요청 2"
  ],
  "rationale_ko": "..."
}
```

### 7.4 파싱·예외

- `json.loads` 실패 → 반환: `{"is_valid": False, "errors": ["validator LLM 응답 파싱 실패 — 재시도해 주세요."]}`  
  또는 정책상 **규칙만 통과시키고** `errors`에 경고 1건 — **문서화된 정책 하나로 통일**.

### 7.5 gen_node와의 API 정렬

`google.genai` 클라이언트 사용 방식은 `gen_node/agent.py`의 `generate_text_gemini`와 **동일 패턴**을 복사하는 것이 가장 빠르다(별도 클라이언트 초기화 유틸 공유는 선택).

---

## 8. `make_validator_node_handler` — 구현 스켈레톤

아래와 동일한 시그니처로 맞춘다.

```python
def make_validator_node_handler(infra: Any):
    agent = ValidatorNodeAgent(infra)

    async def handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        return await agent.validate(payload)

    return handler
```

`ValidatorNodeAgent.__init__(self, infra)`는 당장 `self.infra = infra`만 저장해도 된다.

---

## 9. 테스트 케이스 (최소)

| # | 입력 | 기대 |
|---|------|------|
| 1 | `generated_text=""` | `is_valid=False`, `errors`에 비어 있음 메시지 |
| 2 | 짧은 문자열만 | `rule_min_length` 실패 |
| 3 | 정상 길이 + 스텁과 동일 규칙만 | `is_valid=True` |
| 4 | `gemini_api_key` 없음 | 규칙만으로 판정(LLM 스킵) |
| 5 | LLM mock — JSON `is_valid: false` | `errors` 병합 확인 |

---

## 10. 구현 순서 체크리스트

1. `validator_node/payload.py` — `resolve_validation_mode`
2. `validator_node/rules.py` — 비어 있음 + 최소 길이
3. `validator_node/agent.py` — 규칙만 연결 → `bootstrap` 교체 → 통합 스모크
4. `prompts.py` + `llm_validate.py` — JSON 응답 + 파싱
5. (선택) 수치 라이트 체크 강화
6. (권장) `gen_node` 프롬프트에 `feedback` 섹션 추가 — 재시도 루프 효과 확보 ([IMPLEMENTATION_GUIDE.md §5](./IMPLEMENTATION_GUIDE.md))

---

## 11. 로깅

- `logger.info`: 모드(create/refine), `errors` 개수, LLM 호출 여부.
- **절대 로그에 `gemini_api_key`·전체 `fact_data` 덤프 금지.** 본문은 앞 200자만.

---

본 문서는 구현 세부(정규식·토큰 한도)를 바꿀 수 있으나, **§3 반환 스키마**와 **§5 파이프라인 순서**는 오케스트레이터와의 계약이므로 함부로 바꾸지 않는다.

# validator_node 정확도·피드백 확장 — 로직 설계서

**작성 목적**: 기존 검증 기준(규칙 + LLM)을 유지하면서, **정확도(점수/등급)·산정 이유·수정 권고**를 API 응답에 구조화해 반환하기 위한 **제품·로직 설계**를 고정한다.  
**대상 독자**: 백엔드·프론트·프로덕트 담당.  
**관련 문서**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md), [LOGIC_SPEC.md](./LOGIC_SPEC.md), [ACCURACY_FEEDBACK_IMPLEMENTATION.md](./ACCURACY_FEEDBACK_IMPLEMENTATION.md)(구현서).

---

## 1. 배경과 목표

### 1.1 현행 동작(요약)

- **규칙 단계**: 비어 있음·최소 길이·(create 시) 수치 최소 반영·DP 조회 실패 경고 등.
- **LLM 단계**: 사실 모순·그린워싱·과장 여부를 JSON으로 판단; 프롬프트에는 `rationale_ko`가 있으나 **최종 응답에는 미포함**.
- **출력**: `is_valid`, `errors`, `warnings`. 재시도 루프는 **`errors` → `feedback`**만 사용.

### 1.2 이번 확장이 만족시킬 사용자 의도

| 의도 | 설명 |
|------|------|
| **정확도 가시화** | 사용자가 “이 문단이 얼마나 신뢰할 만한가”를 UI에서 파악 |
| **산정 이유** | 점수·등급이 왜 그렇게 나왔는지 한눈에 (모델 요약 + 규칙 체크 요약) |
| **수정 가이드** | 실패 시뿐 아니라 **통과 시에도** 선택적 개선 제안(낮은 위험) |
| **기존 파이프라인 보존** | `is_valid`와 `errors` 계약으로 **재시도·gen 피드백**이 깨지지 않을 것 |

---

## 2. 설계 원칙

1. **단일 진실원천(Single source of truth)**  
   - **게이트(재시도 여부)**는 기존과 동일하게 **`is_valid`**만 사용한다.  
   - 정확도 점수는 **표시·분석용**이며, 기본값은 **`is_valid`와 논리적으로 정합**(통과 시 전체 점수 하한, 실패 시 상한 등 규칙은 §5 참고).

2. **하위 호환(가법적 확장)**  
   - 기존 키 `is_valid`, `errors`, `warnings`는 **항상 유지**.  
   - 신규 필드는 **선택**; 구버전 클라이언트는 무시 가능.

3. **규칙 vs LLM 역할 분리**  
   - **규칙**: 결정론적 체크리스트·부분 점수·체크 ID 부여 가능.  
   - **LLM**: 의미적 정합·과장·누락 등; **구조화된 피드백 항목**으로 반환.

4. **피드백 이중 채널**  
   - **재시도용(기존)**: `errors`는 **문자열 리스트** 유지 → `gen_node` `feedback`과 동일하게 동작.  
   - **UI용(신규)**: `feedback_items` 등 **구조화 배열**로 “인용·이슈·권장 조치”를 제공 (구현서 §3).

5. **개인정보·로그**  
   - API/이벤트에 **전체 프롬프트·전체 fact 원문**을 넣지 않는다. 기존 가이드 준수.

---

## 3. 판단 축(Accuracy dimensions)

UI와 구현이 동일한 언어를 쓰기 위해 **고정 식별자**를 둔다.

| `dimension_id` | 설명 | 주 담당 |
|----------------|------|---------|
| `format_completeness` | 비어 있지 않음, 최소 길이 충족 | 규칙 |
| `numeric_presence` | (create) 제공 수치가 본문에 최소 1회 이상 반영되는지 | 규칙 |
| `fact_consistency` | 본문이 제공 facts와 모순되지 않는지 | LLM |
| `greenwashing_risk` | 과장·근거 없는 약속 등 | LLM |
| `dp_availability` | 일부 DP 조회 실패 시 “인용 주의” | 규칙(경고) |

> **주의**: `numeric_presence`는 “모든 DP 수치가 정확히 일치”가 아니라 **현행 `rule_numeric_consistency_light`와 동일한 완화된 정의**(전 수치 미등장 시 오류)다. 진짜 “수치 정확도”는 별도 강화 규칙(향후)으로 분리할 수 있다.

---

## 4. 확장 응답 모델(논리 스키마)

### 4.1 최상위 필드(추가)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `schema_version` | `string` | 권장 | 예: `"validator_ui_v1"` — 프론트 분기용 |
| `accuracy` | `object` | 선택 | §4.2 |
| `feedback_items` | `array` | 선택 | §4.3 — 구조화된 수정·개선 권고 |
| `rationale` | `object` | 선택 | §4.4 — 사람이 읽는 요약 |

기존 필드: `is_valid`, `errors`, `warnings` — **변경 없음**.

### 4.2 `accuracy` 객체

```json
{
  "overall": {
    "score": 78,
    "band": "good",
    "label_ko": "양호"
  },
  "by_dimension": [
    {
      "id": "format_completeness",
      "score": 100,
      "weight": 0.15,
      "source": "rules",
      "notes_ko": "최소 길이 충족"
    },
    {
      "id": "numeric_presence",
      "score": 100,
      "weight": 0.25,
      "source": "rules",
      "notes_ko": "제공 수치가 본문에 반영됨"
    },
    {
      "id": "fact_consistency",
      "score": 60,
      "weight": 0.35,
      "source": "llm",
      "notes_ko": "일부 서술이 제공 범위를 넘어 확정적으로 단정"
    },
    {
      "id": "greenwashing_risk",
      "score": 70,
      "weight": 0.25,
      "source": "llm",
      "notes_ko": "효과 표현이 다소 절대적"
    }
  ]
}
```

**점수 범위**: `0–100` 정수 권장.  
**`band`**: 예시 열거 — `excellent` | `good` | `fair` | `poor` (팀 정책으로 매핑표 고정).  
**가중치 `weight`**: 합이 1.0이 되도록 정규화(구현서에서 상수 테이블로 관리).

**`is_valid`와의 정합(권장 정책)**:

- `is_valid == false` 이면 `overall.score`는 **상한**을 둔다(예: 최대 59) — “미통과인데 만점” 방지.  
- `is_valid == true` 이면 `overall.score`는 **하한**을 둔다(예: 최소 60) — “통과했는데 항상 낮음” 완화.  
  - 예외: **규칙만으로 실패**한 경우는 LLM을 호출하지 않을 수 있어, 점수 산정은 구현서의 “부분 누락 시 폴백” 규칙을 따른다.

### 4.3 `feedback_items` 배열

사용자 의도인 **“어느 부분을 어떻게 고치면 좋은지”**를 구조화한다. 기존 `errors`의 **문장 리스트는 유지**하고, 여기서는 **머신이 파싱하기 쉬운 형태**를 추가한다.

```json
{
  "feedback_items": [
    {
      "severity": "error",
      "dimension_id": "fact_consistency",
      "issue_ko": "제공된 배출량 수치와 다른 값이 본문에 포함됨",
      "suggestion_ko": "제공된 facts의 수치·단위만 인용하고, 불확실 시 정성 서술로 완화",
      "quote": "2023년 범위1 배출량은 약 12만 톤으로 집계되었다",
      "source": "llm"
    },
    {
      "severity": "suggestion",
      "dimension_id": "greenwashing_risk",
      "issue_ko": "효과를 절대적 표현으로 서술",
      "suggestion_ko": "목표·기준연도·측정 범위를 함께 명시",
      "quote": null,
      "source": "llm"
    }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `severity` | `error` \| `warning` \| `suggestion` — UI 스타일 분기 |
| `quote` | 가능하면 **생성 문단에서 인용**(짧게). 없으면 `null`. **PII 주의**. |
| `source` | `rules` \| `llm` \| `derived` |

**통과(`is_valid: true`) 시**: `severity: "suggestion"` 위주로 채울 수 있다(프롬프트에서 강제). **실패 시**: 기존 `errors` 문자열과 **내용 중복을 허용**(gen은 문자열만 보므로). 중복을 줄이려면 구현 단계에서 `errors`를 `feedback_items[].issue_ko`에서 파생시키는 방안도 가능(팀 선택).

### 4.4 `rationale` 객체

프롬프트의 `rationale_ko`를 살릴 때 사용한다.

```json
{
  "rationale": {
    "summary_ko": "전반적으로 사실과 대체로 일치하나, 일부 단정 표현이 데이터 범위를 초과함.",
    "rule_summary_ko": "형식·수치 최소 반영 규칙은 통과.",
    "llm_summary_ko": "과장 표현 1건 지적 가능."
  }
}
```

---

## 5. 파이프라인 상 변화(논리)

```
[입력 동일]
    → run_rules → RuleResult( errors, warnings, rule_signals* )
    → (규칙 errors 있으면 정책에 따라 LLM 스킵 또는 실행 — 기본: 스킵 유지 가능)
    → run_llm_validate → LLM JSON(확장)
    → merge → 최종 dict
```

- **`rule_signals`**: 규칙 단계에서 차원별 통과/실패·부분 점수를 채우기 위한 **내부 구조체**(구현서).  
- **병합**: LLM이 준 차원 점수와 규칙 차원 점수를 **가중 평균**으로 `accuracy.overall` 생성.

---

## 6. 오케스트레이터·API 영향

- **Phase 3 루프**: `state["feedback"] = validation.get("errors", [])` — **변경 없음**.  
- **최종 응답**: `state["validation"]`에 확장 필드가 포함되면, **프론트는 동일 엔드포인트**에서 `accuracy`, `feedback_items`, `rationale`을 읽어 표시 가능.  
- **Refine 경로**: `validation` 전체가 그대로 내려가므로 동일. `warnings`와의 관계는 [IMPLEMENTATION_GUIDE.md §2.4](./IMPLEMENTATION_GUIDE.md)와 정합 유지.

---

## 7. 비목표(이번 설계에서 닫지 않는 것)

- 문장 단위 **오프셋 인덱스**까지의 정밀 매핑(토큰 비용·정확도 이슈). 1차는 `quote` 문자열 **부분 일치** 또는 모델이 준 짧은 인용.  
- **캘리브레이션된** 확률적 정확도(모델 점수의 절대 비교 가능성). UI 문구는 “참고 지표”로 완화.  
- **validator만으로 전부 해결**하는 수치 대조 — 현행과 동일하게 LLM+가벼운 규칙 한계 인정.

---

## 8. 리스크와 완화

| 리스크 | 완화 |
|--------|------|
| LLM 점수 요동 | temperature 낮게 유지, 차원별 고정 루브릭, `is_valid`와 상한·하한 정책 |
| 응답 파싱 실패 | 기존처럼 폴백: `is_valid`만 신뢰, 확장 필드 생략 |
| 토큰 비용 증가 | 확장 스키마는 **한 번의 JSON**으로 유지; 불필요한 장문 금지 |
| 사용자 오해(만점=법적 보증) | UI 카피: “자동 평가 참고” 문구 |

---

## 9. 승인 기준(이 설계의 완료 정의)

- [ ] 확장 스키마가 프론트와 합의됨(`schema_version` 포함).  
- [ ] `is_valid` / `errors` 동작이 기존 테스트와 호환.  
- [ ] 구현서([ACCURACY_FEEDBACK_IMPLEMENTATION.md](./ACCURACY_FEEDBACK_IMPLEMENTATION.md))의 체크리스트 완료.

---

## 10. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-09 | 초안 작성 |

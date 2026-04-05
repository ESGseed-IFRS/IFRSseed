# UCM 결정/정책 모듈 설계 (Agent 내부)

> **구현 정합 (코드 기준, 2026)**  
> - **점수·임계값·페널티·`pick_best`·`decide_mapping_pair`** → `backend/domain/v1/esg_data/spokes/agents/ucm_policy.py` (순수 함수, DB 미사용).  
> - **`UCMCreationAgent`** → `policy_pick_best` / `policy_finalize_decision`이 위 모듈을 호출하고, **`llm_refinement` / `llm_refinement_batch`** 가 §2-3 LLM 단계를 수행.  
> - **LLM 호출 여부(실질 스위치)** → 오케스트레이터 인자 **`use_llm_in_mapping_service`** (FastAPI `PolicyPipelineRequest` 기본값 `false`). `ucm_policy.should_call_llm()`은 현재 **항상 `True`** 이지만, 위 플래그가 `false`이면 LLM 분기 자체가 실행되지 않음.  
> - 점수식 첫 항은 후보의 **`hybrid_score`**(임베딩·구조 하이브리드), 문서의 `embedding_score`와 동일하지 않을 수 있음.

## 1. 목적

`UnifiedColumnMapping` 채움 로직에서 품질/재현성/비용을 동시에 확보하기 위해, 아래 원칙을 사용한다.

- 후보 생성과 검증은 **Tool**에서 수행
- 최종 `accept/review/reject` 판단은 **`ucm_policy` + 에이전트 훅**에서 수행 (`decide_mapping_pair` 등)
- LLM 보정은 **`use_llm_in_mapping_service=True`** 일 때만 오케스트레이터가 호출하며, 성공 시 `refinement_score`로 `final_score`를 보정·`llm_decision`으로 tentative를 덮을 수 있음

이 문서는 위 구현과 정렬하되, **향후 튜닝(임계값·페널티·LLM 게이트)** 을 논의할 때 참고할 용어·흐름을 남긴다.

---

## 2. 권장 파이프라인

1) 임베딩 후보 생성 Tool  
2) 규칙 검증 Tool  
3) (선택) LLM 재평가 — **`use_llm_in_mapping_service`** 가 참일 때만 (`OPENAI_API_KEY` 등 필요)  
4) **`ucm_policy` + `policy_finalize_decision`** 최종 판정  
5) 스키마 매핑 Tool로 저장용 payload 생성  
6) Orchestrator → `UCMMappingService.upsert_ucm_from_payload` 등으로 upsert

핵심 원칙:
- Tool은 "계산/검증/변환"만 담당
- Agent는 "정책 판단"만 담당
- Repository는 "저장"만 담당

---

## 3. Tool 구성 (MVP)

## 3.1 Embedding Tool (`EmbeddingCandidateTool`)
- 입력: source DP, target standard(또는 nearest 시 `None`), `top_k`, 임계값들
- 출력(후보 항목 예):
  - `target_dp_id`
  - **`hybrid_score`** (0.0~1.0, 벡터·구조 결합 — 정책 점수식 첫 항에 사용)
  - 순위·기타 메타
  - (선택) 근거 필드

## 3.2 Rule Validation Tool
- 입력: source DP + 후보 목록
- 출력:
  - `rule_pass` (bool)
  - `rule_score` (0.0~1.0)
  - `violations[]` (예: `unit_mismatch`, `category_conflict`, `data_type_conflict`)
  - `rule_evidence` (선택)

## 3.3 Schema Mapping Tool
- 입력: Agent가 최종 채택한 후보/판정 결과
- 출력:
  - `unified_column_mappings` upsert용 payload
  - 공통 필드 예: `mapped_dp_ids`, `mapping_confidence`, `mapping_status`, `reason_codes`, `evidence`

주의:
- Schema Mapping Tool은 저장을 하지 않는다.
- 저장은 Orchestrator -> Repository에서 수행한다.

---

## 4. `rulebook + data_point` 결합 전략

`data_point.json` 단독 사용보다 `rulebook.json`을 결합해 의미/규칙 문맥을 함께 평가한다.

## 4.1 결합 키
- 기본 조인 키: `rulebook.primary_dp_id == data_point.dp_id`
- 후보 확장 키: `rulebook.related_dp_ids[]`

## 4.2 결합 목적
- `data_point`: 식별자/이름/카테고리/타입/계층(정의 정보)
- `rulebook`: 요구사항/검증조건/핵심 키워드(판단 정보)

## 4.3 결합 후 평가 입력 예시
- 임베딩 점수: source DP vs target DP
- 규칙 정합 점수: `validation_rules.key_terms`, `required_actions`, `verification_checks`
- 요구 강도 가중치: `disclosure_requirement` (`필수` 여부)
- 구조 정합: category/dp_type/unit 충돌 여부

---

## 5. 결합 점수식(가중치 제안)

최종 점수는 0~1 범위로 정규화한다.

```text
final_score
 = 0.50 * hybrid_score
 + 0.30 * rule_score
 + 0.10 * structure_score
 + 0.10 * requirement_score
 - penalty
```

- `hybrid_score`: `EmbeddingCandidateTool` 산출 (벡터·구조 결합)
- `rule_score`: rulebook 기반 의미/요구사항 충족 점수
- `structure_score`: category, dp_type, unit 정합성 점수
- `requirement_score`: 필수 공시/우선순위 반영 점수
- `penalty`: `compute_penalty(violations)` — 위반 **건수만큼 누적**, 상한 **0.50** (`ucm_policy.py`)

## 5.1 가중치 표 (`ucm_policy.compute_final_score`와 동일)

| 항목 | 기호 | 범위 | 가중치 | 비고 |
|---|---|---|---:|---|
| 하이브리드 후보 점수 | `hybrid_score` | 0~1 | 0.50 | 임베딩·구조 결합 |
| 규칙 정합성 | `rule_score` | 0~1 | 0.30 | rulebook 핵심 |
| 구조 정합성 | `structure_score` | 0~1 | 0.10 | 타입/단위/카테고리 |
| 요구 강도 | `requirement_score` | 0~1 | 0.10 | `disclosure_requirement` 반영 |
| 페널티 | `penalty` | 0~0.50 | - | 아래 §5.2 |

## 5.2 페널티 규칙 (**현행 구현**: `compute_penalty`)

`violations` 리스트를 순회하며 누적하고 **`min(0.50, p)`** 로 캡한다.

| 조건 | 가산 |
|------|-----:|
| `severity == "critical"` 이고 `type in ("unit_mismatch", "data_type_mismatch", "missing_target_dp")` | +0.20 |
| `severity == "critical"` (위 타입 외) | +0.15 |
| 그 외 (warning 등) | +0.05 |

> 과거 문서의 유형별 고정 0.30/0.20 표는 **초안**이었으며, 현재 코드는 **위 표**를 따른다.

---

## 6. 정책 모듈 (코드 배치)

| 역할 | 파일 | 함수·메서드 |
|------|------|-------------|
| 점수·페널티·임시 판정·최종 판정 핵심 | `spokes/agents/ucm_policy.py` | `compute_final_score`, `compute_penalty`, `tentative_decision_from_scores`, `should_call_llm`, `pick_best_candidate_pair`, `decide_mapping_pair`, `diagnose_pick_best_failures` |
| LLM 호출 | `spokes/agents/ucm_creation_agent.py` | `llm_refinement`, `llm_refinement_batch` |
| 에이전트 퍼사드 | 동일 | `policy_pick_best` → `ucm_policy.pick_best_candidate_pair`, `policy_finalize_decision` → `ucm_policy.decide_mapping_pair` |

`DecisionResult` (TypedDict, `ucm_pipeline_contracts`) 주요 필드:
- `decision`: `accept | review | reject`
- `confidence` / `final_score`: float
- `reason_codes`: list[str]
- `llm_used`: bool
- `evidence`: dict (hybrid_score, rule_score, penalty, violations, LLM 보정 시 `llm_refinement_score` 등)
- `chosen_target_dp_id`: str

---

## 7. 판정 정책 (**`tentative_decision_from_scores` + LLM 보정**)

하드 규칙(우선):
- **`pick_best_candidate_pair`**: 치명 위반(`critical`)이 있는 후보 쌍은 **최적 쌍에서 제외**
- **`tentative_decision_from_scores`**: `has_critical`이면 무조건 **`reject`**

점수 정책 (**LLM 미적용·또는 LLM 스킵 시** `tentative` 의미):
- `final_score >= 0.85` and 치명 위반 없음 → `accept`
- `final_score < 0.60` → `reject`
- 그 외 → `review`

LLM 호출 (**현행**):
- 오케스트레이터: `use_llm_in_mapping_service and ucm_policy.should_call_llm(...)`.
- `should_call_llm`은 인자와 무관하게 **`True`** 를 반환하므로, **실질 스위치는 `use_llm_in_mapping_service` 단독**이다 (API 기본 `false`).
- LLM 성공 시 `decide_mapping_pair`에서 `refinement_score`로 `final_score`를 **`0.35 * 기존 + 0.65 * refinement`** 로 보정하고, `llm_decision`이 있으면 tentative를 덮어쓸 수 있음 (`reject` 시 상한 0.35 등 — 코드 참고).

### 7.1 임계값 표 (`tentative_decision_from_scores`)

| 구간/조건 | 판정 | 설명 |
|---|---|---|
| 치명 위반 `has_critical` | `reject` | 하드 규칙 우선 |
| `final_score >= 0.85` and 치명 위반 없음 | `accept` | 자동 승인 구간 |
| `0.60 <= final_score < 0.85` | `review` | 수동 검토 대상 |
| `final_score < 0.60` | `reject` | 자동 반려 구간 |

추가 운영 규칙(문서 권장안, **코드에 미반영될 수 있음**):
- 필수 공시·검토 큐 우선순위, LLM 후 `confidence` 하한 등은 운영 정책으로 별도 구현 시 반영.

### 7.2 샘플 계산 5건

점수식:
`final_score = 0.50*hybrid + 0.30*rule + 0.10*structure + 0.10*requirement - penalty`

| 케이스 | hybrid | rule | structure | requirement | penalty | final_score | 결과 |
|---|---:|---:|---:|---:|---:|---:|---|
| A (고신뢰) | 0.92 | 0.88 | 0.90 | 1.00 | 0.00 | 0.904 | `accept` |
| B (경계) | 0.76 | 0.68 | 0.80 | 1.00 | 0.05 | 0.708 | `review` |
| C (낮은 점수) | 0.54 | 0.58 | 0.70 | 0.80 | 0.00 | 0.582 | `reject` |
| D (높은 페널티) | 0.90 | 0.74 | 0.85 | 1.00 | 0.30 | 0.727 | `review` (치명 없을 때만; **치명 있으면 `has_critical`로 reject**) |
| E (중간 점수) | 0.83 | 0.79 | 0.75 | 1.00 | 0.00 | 0.815 | `review` |

해석:
- D행은 **페널티만** 높은 예시; 실제로는 `has_critical`이면 `tentative_decision_from_scores`가 먼저 `reject`.
- E는 자동 승인 임계값(0.85) 미달이라 `review`.

---

## 8. 저장 상태/전이 권장안

상태:
- `accepted`: 자동/반자동 승인
- `reviewing`: 수동 검토 필요
- `rejected`: 반려

전이:
- 초기 생성 -> `accepted | reviewing | rejected`
- `reviewing`은 운영자 승인/재평가 후 `accepted` 또는 `rejected`

권장:
- `reviewing` 큐를 반드시 운영
- 저신뢰도 자동 승격 금지

---

## 9. 품질/운영 체크포인트

1) 설명가능성(Explainability)
- `reason_codes`, `violations`, `scores`, `llm_used`를 저장

2) 재현성(Reproducibility)
- 임계값/정책 버전(`policy_version`) 기록

3) 비용 최적화
- **현행**: API에서 **`use_llm_in_mapping_service=false`(기본)** 로 두면 LLM 미호출. 향후 `should_call_llm`에 임계·밴드 로직을 넣으면 추가 절감 가능.

4) 멱등성
- 같은 입력 재실행 시 같은 결과가 나오도록 upsert key/정책 고정

5) 책임 분리
- Agent: 판단
- Tool: 계산/검증/변환
- Orchestrator: 흐름 제어
- Repository: 저장

---

## 10. 테스트 전략

단위 테스트:
- `ucm_policy` 함수 입력 조합별 `accept/review/reject` 검증 (`tests/test_ucm_policy_scoring.py` 등)
- 치명 위반·`pick_best` 제외 검증
- 오케스트레이터와 함께 **`use_llm_in_mapping_service` on/off** 에 따른 LLM 호출 여부 통합 검증

통합 테스트:
- 임베딩 Tool + 규칙 Tool + Agent 정책 + Schema Mapping Tool 연결
- Orchestrator -> Repository 저장 payload shape 검증

회귀 테스트:
- 임계값 변경 시 결과 변동 폭 모니터링

---

## 11. 구현 순서 권장

1. Embedding / Rule / Schema Tool 인터페이스 유지
2. `ucm_policy` 임계값·페널티·`should_call_llm` 게이트 튜닝(필요 시)
3. LLM 보정 프롬프트·배치 API 안정화 (`llm_refinement_batch`)
4. Orchestrator `persist_mode`·저장 전략 운영화
5. (선택) §13 `.env` 키를 읽도록 설정 레이어 연결
6. `reviewing` 운영 큐/리포트

---

## 12. API 요청/응답 스키마 예시

아래 예시는 `esg_data`의 워크플로우 실행 시 정책 판단 결과를 어떻게 주고받을지에 대한 권장 포맷이다.

### 12.1 워크플로우 실행 요청 예시

```json
{
  "source_standard": "GRI",
  "target_standard": "ESRS",
  "vector_threshold": 0.7,
  "structural_threshold": 0.5,
  "final_threshold": 0.75,
  "batch_size": 40,
  "dry_run": false,
  "run_quality_check": true,
  "force_validate_only": false
}
```

### 12.2 워크플로우 응답 예시 (성공 + 품질검사 스킵)

```json
{
  "status": "success",
  "workflow": {
    "langgraph": false,
    "routed_to": "creation_agent"
  },
  "create_result": {
    "status": "success",
    "mode": "write",
    "source_standard": "GRI",
    "target_standard": "ESRS",
    "stats": {
      "processed": 40,
      "auto_confirmed_exact": 15,
      "auto_confirmed_partial": 10,
      "auto_confirmed_no_mapping": 4,
      "suggested": 6,
      "skipped_low_score": 3,
      "skipped_no_embedding": 1,
      "errors": 1
    }
  },
  "validation_result": {
    "status": "success",
    "metrics": {
      "active_data_points": 1200,
      "mapped_data_points_by_equivalent_dps": 860,
      "mapping_coverage_percent": 71.67,
      "active_unified_column_mappings": 340,
      "missing_dp_references_in_ucm": 0
    }
  },
  "quality_result": null,
  "issues": [],
  "message": "completed"
}
```

### 12.3 정책 모듈 내부 결정 결과 예시 (`DecisionResult`)

```json
{
  "decision": "review",
  "confidence": 0.74,
  "reason_codes": [
    "embedding_mid_band",
    "rule_unit_mismatch_non_critical"
  ],
  "llm_used": true,
  "evidence": {
    "hybrid_score": 0.78,
    "rule_score": 0.62,
    "violations": [
      {
        "code": "unit_mismatch",
        "severity": "warning",
        "source_unit": "tCO2e",
        "target_unit": "kgCO2e"
      }
    ],
    "llm_summary": "의미는 유사하나 단위 정규화 필요"
  },
  "policy_version": "ucm_pipeline_v1"
}
```

### 12.4 Repository upsert payload 예시 (Schema Mapping Tool 출력)

```json
{
  "unified_column_id": "UCM_ENV_0012",
  "mapped_dp_ids": [
    "gri_305_1",
    "ifrs_s2_ghg_scope1"
  ],
  "mapping_confidence": 0.91,
  "mapping_status": "accepted",
  "reason_codes": [
    "embedding_high",
    "rule_pass"
  ],
  "evidence": {
    "hybrid_score": 0.93,
    "rule_score": 0.88,
    "policy_version": "ucm_pipeline_v1"
  }
}
```

### 12.5 검증 전용 실행 예시 (`force_validate_only=true`)

```json
{
  "source_standard": "GRI",
  "target_standard": "ESRS",
  "force_validate_only": true,
  "run_quality_check": true
}
```

응답에서는 `workflow.routed_to`가 `validation_agent`로 고정되고, `create_result`는 비어 있거나 `null`일 수 있다.

---

## 13. 설정값(.env) 키 제안 (**향후 — 현재 코드 미사용**)

아래 키들은 정책 임계값을 코드 하드코딩에서 분리하기 위한 **설계 초안**이다. **`ucm_policy.py`는 현재 이 환경변수를 읽지 않으며**, 가중치·페널티·임계값은 소스에 고정되어 있다. 도입 시 `get_settings()` 등과 연동하면 된다.

### 13.1 점수 가중치

| 키 | 기본값 | 설명 |
|---|---:|---|
| `UCM_WEIGHT_EMBEDDING` | `0.50` | 임베딩 점수 가중치 |
| `UCM_WEIGHT_RULE` | `0.30` | rulebook 정합 점수 가중치 |
| `UCM_WEIGHT_STRUCTURE` | `0.10` | 구조 정합 점수 가중치 |
| `UCM_WEIGHT_REQUIREMENT` | `0.10` | 공시 요구 강도 가중치 |

권장 검증:
- 네 가중치 합이 1.0이 아니면 런타임에 정규화하거나 부팅 시 에러 처리

### 13.2 판정 임계값

| 키 | 기본값 | 설명 |
|---|---:|---|
| `UCM_ACCEPT_THRESHOLD` | `0.85` | 자동 승인 하한 |
| `UCM_REVIEW_THRESHOLD` | `0.60` | review 하한 (`<`이면 reject) |
| `UCM_DISCLOSURE_REQUIRED_BOOST_THRESHOLD` | `0.80` | 필수 공시 우선 검토 기준 |
| `UCM_REVIEW_MIN_CONFIDENCE_AFTER_LLM` | `0.75` | LLM 후에도 이 값 미만이면 reviewing 유지 |

### 13.3 LLM 호출 제어 (미연동 — 현재는 API 필드 `use_llm_in_mapping_service` 사용)

| 키 | 기본값 | 설명 |
|---|---:|---|
| `UCM_LLM_REVIEW_ENABLED` | `1` | (향후) LLM 사용 여부 |
| `UCM_LLM_BAND_MIN` | `0.65` | (향후) 밴드 하한 — **코드의 `should_call_llm`은 밴드 미적용** |
| `UCM_LLM_BAND_MAX` | `0.82` | (향후) 밴드 상한 |
| `UCM_LLM_MAX_CANDIDATES_PER_DP` | `3` | (향후) DP당 LLM 후보 수 제한 |

### 13.4 페널티 값

| 키 | 기본값 | 설명 |
|---|---:|---|
| `UCM_PENALTY_CRITICAL_RULE_FAIL` | `0.30` | 치명 규칙 위반 |
| `UCM_PENALTY_DATA_TYPE_CONFLICT` | `0.20` | 타입 충돌 |
| `UCM_PENALTY_UNIT_MISMATCH` | `0.10` | 단위 불일치 |
| `UCM_PENALTY_CATEGORY_CONFLICT` | `0.10` | E/S/G 카테고리 충돌 |

### 13.5 운영 제어

| 키 | 기본값 | 설명 |
|---|---:|---|
| `UCM_REVIEW_QUEUE_ENABLED` | `1` | reviewing 큐 활성화 |
| `UCM_DRY_RUN_DEFAULT` | `0` | 기본 실행 모드 |
| `UCM_POLICY_VERSION` | `v1.0` | 판정 정책 버전 태그 |

### 13.6 `.env` 예시

```dotenv
# UCM scoring weights
UCM_WEIGHT_EMBEDDING=0.50
UCM_WEIGHT_RULE=0.30
UCM_WEIGHT_STRUCTURE=0.10
UCM_WEIGHT_REQUIREMENT=0.10

# Decision thresholds
UCM_ACCEPT_THRESHOLD=0.85
UCM_REVIEW_THRESHOLD=0.60
UCM_DISCLOSURE_REQUIRED_BOOST_THRESHOLD=0.80
UCM_REVIEW_MIN_CONFIDENCE_AFTER_LLM=0.75

# LLM review band
UCM_LLM_REVIEW_ENABLED=1
UCM_LLM_BAND_MIN=0.65
UCM_LLM_BAND_MAX=0.82
UCM_LLM_MAX_CANDIDATES_PER_DP=3

# Penalties
UCM_PENALTY_CRITICAL_RULE_FAIL=0.30
UCM_PENALTY_DATA_TYPE_CONFLICT=0.20
UCM_PENALTY_UNIT_MISMATCH=0.10
UCM_PENALTY_CATEGORY_CONFLICT=0.10

# Ops
UCM_REVIEW_QUEUE_ENABLED=1
UCM_DRY_RUN_DEFAULT=0
UCM_POLICY_VERSION=v1.0
```

---

**문서 상태**: 구현 정합 반영(2026-04) — 세부 튜닝·§13 환경변수는 향후 과제  
**범위**: `esg_data` UCM 정책 파이프라인 (`ucm_policy` + `UCMCreationAgent` + 오케스트레이터)  

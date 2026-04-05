# DP 유형 라우팅 + 적합성 경고 구현 완료

**구현일**: 2026-04-05  
**목적**: rulebook·UCM 기반 정량/정성 판단으로 잘못된 매핑 방지

---

## 배경

### 문제

사용자가 제공한 `fact_data` 예시에서:
- **UCM/rulebook**: "인센티브에 기후 고려 반영 **여부·방법**" (정성/서술형)
- **실제 값**: `environmental_data.scope1_total_tco2e = 473.9674` (Scope 1 배출량)

→ **주제와 수치가 불일치** — 문단 생성 시 잘못된 근거 사용 위험.

### 해결 방향

1. **제안 B (오케스트레이터 선행 체크)**: `dp_type=quantitative`만 `dp_rag` 호출, 정성 DP는 다른 경로로 라우팅.
2. **제안 A (dp_rag 내부 경고)**: rulebook·UCM description 기반 보조 안전장치 — `suitability_warning` 필드.

---

## 구현 내용

### 1. 오케스트레이터: `_check_dp_type_for_routing` (제안 B)

**파일**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`

**로직**:
```python
async def _check_dp_type_for_routing(self, dp_id: str) -> Dict[str, Any]:
    """
    DP 유형 선행 체크 — quantitative만 dp_rag 호출.
    
    Returns:
        {
            "is_quantitative": bool,
            "dp_type": str | None,
            "reason": str
        }
    """
```

**판단 기준**:
1. **UCM 접두** (`UCM...`):
   - `query_ucm_direct`로 조회.
   - `column_description` / `column_name_ko`에 정성 키워드("여부", "방법", "설명", "공개") 있으면 → `is_quantitative=False`.
   - 없으면 보수적으로 `True` (기존 동작 유지).

2. **일반 DP**:
   - `query_dp_metadata`로 `dp_type` 조회.
   - `dp_type=quantitative` → `True`.
   - 나머지(`qualitative`, `narrative`, `binary`) → `False`.

**_parallel_collect 수정**:
```python
if user_input.get("dp_id"):
    dp_type_check = await self._check_dp_type_for_routing(user_input["dp_id"])
    
    if dp_type_check["is_quantitative"]:
        logger.info("DP is quantitative — calling dp_rag")
        dp_rag_task = ...
    else:
        logger.warning("DP is NOT quantitative — skipping dp_rag")
        # TODO: narrative_rag로 라우팅
```

**효과**:
- 정성 DP는 애초에 `dp_rag`를 타지 않음 → **잘못된 수치 매핑 원천 차단**.
- `fact_data = {}` (빈 dict) 반환.

---

### 2. dp_rag: `_check_quantitative_suitability` (제안 A)

**파일**: `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/agent.py`

**로직**:
```python
def _check_quantitative_suitability(
    self,
    dp_id: str,
    dp_meta: Optional[Dict[str, Any]],
    ucm_info: Optional[Dict[str, Any]],
    rulebook_payload: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    rulebook·UCM description 기반 정량 적합성 체크 (보조 안전장치).
    
    Returns:
        경고 문자열 (문제 없으면 None)
    """
```

**체크 항목**:
1. **`dp_type`**: `qualitative` / `narrative` / `binary`면 경고.
2. **UCM description**: 정성 키워드("여부", "방법", "설명", "공개", "whether", "how", "describe") 매칭.
3. **rulebook content**: "설명", "공개", "기술", "서술" 키워드.

**응답에 추가**:
```python
return {
    ...
    "suitability_warning": suitability_warning,  # None 또는 경고 문자열
    ...
}
```

**효과**:
- 오케스트레이터 체크를 통과한 DP라도 **rulebook 내용이 정성 신호를 보이면** 경고.
- `gen_node`가 `suitability_warning` 보고 "수치만으로 부족" 판단 가능.

---

## 동작 흐름

```
사용자 요청: dp_id="UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i"

오케스트레이터:
  _check_dp_type_for_routing(dp_id)
    → UCM 조회
    → description에 "여부·방법" 키워드 감지
    → is_quantitative=False
  
  로그: "DP is NOT quantitative (type=qualitative) — skipping dp_rag"
  fact_data = {}

gen_node:
  fact_data가 비어 있음 → c_rag(SR 본문) 또는 별도 narrative 소스 사용
```

**정량 DP 예시** (`dp_type=quantitative`):
```
사용자 요청: dp_id="ESRS2-E1-6" (Scope 1 배출량)

오케스트레이터:
  _check_dp_type_for_routing
    → dp_type=quantitative
    → is_quantitative=True
  
  dp_rag 호출
    → _check_quantitative_suitability
      → dp_type=quantitative, 키워드 없음
      → suitability_warning=None
    
    → environmental_data.scope1_total_tco2e 조회
    → value=473.9674, unit="tCO2e"

fact_data: {
  "value": 473.9674,
  "unit": "tCO2e",
  "suitability_warning": null
}
```

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|----------|
| `orchestrator/orchestrator.py` | `_check_dp_type_for_routing` 메서드 추가, `_parallel_collect` 수정 |
| `dp_rag/agent.py` | `_check_quantitative_suitability` 메서드 추가, 응답에 `suitability_warning` 필드 |
| `docs/dp_rag/dp_rag.md` | §3 응답 구조, §5.1 흐름, §5.2 메서드 표 업데이트 |
| `docs/dp_rag/IMPLEMENTATION_STATUS.md` | Phase 3 절 추가 |
| `docs/NEW_CHAT_CONTEXT.md` | §4.6, §6 업데이트 |

---

## 테스트 시나리오

### 1. 정량 DP (정상)

**입력**: `dp_id="ESRS2-E1-6"`, `dp_type=quantitative`

**예상**:
- 오케스트레이터: `is_quantitative=True` → `dp_rag` 호출.
- dp_rag: `suitability_warning=None`.
- 응답: `value`, `unit` 정상.

### 2. 정성 DP (오케스트레이터 차단)

**입력**: `dp_id="UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i"` (인센티브 여부·방법)

**예상**:
- 오케스트레이터: UCM description에 "여부·방법" → `is_quantitative=False`.
- 로그: "NOT quantitative — skipping dp_rag".
- `fact_data = {}`.

### 3. 정량 DP + 정성 신호 (dp_rag 경고)

**입력**: `dp_id="SOME_DP"`, `dp_type=quantitative`, rulebook에 "설명하시오"

**예상**:
- 오케스트레이터: `is_quantitative=True` → `dp_rag` 호출.
- dp_rag: `_check_quantitative_suitability` → `suitability_warning="Rulebook suggests narrative disclosure"`.
- 응답: `value` 있지만 `suitability_warning` 포함 → gen_node가 서술 보완 판단.

---

## 향후 개선

1. **정성 DP 전용 라우팅**:
   - `is_quantitative=False`일 때 `narrative_rag` 또는 `c_rag`로 라우팅.
   - 서술·정책 설명을 SR 본문·폼 답변에서 가져오기.

2. **gen_node에서 `suitability_warning` 활용**:
   - 경고가 있으면 "수치 외 서술 필요" 프롬프트 추가.

3. **통합 테스트**:
   - 실 DB + Gemini로 다양한 DP 유형 검증.

---

**최종 수정**: 2026-04-05

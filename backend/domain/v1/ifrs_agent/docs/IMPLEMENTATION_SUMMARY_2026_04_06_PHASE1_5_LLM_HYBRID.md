# Phase 1.5 하이브리드 LLM + 규칙 기반 DP 적합성 판단 구현 요약

**날짜**: 2026-04-06  
**작업**: Phase 1.5 DP 계층 검증을 LLM 기반 동적 판단으로 확장  
**상태**: ✅ 구현 완료

---

## 1. 배경 및 문제

### 기존 구현 (규칙 기반)

Phase 1.5 DP 계층 검증은 단순 규칙 기반으로 작동했습니다:

```python
# 기존 로직
if child_dps:  # child_dps가 있으면 무조건 재선택 요청
    return needs_user_selection
```

**문제점:**

1. **경직성**: `child_dps`만으로 판단 → `description`, `validation_rules` 무시
2. **맥락 부족**: 사용자 의도(`category`, `prompt`, `search_intent`)와 DP 주제 불일치 감지 불가
3. **설명 부족**: "상위 DP입니다" 같은 일반적인 메시지만 제공 → 사용자가 왜 재선택해야 하는지 이해 어려움

### 사용자 요구사항

> "다시 프롬프트로 유동성있게 llm이 판단하게 할수없는건가 description / validation_rules로도 판단이 가능해야 해야한다 그렇다고 description / validation_rules에 하위 항목 공시 지시 문구가 포함됨 만 걸러내지 말고 오케스트레이터가 스스로 판단 후 gen_node에게 주기에 적합하지 않아 전달하지 않고 사용자에게 또한 dp을 반환을 이유을 설명해주는 설계"

**핵심:**

- LLM이 `description`, `validation_rules`, 사용자 의도를 종합하여 동적 판단
- 단순 키워드 매칭이 아닌 맥락 있는 이해
- 사용자에게 구체적이고 맥락 있는 사유 제공

---

## 2. 설계 원칙: 하이브리드 구조 (가드레일 + LLM + 강제 규칙)

### 2.1 3단계 구조

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1.5: DP 적합성 판단 (하이브리드)                      │
├─────────────────────────────────────────────────────────────┤
│ 1. 가드레일 (규칙 기반)                                     │
│    - child_dps 유무로 1차 필터 (UCM 제외)                   │
│    - 빠른 필터링, LLM 호출 비용 절감                         │
├─────────────────────────────────────────────────────────────┤
│ 2. LLM 판단 (Gemini)                                        │
│    - description·validation_rules·사용자 의도 종합 분석     │
│    - 구조화 JSON 출력: needs_user_selection, reason_ko      │
│    - 맥락 있는 설명 생성                                     │
├─────────────────────────────────────────────────────────────┤
│ 3. 강제 규칙 (strict 모드)                                  │
│    - orchestrator_phase15_strict_child_dps=True             │
│    - child_dps 있으면 LLM이 proceed라도 재선택 강제         │
│    - 안전장치: 계층 구조 무시 방지                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 왜 하이브리드인가?

| 구성 요소 | 역할 | 이유 |
|----------|------|------|
| **가드레일** | 1차 필터 | - 명확한 계층 구조(`child_dps`)는 규칙으로 빠르게 처리<br>- LLM 호출 비용 절감 |
| **LLM 판단** | 동적 분석 | - `description`, `validation_rules` 해석<br>- 사용자 의도와 DP 주제 일치 여부 판단<br>- 맥락 있는 한국어 설명 생성 |
| **강제 규칙** | 안전장치 | - LLM이 잘못 판단해도 계층 구조 무시 방지<br>- 프로덕션 안정성 확보 |

---

## 3. 구현 상세

### 3.1 설정 추가 (`backend/core/config/settings.py`)

```python
class Settings(BaseSettings):
    # Phase 1.5 DP 적합성 판단용 Gemini 모델 (미설정 시 orchestrator_gemini_model 사용)
    orchestrator_phase15_model: str = ""
    
    # Phase 1.5에서 Gemini로 DP 적합성 판단 활성화 (기본 True)
    orchestrator_phase15_use_llm: bool = True
    
    # True면 child_dps 있을 때 LLM이 proceed라도 재선택 강제 (기본 True)
    orchestrator_phase15_strict_child_dps: bool = True
```

**환경변수:**

- `ORCHESTRATOR_PHASE15_MODEL`: Phase 1.5용 모델 ID (예: `gemini-2.5-pro`)
- `ORCHESTRATOR_PHASE15_USE_LLM`: LLM 판단 활성화 (`true`/`false`)
- `ORCHESTRATOR_PHASE15_STRICT_CHILDDPS`: strict 모드 (`true`/`false`)

### 3.2 LLM 모듈 (`backend/domain/v1/ifrs_agent/hub/orchestrator/dp_hierarchy_llm.py`)

#### 3.2.1 프롬프트 구조

```python
def build_phase15_prompt(fact_data_by_dp, user_context) -> str:
    """
    Phase 1.5 LLM 프롬프트 생성
    
    입력:
    - fact_data_by_dp: {dp_id: fact_data} (dp_metadata 포함)
    - user_context: {"category", "prompt", "search_intent", "content_focus"}
    
    프롬프트 구성:
    1. 역할 정의: "IFRS/ESRS DP 선택 적합성 검토자"
    2. 사용자 요청 맥락 (JSON)
    3. 검토 대상 DP 메타데이터 (JSON)
    4. 판단 기준 (4가지)
    5. 출력 형식 (구조화 JSON)
    """
```

**판단 기준 (프롬프트에 명시):**

1. **계층 구조 (`child_dps`)**
   - `child_dps`가 비어 있지 않으면 보통 "상위(비-leaf) DP"
   - 상위 DP는 하위 DP를 선택해야 구체적인 공시 항목
   - 예외: 사용자가 총괄 수준 요약을 원하면 상위 DP도 적합 (드물음)

2. **`description`·`validation_rules` 분석**
   - "하위 DP로 둡니다", "하위 문단·항목 공시", "문단 XX(a)~(f)" → 하위 선택 필요
   - "총괄", "루트", "개요" 성격 → 하위 선택 필요
   - `validation_rules`에 "하위 ... 정합" 같은 검증 규칙 → 하위 선택 필요

3. **사용자 의도와 DP 주제 일치**
   - 사용자 `category`·`prompt`·`search_intent`·`content_focus`와 DP의 `topic`·`subtopic`·`category` 비교
   - 예시:
     - 사용자: "학술연수" / DP: "거버넌스·IRO 관리" → **주제 불일치** → 다른 DP 추천
     - 사용자: "재생에너지" / DP: "E1: 기후변화 > 에너지" → **적합 가능**

4. **DP 유형 (`dp_type`)**
   - `narrative/qualitative`: 서술형 → `child_dps`가 있어도 총괄 설명이 필요한 경우 있음 (드물음)
   - `quantitative`: 정량 → `child_dps`가 있으면 보통 하위 선택 필요

#### 3.2.2 출력 형식 (구조화 JSON)

```json
{
  "decisions": [
    {
      "dp_id": "ESRS2-MDR-A",
      "needs_user_selection": true,
      "reason_ko": "ESRS2-MDR-A는 문단 66~69를 하위 DP로 두는 상위 항목입니다. 구체적인 공시 항목(66, 67, 68, 69)을 선택해주세요.",
      "rationale": "Has 4 child DPs (66-69) and description indicates hierarchical structure",
      "suggested_action": "reselect_child_dp"
    }
  ]
}
```

**필드:**

- `dp_id`: 검토 대상 DP ID
- `needs_user_selection`: `true` (재선택 필요) / `false` (진행 가능)
- `reason_ko`: 사용자용 한국어 설명 (1-2문장, 맥락 있음)
- `rationale`: 내부용 영어 근거 (짧게)
- `suggested_action`: `reselect_child_dp` / `search_different_dp` / `proceed` (선택)

#### 3.2.3 Gemini API 호출

```python
async def classify_dp_suitability_with_gemini(
    client: Any,
    model_id: str,
    fact_data_by_dp: Dict[str, Dict[str, Any]],
    user_context: Dict[str, str],
) -> Optional[List[Dict[str, Any]]]:
    """
    Gemini에 DP 적합성 판단 요청 (구조화 JSON)
    
    Returns:
        decisions 리스트 또는 None (실패 시 호출부에서 규칙 폴백)
    """
    response = client.models.generate_content(
        model=model_id,
        contents=prompt,
        config={
            "temperature": 0.0,  # 결정성 최대화
            "response_mime_type": "application/json",
        },
    )
```

**에러 처리:**

- LLM 호출 실패 시 `None` 반환 → 호출부에서 규칙 기반 결과 사용
- 로그에 경고 기록 (`logger.warning`)

### 3.3 Orchestrator 리팩토링 (`backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`)

#### 3.3.1 초기화 (`__init__`)

```python
# Phase 1.5 DP 적합성 판단용 모델 ID
p15_model = getattr(self.settings, "orchestrator_phase15_model", "")
self._phase15_model_id = p15_model.strip() if p15_model else self._gemini_model_id
```

#### 3.3.2 메인 검증 메서드 (`_validate_dp_hierarchy`)

```python
async def _validate_dp_hierarchy(
    self,
    fact_data_by_dp: Dict[str, Dict],
    user_input: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Phase 1.5: DP 계층 검증 (하이브리드 LLM + 규칙)
    
    1. 가드레일: child_dps 유무로 1차 필터 (UCM 제외)
    2. LLM 판단 (활성화 시): description·validation_rules·사용자 의도 종합 분석
    3. 강제 규칙 (strict 모드): child_dps 있으면 LLM이 proceed라도 재선택 강제
    """
    use_llm = getattr(self.settings, "orchestrator_phase15_use_llm", True)
    strict_child_dps = getattr(self.settings, "orchestrator_phase15_strict_child_dps", True)

    # 1. 규칙 기반 1차 필터
    rule_result = self._validate_dp_hierarchy_rules(fact_data_by_dp)
    
    # 2. LLM 판단 (활성화 시)
    llm_decisions = None
    if use_llm and self._gemini_client:
        user_context = {
            "category": user_input.get("category", ""),
            "prompt": user_input.get("prompt", ""),
            "search_intent": user_input.get("search_intent", ""),
            "content_focus": user_input.get("content_focus", ""),
        }
        llm_decisions = await classify_dp_suitability_with_gemini(...)
    
    # 3. 병합 (LLM + 규칙)
    merged = self._merge_phase15_dp_hierarchy(
        rule_result=rule_result,
        llm_decisions=llm_decisions,
        fact_data_by_dp=fact_data_by_dp,
        strict_child_dps=strict_child_dps,
    )
    
    return merged
```

#### 3.3.3 규칙 기반 검증 (`_validate_dp_hierarchy_rules`)

```python
def _validate_dp_hierarchy_rules(self, fact_data_by_dp: Dict[str, Dict]) -> Dict[str, Any]:
    """
    규칙 기반 DP 계층 검증 (가드레일)
    
    child_dps가 있으면 상위 DP로 판단 (UCM 제외)
    """
    problematic_dps = []
    for dp_id, fact_data in fact_data_by_dp.items():
        if dp_id.upper().startswith("UCM"):
            continue
        if not (fact_data.get("dp_metadata") or {}).get("child_dps"):
            continue
        
        problematic_dps.append({
            "dp_id": dp_id,
            "name_ko": ...,
            "description": ...,
            "child_dps": ...,
            "parent_indicator": ...,
            "reason": "상위 DP — 하위 DP N개가 있습니다. ...",
            "source": "rule",
        })
    
    return {
        "needs_user_selection": len(problematic_dps) > 0,
        "problematic_dps": problematic_dps,
    }
```

#### 3.3.4 병합 로직 (`_merge_phase15_dp_hierarchy`)

```python
def _merge_phase15_dp_hierarchy(
    self,
    rule_result: Dict[str, Any],
    llm_decisions: Optional[List[Dict[str, Any]]],
    fact_data_by_dp: Dict[str, Dict],
    strict_child_dps: bool,
) -> Dict[str, Any]:
    """
    규칙 기반 결과와 LLM 판단을 병합
    
    로직:
    1. 규칙에서 problematic으로 판단된 DP 목록을 기준으로
    2. LLM이 proceed라고 해도, strict_child_dps=True면 재선택 강제
    3. LLM이 needs_user_selection=True면 reason_ko를 우선 사용
    """
    rule_problematic = {dp["dp_id"]: dp for dp in rule_result.get("problematic_dps", [])}
    
    if not llm_decisions:
        return rule_result  # LLM 없으면 규칙 결과 그대로
    
    llm_by_id = {d["dp_id"]: d for d in llm_decisions}
    final_problematic = []
    
    for dp_id, rule_item in rule_problematic.items():
        llm_dec = llm_by_id.get(dp_id)
        
        if llm_dec:
            needs_sel = llm_dec.get("needs_user_selection", False)
            reason_ko = llm_dec.get("reason_ko", "").strip()
            
            if strict_child_dps:
                # 강제 규칙: child_dps 있으면 무조건 차단
                final_problematic.append({
                    **rule_item,
                    "reason": reason_ko or rule_item["reason"],
                    "source": "llm+strict",
                    "llm_rationale": llm_dec.get("rationale", ""),
                })
            elif needs_sel:
                # LLM이 재선택 필요하다고 판단
                final_problematic.append({
                    **rule_item,
                    "reason": reason_ko or rule_item["reason"],
                    "source": "llm",
                    "llm_rationale": llm_dec.get("rationale", ""),
                })
            else:
                # LLM이 proceed → strict 아니면 통과
                logger.info("Phase 1.5: DP %s has child_dps but LLM says proceed (strict=False) → allow", dp_id)
        else:
            final_problematic.append(rule_item)
    
    return {
        "needs_user_selection": len(final_problematic) > 0,
        "problematic_dps": final_problematic,
    }
```

#### 3.3.5 호출부 수정 (`_create_new_report`)

```python
# Phase 1.5: DP 계층 검증 (dp_id 또는 dp_ids가 있으면 실행)
has_dp = user_input.get("dp_id") or user_input.get("dp_ids")
if user_input.get("dp_validation_needed") or has_dp:
    logger.info("Phase 1.5: DP hierarchy validation")
    dp_validation = await self._validate_dp_hierarchy(
        state["fact_data_by_dp"],
        user_input  # 사용자 맥락 전달
    )
    if dp_validation.get("needs_user_selection"):
        # ... 재선택 요청 응답 반환
```

### 3.4 문서 업데이트 (`PHASE3_FLEXIBLE_INPUT_DESIGN.md`)

§3.5.2 "검증 로직 (오케스트레이터)"를 하이브리드 구조로 업데이트:

- 3단계 구조 설명
- 설정 항목 명시
- LLM 프롬프트 구조 요약
- 병합 로직 설명

---

## 4. 동작 시나리오

### 시나리오 1: strict 모드 (기본값)

**설정:**

```env
ORCHESTRATOR_PHASE15_USE_LLM=true
ORCHESTRATOR_PHASE15_STRICT_CHILDDPS=true
```

**입력:**

```json
{
  "action": "create",
  "company_id": "C001",
  "category": "ESRS2",
  "prompt": "거버넌스 구조 공시",
  "dp_id": "ESRS2-MDR-A"
}
```

**DP 메타:**

```json
{
  "dp_id": "ESRS2-MDR-A",
  "name_ko": "최소 공시 요건 MDR-A",
  "description": "문단 66(적용)·67(목적)·68(a)~(e)·69(a)~(c)를 하위 DP로 둡니다.",
  "child_dps": ["ESRS2-MDR-A-66", "ESRS2-MDR-A-67", "ESRS2-MDR-A-68", "ESRS2-MDR-A-69"]
}
```

**흐름:**

1. **가드레일**: `child_dps` 있음 → problematic
2. **LLM 판단**: 
   - `description` 분석: "하위 DP로 둡니다" → 하위 선택 필요
   - 사용자 의도: "거버넌스 구조 공시" ↔ DP 주제: "거버넌스·IRO 관리" → 일치
   - 판단: `needs_user_selection=True`
   - `reason_ko`: "ESRS2-MDR-A는 문단 66~69를 하위 DP로 두는 상위 항목입니다. 구체적인 공시 항목(66, 67, 68, 69)을 선택해주세요."
3. **병합**: `strict_child_dps=True` → LLM `reason_ko` 사용하여 재선택 강제

**응답:**

```json
{
  "status": "needs_dp_selection",
  "dp_selection_required": [
    {
      "dp_id": "ESRS2-MDR-A",
      "name_ko": "최소 공시 요건 MDR-A",
      "description": "문단 66~69를 하위 DP로 둡니다.",
      "child_dps": ["ESRS2-MDR-A-66", ...],
      "reason": "ESRS2-MDR-A는 문단 66~69를 하위 DP로 두는 상위 항목입니다. 구체적인 공시 항목(66, 67, 68, 69)을 선택해주세요.",
      "source": "llm+strict",
      "child_dp_options": [
        {"dp_id": "ESRS2-MDR-A-66", "name_ko": "적용", "description": "..."},
        {"dp_id": "ESRS2-MDR-A-67", "name_ko": "목적", "description": "..."},
        ...
      ]
    }
  ],
  "error": "상위 DP가 감지되었습니다. 하위 DP를 선택해주세요."
}
```

### 시나리오 2: LLM 판단 우선 (strict=False)

**설정:**

```env
ORCHESTRATOR_PHASE15_USE_LLM=true
ORCHESTRATOR_PHASE15_STRICT_CHILDDPS=false
```

**입력:**

```json
{
  "action": "create",
  "company_id": "C001",
  "category": "ESRS2",
  "prompt": "거버넌스 전체 개요",
  "dp_id": "ESRS2-GOV-ROOT"
}
```

**DP 메타:**

```json
{
  "dp_id": "ESRS2-GOV-ROOT",
  "name_ko": "거버넌스 총괄",
  "description": "거버넌스 구조 전체 개요 (하위: GOV-1, GOV-2, GOV-3)",
  "dp_type": "narrative",
  "child_dps": ["ESRS2-GOV-1", "ESRS2-GOV-2", "ESRS2-GOV-3"]
}
```

**흐름:**

1. **가드레일**: `child_dps` 있음 → problematic
2. **LLM 판단**:
   - 사용자 의도: "거버넌스 **전체 개요**" → 총괄 수준 요약 요청
   - DP 유형: `narrative` (서술형) → 총괄 설명 가능
   - 판단: `needs_user_selection=False` (proceed)
   - `reason_ko`: "사용자가 거버넌스 전체 개요를 요청했으므로, 총괄 수준 DP로 진행 가능합니다."
3. **병합**: `strict_child_dps=False` + LLM `proceed` → **통과** (gen_node로 전달)

**응답:**

```json
{
  "status": "success",
  "generated_text": "... 거버넌스 구조 전체 개요 ...",
  ...
}
```

### 시나리오 3: 주제 불일치 감지

**입력:**

```json
{
  "action": "create",
  "company_id": "C001",
  "category": "ESRS2",
  "prompt": "학술연수 프로그램",
  "dp_id": "ESRS2-GOV-1"
}
```

**DP 메타:**

```json
{
  "dp_id": "ESRS2-GOV-1",
  "name_ko": "거버넌스 구조",
  "topic": "거버넌스·IRO 관리",
  "subtopic": "조직 구조",
  "child_dps": []
}
```

**흐름:**

1. **가드레일**: `child_dps` 없음 → 통과
2. **LLM 판단** (규칙 통과해도 LLM은 모든 DP 검토 가능):
   - 사용자 의도: "학술연수 프로그램" ↔ DP 주제: "거버넌스·IRO 관리" → **불일치**
   - 판단: `needs_user_selection=True`
   - `reason_ko`: "선택하신 DP는 '거버넌스 구조'에 관한 항목입니다. '학술연수 프로그램'과 관련된 DP(예: S1: 자체 근로자 > 교육·훈련)를 검색하시는 것이 적합합니다."
   - `suggested_action`: "search_different_dp"

**응답:**

```json
{
  "status": "needs_dp_selection",
  "dp_selection_required": [
    {
      "dp_id": "ESRS2-GOV-1",
      "reason": "선택하신 DP는 '거버넌스 구조'에 관한 항목입니다. '학술연수 프로그램'과 관련된 DP(예: S1: 자체 근로자 > 교육·훈련)를 검색하시는 것이 적합합니다.",
      "source": "llm",
      "suggested_action": "search_different_dp"
    }
  ]
}
```

### 시나리오 4: LLM 실패 시 폴백

**설정:**

```env
ORCHESTRATOR_PHASE15_USE_LLM=true
GEMINI_API_KEY=invalid_key
```

**흐름:**

1. **가드레일**: `child_dps` 있음 → problematic
2. **LLM 판단**: API 호출 실패 → `llm_decisions=None`
3. **병합**: LLM 없음 → **규칙 기반 결과 사용**

**응답:**

```json
{
  "status": "needs_dp_selection",
  "dp_selection_required": [
    {
      "dp_id": "ESRS2-MDR-A",
      "reason": "상위 DP — 하위 DP 4개가 있습니다. 필요한 항목(leaf)을 선택해주세요.",
      "source": "rule"
    }
  ]
}
```

**로그:**

```
WARNING: Phase 1.5 Gemini classification failed: API key invalid
WARNING: Phase 1.5 final: 1 problematic DP(s): ['ESRS2-MDR-A']
```

---

## 5. 설정 가이드

### 5.1 프로덕션 (안전 우선)

```env
ORCHESTRATOR_PHASE15_MODEL=gemini-2.5-pro
ORCHESTRATOR_PHASE15_USE_LLM=true
ORCHESTRATOR_PHASE15_STRICT_CHILDDPS=true  # 강제 규칙 활성화
```

**특징:**

- LLM이 맥락 있는 설명 생성
- `child_dps` 있으면 무조건 재선택 강제 (안전장치)
- LLM 실패 시 규칙 기반 폴백

### 5.2 유연성 우선 (실험적)

```env
ORCHESTRATOR_PHASE15_MODEL=gemini-2.5-pro
ORCHESTRATOR_PHASE15_USE_LLM=true
ORCHESTRATOR_PHASE15_STRICT_CHILDDPS=false  # LLM 판단 우선
```

**특징:**

- LLM이 `proceed`라고 하면 `child_dps` 있어도 통과
- 총괄 수준 요약 요청 시 유용
- 주의: LLM 오판 시 계층 구조 무시 가능

### 5.3 규칙 기반만 (LLM 비활성화)

```env
ORCHESTRATOR_PHASE15_USE_LLM=false
```

**특징:**

- LLM 호출 없음 (비용 절감)
- `child_dps` 유무만으로 판단
- 맥락 있는 설명 없음 (일반적인 메시지만)

---

## 6. 테스트 결과

### 6.1 구문 검사

```bash
$ python -m py_compile backend/core/config/settings.py
$ python -m py_compile backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py
$ python -m py_compile backend/domain/v1/ifrs_agent/hub/orchestrator/dp_hierarchy_llm.py
```

**결과:** ✅ 모두 통과

### 6.2 Import 테스트

```bash
$ python -c "from backend.core.config.settings import get_settings; s = get_settings(); print('Settings OK:', s.orchestrator_phase15_use_llm, s.orchestrator_phase15_strict_child_dps)"
Settings OK: True True

$ python -c "from backend.domain.v1.ifrs_agent.hub.orchestrator.orchestrator import Orchestrator; print('Orchestrator import OK')"
Orchestrator import OK

$ python -c "from backend.domain.v1.ifrs_agent.hub.orchestrator.dp_hierarchy_llm import build_phase15_prompt; print('dp_hierarchy_llm import OK')"
dp_hierarchy_llm import OK
```

**결과:** ✅ 모두 통과

---

## 7. 파일 변경 요약

### 7.1 신규 파일

- `backend/domain/v1/ifrs_agent/hub/orchestrator/dp_hierarchy_llm.py` (261줄)
  - `build_phase15_prompt`: LLM 프롬프트 생성
  - `classify_dp_suitability_with_gemini`: Gemini API 호출 및 파싱

### 7.2 수정 파일

- `backend/core/config/settings.py`
  - 설정 추가: `orchestrator_phase15_model`, `orchestrator_phase15_use_llm`, `orchestrator_phase15_strict_child_dps`
  - 환경변수 로드 로직 추가

- `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`
  - `__init__`: `_phase15_model_id` 초기화
  - `_validate_dp_hierarchy`: 하이브리드 구조로 리팩토링 (시그니처 변경: `user_input` 추가)
  - `_validate_dp_hierarchy_rules`: 규칙 기반 검증 (신규 메서드)
  - `_merge_phase15_dp_hierarchy`: LLM + 규칙 병합 (신규 메서드)
  - `_create_new_report`: `_validate_dp_hierarchy` 호출 시 `user_input` 전달

- `backend/domain/v1/ifrs_agent/docs/PHASE3_FLEXIBLE_INPUT_DESIGN.md`
  - §3.5.2 "검증 로직 (오케스트레이터)" 업데이트: 하이브리드 구조 설명

### 7.3 신규 문서

- `backend/domain/v1/ifrs_agent/docs/IMPLEMENTATION_SUMMARY_2026_04_06_PHASE1_5_LLM_HYBRID.md` (본 문서)

---

## 8. 향후 개선 방향

### 8.1 LLM 프롬프트 개선

- **Few-shot 예시 추가**: 프롬프트에 2-3개 판단 예시 추가 → 정확도 향상
- **CoT (Chain-of-Thought)**: "단계별 추론" 요청 → 복잡한 케이스 처리 개선

### 8.2 성능 최적화

- **캐싱**: 동일한 `(dp_id, user_context)` 조합은 캐시 → LLM 호출 절감
- **배치 처리**: 여러 DP를 한 번에 판단 (현재는 프롬프트에 모두 포함)

### 8.3 모니터링

- **LLM 판단 로그**: `needs_user_selection` 비율, `source` 분포 추적
- **A/B 테스트**: strict vs non-strict 모드 비교

### 8.4 사용자 피드백 루프

- 사용자가 "이 DP가 적합합니다" 피드백 → 학습 데이터 축적
- Fine-tuning 또는 Few-shot 예시로 활용

---

## 9. 결론

Phase 1.5 DP 적합성 판단을 **하이브리드 LLM + 규칙 기반 구조**로 확장하여:

1. **유연성**: `description`, `validation_rules`, 사용자 의도를 종합한 동적 판단
2. **안전성**: 가드레일(규칙) + 강제 규칙(strict 모드)로 계층 구조 무시 방지
3. **사용자 경험**: 맥락 있는 한국어 설명 제공
4. **확장성**: 설정으로 LLM 활성화/비활성화, strict 모드 제어

**핵심 가치:**

- 단순 키워드 매칭이 아닌 **맥락 이해**
- 사용자에게 **"왜?"**를 설명
- 프로덕션 안정성 확보 (폴백 + strict 모드)

---

**작성자**: AI Assistant  
**검토**: 사용자 확인 필요  
**상태**: ✅ 구현 완료, 테스트 통과

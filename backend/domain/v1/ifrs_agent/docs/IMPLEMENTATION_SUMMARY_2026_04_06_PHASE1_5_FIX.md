# Phase 1.5 DP 계층 검증 수정 완료

**작성일**: 2026-04-06  
**목적**: `child_dps` 있는 상위 DP 선택 시 사용자에게 하위 DP 재선택 요청 기능 수정

---

## 문제 상황

### 요청

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "임직원 역량개발",
  "prompt": "학술연수에 대해 작성해봐",
  "dp_id": "ESRS2-MDR-A",  // ← child_dps 10개 있는 상위 DP
  "ref_pages": {},
  "max_retries": 3
}
```

### 기대 동작 (PHASE3 문서 기준)

`ESRS2-MDR-A`는 `child_dps`가 10개 있는 **비-leaf DP**이므로:

1. Phase 1.5에서 검증 실패
2. `status: "needs_dp_selection"` 반환
3. `dp_selection_required`에 하위 DP 목록 + 메타데이터 포함

### 실제 응답 (수정 전)

```json
{
    "status": "failed",
    "dp_selection_required": null,  // ❌
    "error": "상위 DP가 감지되었습니다. 하위 DP를 선택해주세요."
}
```

---

## 원인 분석

### 1. Phase 1.5 조건문 누락

```python
# orchestrator.py Line 132 (수정 전)
if user_input.get("dp_validation_needed") or user_input.get("dp_ids"):
```

- `dp_ids` (복수형)만 체크 → 요청의 `dp_id` (단수형)는 **스킵**됨
- `dp_validation_needed: false`이므로 Phase 1.5 자체가 실행 안 됨

### 2. `parent_indicator` 조건 과도

```python
# orchestrator.py Line 1090 (수정 전)
if is_parent and parent_indicator is None:
    problematic_dps.append(...)
```

- `parent_indicator: "ESRS2-MDR"`처럼 값이 있으면 **통과**시킴
- PHASE3 §6.3: "`child_dps` 비어 있지 않음 = 비-leaf"만으로 충분

### 3. `child_dps` ID만 반환

- UI에서 드롭다운을 만들려면 `name_ko`, `description` 등 메타 필요
- 기존 구조는 **ID 문자열 배열**만 반환

---

## 수정 내용

### 1. Phase 1.5 조건문 수정

**파일**: `hub/orchestrator/orchestrator.py`

```python
# Line 131-143 (수정 후)
# Phase 1.5: DP 계층 검증 (dp_id 또는 dp_ids가 있으면 실행)
has_dp = user_input.get("dp_id") or user_input.get("dp_ids")
if user_input.get("dp_validation_needed") or has_dp:
    logger.info("Phase 1.5: DP hierarchy validation")
    dp_validation = await self._validate_dp_hierarchy(state["fact_data_by_dp"])
    if dp_validation.get("needs_user_selection"):
        logger.warning("DP hierarchy validation failed - needs user selection")
        # child_dps 메타데이터 enrich
        enriched = await self._enrich_child_dps_metadata(dp_validation.get("problematic_dps", []))
        return {
            "status": "needs_dp_selection",
            "dp_selection_required": enriched,
            "error": "상위 DP가 감지되었습니다. 하위 DP를 선택해주세요.",
            "prompt_interpretation": phase0,
        }
```

**변경점**:
- `dp_id` (단수형) 지원 추가
- `_enrich_child_dps_metadata` 호출로 메타 확장

---

### 2. `_validate_dp_hierarchy` 로직 단순화

**파일**: `hub/orchestrator/orchestrator.py`

```python
# Line 1040-1109 (수정 후)
async def _validate_dp_hierarchy(self, fact_data_by_dp: Dict[str, Dict]) -> Dict[str, Any]:
    """
    상위(비-leaf) DP — child_dps가 하나라도 있으면 사용자에게 하위 DP 선택을 요청한다.
    
    parent_indicator가 채워져 있어도 하위 목록이 있으면 leaf가 아니므로 동일하게 차단한다.
    """
    problematic_dps = []
    
    for dp_id, fact_data in fact_data_by_dp.items():
        if not fact_data or fact_data.get("error"):
            continue
        
        dp_meta = fact_data.get("dp_metadata") or {}
        child_dps = dp_meta.get("child_dps") or []
        parent_indicator = dp_meta.get("parent_indicator")
        description = dp_meta.get("description", "")
        
        # UCM은 제외
        if dp_id.upper().startswith("UCM"):
            continue
        
        # 비-leaf: DB에 하위 DP가 하나 이상이면 공시 단위가 아님
        if not child_dps:
            continue
        
        reason = f"상위 DP — 하위 DP {len(child_dps)}개가 있습니다. 필요한 항목(leaf)을 선택해주세요."
        if parent_indicator:
            reason += f" (parent_indicator: {parent_indicator})"
        
        problematic_dps.append({
            "dp_id": dp_id,
            "name_ko": dp_meta.get("name_ko", dp_id),
            "description": description[:200] if description else "",
            "child_dps": child_dps,
            "parent_indicator": parent_indicator,
            "reason": reason
        })
    
    return {
        "needs_user_selection": len(problematic_dps) > 0,
        "problematic_dps": problematic_dps
    }
```

**변경점**:
- `parent_indicator is None` 조건 **제거**
- `child_dps`가 비어 있지 않으면 **무조건 차단**

---

### 3. `_enrich_child_dps_metadata` 추가

**파일**: `hub/orchestrator/orchestrator.py`

```python
# Line 1111-1159 (신규)
async def _enrich_child_dps_metadata(self, problematic_dps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    problematic_dps의 각 child_dps ID 배열을 메타데이터(name_ko, description 등)로 enrich한다.
    
    Returns:
        enriched problematic_dps with child_dp_options: [{"dp_id", "name_ko", "description", ...}]
    """
    enriched = []
    for item in problematic_dps:
        child_dp_ids = item.get("child_dps") or []
        child_options = []
        
        for child_id in child_dp_ids:
            try:
                # dp_query 툴로 메타 조회
                meta = await self.infra.call_tool(
                    "query_dp_metadata",
                    {"dp_id": child_id}
                )
                if meta:
                    child_options.append({
                        "dp_id": child_id,
                        "name_ko": meta.get("name_ko", child_id),
                        "name_en": meta.get("name_en", ""),
                        "description": meta.get("description", "")[:150],
                        "dp_type": meta.get("dp_type"),
                        "unit": meta.get("unit"),
                    })
                else:
                    child_options.append({"dp_id": child_id, "name_ko": child_id})
            except Exception as e:
                logger.warning(f"Failed to fetch metadata for child DP {child_id}: {e}")
                child_options.append({"dp_id": child_id, "name_ko": child_id})
        
        enriched.append({
            **item,
            "child_dp_options": child_options,  # UI용 메타데이터
        })
    
    return enriched
```

**효과**:
- 각 `child_dps` ID에 대해 `data_points` 테이블 조회
- `name_ko`, `description`, `dp_type`, `unit` 등 UI에 필요한 정보 추가
- 프론트엔드에서 드롭다운 라벨로 바로 사용 가능

---

## 수정 후 응답 예시

### 요청 (동일)

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "임직원 역량개발",
  "dp_id": "ESRS2-MDR-A"
}
```

### 응답 (수정 후)

```json
{
    "status": "needs_dp_selection",
    "dp_selection_required": [
        {
            "dp_id": "ESRS2-MDR-A",
            "name_ko": "최소 공시 요건 MDR-A: 조치 및 자원",
            "description": "문단 66(적용)·67(목적)·68(a)~(e)·69(a)~(c)를 하위 DP로 둡니다. 유의적 OpEx·CapEx가 필요할 때 69 적용.",
            "child_dps": [
                "ESRS2-MDR-A-66",
                "ESRS2-MDR-A-67",
                "ESRS2-MDR-A-68-a",
                "ESRS2-MDR-A-68-b",
                "ESRS2-MDR-A-68-c",
                "ESRS2-MDR-A-68-d",
                "ESRS2-MDR-A-68-e",
                "ESRS2-MDR-A-69-a",
                "ESRS2-MDR-A-69-b",
                "ESRS2-MDR-A-69-c"
            ],
            "parent_indicator": "ESRS2-MDR",
            "reason": "상위 DP — 하위 DP 10개가 있습니다. 필요한 항목(leaf)을 선택해주세요. (parent_indicator: ESRS2-MDR)",
            "child_dp_options": [
                {
                    "dp_id": "ESRS2-MDR-A-66",
                    "name_ko": "문단 66: 적용",
                    "name_en": "Paragraph 66: Application",
                    "description": "MDR-A 적용 범위 및 조건",
                    "dp_type": "narrative",
                    "unit": null
                },
                {
                    "dp_id": "ESRS2-MDR-A-67",
                    "name_ko": "문단 67: 목적",
                    "name_en": "Paragraph 67: Objective",
                    "description": "MDR-A 공시 목적",
                    "dp_type": "narrative",
                    "unit": null
                },
                // ... 나머지 8개
            ]
        }
    ],
    "error": "상위 DP가 감지되었습니다. 하위 DP를 선택해주세요.",
    "prompt_interpretation": {
        "search_intent": "학술연수 제도",
        "content_focus": "임직원 역량 강화를 위한 학술연수 제도에 대해 설명할 것",
        "ref_pages": {"2024": null, "2023": null},
        "dp_validation_needed": false
    }
}
```

---

## 테스트 추가

**파일**: `tests/test_orchestrator_dp_routing_integration.py`

### 1. `test_validate_dp_hierarchy_non_leaf_with_parent_indicator`

- `parent_indicator`가 있어도 `child_dps`가 있으면 차단되는지 확인

### 2. `test_enrich_child_dps_metadata`

- `child_dps` ID 배열이 메타데이터로 확장되는지 확인
- `child_dp_options`에 `name_ko`, `description` 등 포함 확인

### 3. `test_validate_dp_hierarchy_skips_ucm`

- UCM 계열은 검증 제외 확인

### 4. `test_validate_dp_hierarchy_leaf_ok`

- `child_dps`가 비어 있으면 통과 확인

---

## 문서 업데이트

### `PHASE3_FLEXIBLE_INPUT_DESIGN.md`

- §3.5.2: 구현 기준 명시 (`parent_indicator` 조건 제거, `child_dps`만으로 판단)
- §3.5.3: `child_dp_options` 필드 예시 추가
- §7: 구현 순서 체크리스트 업데이트 (6.1, 6.2 추가)
- §8: 현재 코드 참조에 수정 날짜 표기

---

## 영향 범위

### 변경된 파일

1. `hub/orchestrator/orchestrator.py`
   - Phase 1.5 조건문 수정 (Line 131-143)
   - `_validate_dp_hierarchy` 로직 단순화 (Line 1040-1109)
   - `_enrich_child_dps_metadata` 추가 (Line 1111-1159)

2. `tests/test_orchestrator_dp_routing_integration.py`
   - 단위 테스트 4개 추가

3. `docs/PHASE3_FLEXIBLE_INPUT_DESIGN.md`
   - §3.5.2, §3.5.3, §7, §8 업데이트

### 하위 호환성

- ✅ `dp_id` (단수형) 요청 지원 추가 (기존 `dp_ids`도 유지)
- ✅ `child_dps` 필드는 기존과 동일 (ID 배열)
- ✅ `child_dp_options` 필드 추가 (신규, 선택적 사용)

---

## 다음 단계

### 프론트엔드 연동

`dp_selection_required[].child_dp_options`를 사용하여:

1. 드롭다운 라벨에 `name_ko` 표시
2. 툴팁/설명에 `description` 표시
3. 선택 후 `dp_ids: [선택한 leaf DP ID]`로 재요청

### 추가 개선 (선택)

- `child_dp_options`에 `child_dps` 여부 표시 (중첩 계층 표현)
- 재귀적 계층 탐색 (현재는 1단계만)
- `validation_rules` 기반 필터링 (특정 조건 하위만 표시)

---

## 요약

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| **Phase 1.5 실행 조건** | `dp_ids` (복수형)만 | `dp_id` (단수형) + `dp_ids` 모두 |
| **비-leaf 판단** | `child_dps` + `parent_indicator is None` | `child_dps` 비어 있지 않음 |
| **반환 필드** | `child_dps: [ID 배열]` | `child_dps` + `child_dp_options: [{메타}]` |
| **UI 편의성** | ID만 (프론트 추가 조회 필요) | 메타 포함 (즉시 사용 가능) |
| **테스트** | 없음 | 단위 테스트 4개 추가 |

**결과**: `ESRS2-MDR-A` 같은 상위 DP 선택 시 **즉시 차단 + 하위 DP 목록 + 메타데이터 반환** 완료

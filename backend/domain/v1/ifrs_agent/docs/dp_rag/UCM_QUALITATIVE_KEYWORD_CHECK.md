# UCM 정성 키워드 체크 로직

**작성일**: 2026-04-05  
**목적**: UCM 전용 DP에서 정성/정량 판단을 위한 키워드 기반 체크 로직

---

## 배경

### 문제 상황

UCM 전용 DP (예: `UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i`)는 `data_points` 테이블에 존재하지 않고 `unified_column_mappings` 테이블에만 존재합니다.

이 경우:
- `dp_meta = None` (data_points에 없음)
- `dp_type`이 기본값 `"quantitative"`로 설정됨
- 실제로는 정성적 DP임에도 불구하고 LLM 매핑 → 실데이터 조회가 진행됨
- 결과: **정성 DP가 정량 데이터를 반환하는 버그**

### 실제 사례

```json
{
  "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
  "value": 473.9674,  // ❌ 정성 DP인데 정량 값 반환
  "unit": null,
  "ucm": {
    "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
    "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이 반영되는지와 방법을 공개합니다."
  },
  "suitability_warning": "UCM description suggests qualitative/narrative (keywords: 여부, 방법을) — 수치만으로 부족할 수 있음"
}
```

**문제점**:
- `suitability_warning`에서 정성 키워드를 감지했지만, 이미 실데이터 조회가 완료된 후
- 경고만 표시하고 실제 처리는 정량으로 진행됨

---

## 해결 방안

### 핵심 아이디어

UCM의 `column_description`, `column_name_ko`, `column_name_en`에서 **정성적 키워드**를 체크하여, `dp_meta`가 없어도 정성 DP로 판단할 수 있도록 합니다.

### 정성 키워드 목록

```python
_UCM_QUALITATIVE_KEYWORDS = [
    # 한국어
    "여부", "방법", "설명", "기술", "공개", "보고", "정책", "절차",
    "프로세스", "체계", "구조", "조직", "거버넌스", "전략", "계획",
    "목표", "이니셔티브", "프로그램", "활동", "조치", "대응", "관리",
    "평가", "검토", "분석", "식별", "파악", "고려", "반영", "통합",
    
    # 영어
    "whether", "how", "describe", "disclose", "report", "policy",
    "procedure", "process", "structure", "governance", "strategy"
]
```

**선정 기준**:
1. **서술형 요구**: "여부", "방법", "설명", "기술"
2. **공시 행위**: "공개", "보고", "disclose", "report"
3. **정책/체계**: "정책", "절차", "프로세스", "체계", "구조"
4. **전략/계획**: "전략", "계획", "목표", "이니셔티브"
5. **관리/평가**: "관리", "평가", "검토", "분석"

### 구현 로직

```python
def _ucm_qualitative_keyword_hits(ucm_info: Optional[Dict[str, Any]]) -> int:
    """
    UCM의 column_description과 column_name_ko에서 정성적 키워드 출현 횟수 반환.
    """
    if not ucm_info:
        return 0
    
    text = ""
    if ucm_info.get("column_description"):
        text += ucm_info.get("column_description", "")
    if ucm_info.get("column_name_ko"):
        text += " " + ucm_info.get("column_name_ko", "")
    if ucm_info.get("column_name_en"):
        text += " " + ucm_info.get("column_name_en", "")
    
    text_lower = text.lower()
    hits = sum(1 for kw in _UCM_QUALITATIVE_KEYWORDS if kw in text_lower)
    return hits
```

### dp_rag 에이전트 적용

```python
# 2. DP 유형 체크 — 정성 DP는 실데이터 조회 생략
dp_type = (dp_meta.get("dp_type") if dp_meta else None) or "quantitative"
is_qualitative = dp_type in ("qualitative", "narrative", "binary")

# UCM 전용 DP (dp_meta=None)의 경우: UCM 정성적 키워드 체크
if not dp_meta and ucm_info:
    qualitative_hits = _ucm_qualitative_keyword_hits(ucm_info)
    if qualitative_hits >= 2:  # 2개 이상 키워드 발견 시 정성으로 판단
        is_qualitative = True
        dp_type = "narrative"
        logger.info(
            "dp_rag: UCM-only DP %s has %d qualitative keywords — treating as narrative",
            dp_id, qualitative_hits
        )

if is_qualitative:
    # 정성 DP: 실데이터 없음, description + rulebook만 반환
    return {
        "dp_id": dp_id,
        "value": None,  # ✅ 정성 DP는 수치 없음
        "dp_metadata": None,
        "ucm": _ucm_for_response(ucm_info),
        "rulebook": rulebook_payload,
        ...
    }
```

---

## 효과

### Before (버그)

```json
{
  "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
  "value": 473.9674,  // ❌ 정량 값 반환
  "suitability_warning": "UCM description suggests qualitative..."
}
```

### After (수정)

```json
{
  "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
  "value": null,  // ✅ 정성 DP는 null
  "ucm": {
    "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
    "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이 반영되는지와 방법을 공개합니다."
  },
  "rulebook": {
    "rulebook_content": "ESRS E1 - GOV-3 para 13. datapoint.json description 참고."
  }
}
```

---

## 임계값 설정

### 왜 2개 이상인가?

```python
if qualitative_hits >= 2:
    is_qualitative = True
```

**이유**:
1. **단일 키워드는 오탐 가능**: "관리" 하나만 있어도 정성으로 판단하면 "배출량 관리" 같은 정량 DP도 정성으로 오판
2. **2개 이상은 확실한 신호**: "여부·방법", "공개·보고", "정책·절차" 등 복수 키워드는 명확히 정성적 요구사항
3. **실험 결과**: UCM 전용 정성 DP는 대부분 2개 이상 키워드 포함

### 예시

| DP ID | column_name_ko | 키워드 | 판단 |
|-------|---------------|--------|------|
| `UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i` | "인센티브 제도에 기후 고려 반영 **여부·방법**" | 여부, 방법, 고려, 반영 (4개) | ✅ 정성 |
| `UCM_ESRSE1_E1_6` | "Scope 1 배출량" | 없음 (0개) | ✅ 정량 |
| `UCM_ESRSE1_E1_4` | "온실가스 배출 감축 목표" | 목표 (1개) | ⚠️ 경계 (임계값 2 → 정량 유지) |
| `UCM_ESRSE1_GOV_1_1` | "기후 관련 리스크·기회 **식별·평가** **프로세스** **설명**" | 식별, 평가, 프로세스, 설명 (4개) | ✅ 정성 |

---

## 한계 및 향후 개선

### 현재 한계

1. **키워드 기반 휴리스틱**: 완벽한 분류는 아님
2. **언어 의존성**: 한국어/영어 외 다국어 미지원
3. **임계값 고정**: 2개가 모든 케이스에 최적은 아닐 수 있음

### 향후 개선 방향

1. **LLM 기반 분류**:
   ```python
   # UCM description → LLM → "quantitative" or "qualitative"
   prompt = f"Is this data point quantitative or qualitative? {ucm_description}"
   ```

2. **UCM 테이블에 dp_type 추가**:
   ```sql
   ALTER TABLE unified_column_mappings 
   ADD COLUMN dp_type VARCHAR(20) DEFAULT 'quantitative';
   ```

3. **임계값 동적 조정**:
   - UCM description 길이에 따라 임계값 조정
   - 짧은 description (< 50자): 임계값 1
   - 긴 description (> 100자): 임계값 3

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `dp_rag/agent.py` | 정성 키워드 체크 로직 구현 |
| `tests/test_orchestrator_dp_routing_integration.py` | UCM 전용 정성 DP 테스트 |
| `NARRATIVE_DATA_REMOVAL_SUMMARY.md` | 전체 정성 DP 처리 아키텍처 |

---

## 요약

- **문제**: UCM 전용 DP에서 `dp_meta=None` → 기본값 `quantitative` → 정성 DP가 정량 처리됨
- **해결**: UCM description에서 정성 키워드 체크 → 2개 이상 발견 시 `narrative`로 강제 변경
- **효과**: UCM 전용 정성 DP도 올바르게 `value=None` + `rulebook` 반환
- **임계값**: 2개 이상 (단일 키워드 오탐 방지)
- **향후**: LLM 기반 분류, UCM 테이블에 dp_type 추가 검토

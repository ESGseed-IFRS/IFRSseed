# Orchestrator Phase 2: 동적 데이터 선택

**작성일**: 2026-04-06  
**버전**: 1.0  
**목적**: LLM 기반 컨텍스트 인식 데이터 필터링

---

## 1. 개요

### 1.1 문제

기존 구현은 `c_rag`, `dp_rag`, `aggregation_node`에서 수집한 **모든 데이터를 gen_node에 그대로 전달**했습니다.

**문제점**:
- 불필요한 메타데이터 전달 → LLM 컨텍스트 낭비
- 카테고리에 따라 필요한 데이터가 다름
  - "회사 소개" → `company_profile` 필수
  - "재생에너지" → `subsidiary_data` 유용
  - 정성 DP → `rulebook` 필수

### 1.2 해결

**Phase 2: 데이터 통합 및 필터링**에서 **Gemini 2.5 Pro**가 사용자 요청을 분석하여 **필요한 데이터만 동적 선택**합니다.

---

## 2. 아키텍처

```
Phase 1: 병렬 데이터 수집
    ↓
┌─────────────────────────────────────────────────────┐
│  Phase 2: 데이터 통합 및 필터링 (신규)               │
│                                                     │
│  1. LLM 분석 (Gemini 2.5 Pro)                       │
│     - 카테고리: "회사 소개"                          │
│     - DP: "이사회 구성"                              │
│     - SR 본문 미리보기                               │
│     ↓                                               │
│  2. 선택 결정                                        │
│     {                                               │
│       "include_company_profile": true,              │
│       "include_dp_metadata": true,                  │
│       "include_ucm": false,                         │
│       "include_rulebook": false,                    │
│       "include_subsidiary_data": false,             │
│       "include_external_data": false,               │
│       "rationale": "회사 소개 섹션..."              │
│     }                                               │
│     ↓                                               │
│  3. gen_input 구성 (필터링된 데이터만)               │
└─────────────────────────────────────────────────────┘
    ↓
Phase 3: 생성-검증 루프 (gen_input 사용)
```

---

## 3. 구현

### 3.1 메서드 구조

| 메서드 | 역할 |
|--------|------|
| `_merge_and_filter_data` | Phase 2 진입점 (기존 `_merge_data` 대체) |
| `_select_data_for_gen` | LLM 기반 데이터 선택 |
| `_rule_based_selection` | 규칙 기반 폴백 (LLM 실패 시) |
| `_build_gen_input` | 선택 결과에 따라 gen_input 구성 |
| `_extract_sr_essentials` | SR 데이터 핵심 필드만 추출 |
| `_extract_agg_essentials` | aggregation 데이터 핵심 필드만 추출 |

### 3.2 LLM 프롬프트

```python
prompt = f"""당신은 IFRS SR 보고서 생성을 위한 데이터 선택 전문가입니다.

## 사용자 요청
- **카테고리**: {category}
- **DP ID**: {dp_id or "없음"}
- **DP 명칭**: {dp_name or "없음"}
- **DP 설명**: {dp_description or "없음"}
- **DP 유형**: {dp_type or "없음"}

## SR 본문 미리보기 (2024년)
{sr_body_preview}...

## 사용 가능한 데이터
1. **company_profile**: 회사명, 산업, 미션/비전, 임직원 수, 이사회 구성 등
2. **dp_metadata**: DP 상세 정보 (이름, 설명, 단위, 유형)
3. **ucm**: 통합 컬럼 매핑 (검증 규칙, 재무 연결성)
4. **rulebook**: 기준서 요구사항 (필수 공시 항목, 검증 체크)
5. **subsidiary_data**: 계열사/사업장별 상세 데이터
6. **external_company_data**: 언론 보도/뉴스

## 판단 기준
- **"회사 소개", "기업 개요", "회사 정보"** → company_profile 필수
- **"이사회 구성", "거버넌스", "지배구조"** → company_profile (이사회 정보) 필요
- **"재생에너지", "GHG 배출", "환경"** → subsidiary_data (사업장별 상세) 유용
- **"ESG 평가", "협력회사", "공급망"** → external_company_data (언론 보도) 참고 가능
- **정성 DP (narrative/qualitative)** → rulebook (기준서 요구사항) 필수
- **정량 DP (quantitative)** → dp_metadata만으로 충분

## 출력 형식 (JSON만 반환, 다른 텍스트 없이)
{{
    "include_company_profile": true,
    "include_dp_metadata": true,
    "include_ucm": false,
    "include_rulebook": true,
    "include_subsidiary_data": false,
    "include_external_data": false,
    "rationale": "선택 이유를 1-2문장으로"
}}"""
```

### 3.3 Gemini 호출

```python
response = self._gemini_client.generate_content(
    prompt,
    generation_config={
        "temperature": 0.1,
        "response_mime_type": "application/json"
    }
)

result = json.loads(response.text)
```

---

## 4. 예시 시나리오

### 시나리오 1: 카테고리 "회사 소개"

**입력**:
```json
{
    "category": "회사 소개",
    "dp_id": null
}
```

**LLM 선택**:
```json
{
    "include_company_profile": true,
    "include_dp_metadata": false,
    "include_ucm": false,
    "include_rulebook": false,
    "include_subsidiary_data": false,
    "include_external_data": false,
    "rationale": "회사 소개 섹션은 company_profile의 미션/비전/산업 정보가 핵심입니다."
}
```

**gen_input** (간소화):
```json
{
    "category": "회사 소개",
    "ref_2024": { "body_text": "...", "images": [] },
    "ref_2023": { "body_text": "...", "images": [] },
    "dp_data": {
        "company_profile": {
            "company_name_ko": "삼성에스디에스 주식회사",
            "industry": "정보통신업",
            "mission": "디지털 혁신으로 지속가능한 미래를 연결한다",
            "vision": "글로우 ESG·AI·클라우드 리더십"
        }
    }
}
```

### 시나리오 2: 카테고리 "재생에너지", DP "태양광 발전량"

**입력**:
```json
{
    "category": "재생에너지",
    "dp_id": "ESRS2-E1-6",
    "dp_type": "quantitative"
}
```

**LLM 선택**:
```json
{
    "include_company_profile": false,
    "include_dp_metadata": true,
    "include_ucm": false,
    "include_rulebook": false,
    "include_subsidiary_data": true,
    "include_external_data": true,
    "rationale": "재생에너지는 사업장별 구체적 사례(동탄 DC 등)와 언론 보도가 문단 풍부도를 높입니다."
}
```

**gen_input** (간소화):
```json
{
    "category": "재생에너지",
    "dp_data": {
        "dp_id": "ESRS2-E1-6",
        "dp_name_ko": "재생에너지 생산량",
        "latest_value": 1500,
        "unit": "MWh",
        "description": "태양광·지열 등 재생에너지 생산량"
    },
    "agg_data": {
        "2024": {
            "subsidiary_data": [
                {
                    "subsidiary_name": "동탄 데이터센터",
                    "facility_name": "태양광 발전설비",
                    "description": "2024년 태양광 발전량 172,497kWh 달성...",
                    "quantitative_data": {"태양광_발전량_kWh": 172497}
                }
            ],
            "external_company_data": [
                {
                    "title": "삼성SDS, 데이터센터 재생에너지 확대",
                    "body_text": "...",
                    "source_url": "https://..."
                }
            ]
        }
    }
}
```

### 시나리오 3: DP "근로자 대표" (정성)

**입력**:
```json
{
    "category": "이사회 구성",
    "dp_id": "ESRS2-GOV-1-21-b",
    "dp_type": "narrative"
}
```

**LLM 선택**:
```json
{
    "include_company_profile": true,
    "include_dp_metadata": true,
    "include_ucm": true,
    "include_rulebook": true,
    "include_subsidiary_data": false,
    "include_external_data": false,
    "rationale": "정성 DP는 rulebook의 필수 공시 항목과 검증 체크가 필요하며, 이사회 구성 정보도 참고합니다."
}
```

**gen_input** (간소화):
```json
{
    "category": "이사회 구성",
    "dp_data": {
        "dp_id": "ESRS2-GOV-1-21-b",
        "dp_name_ko": "근로자 및 기타 근로자 대표",
        "description": "근로자 및 기타 근로자 대표 관련 구성·다양성 정보를 공개합니다.",
        "dp_type": "narrative",
        "company_profile": {
            "board_total_members": 9,
            "board_independent_members": 5,
            "board_female_members": 2
        },
        "ucm": {
            "validation_rules": "{}",
            "disclosure_requirement": "필수"
        },
        "rulebook": {
            "rulebook_title": "GOV-1 para 21(b) Worker representation",
            "rulebook_content": "Disclose representation of employees and other workers.",
            "key_terms": ["employee representation", "workers"]
        }
    }
}
```

---

## 5. 규칙 기반 폴백

LLM 실패 시 **키워드 기반 간단 판단**:

```python
def _rule_based_selection(self, category: str, dp_type: Optional[str]) -> Dict[str, Any]:
    category_lower = category.lower()
    
    # 회사 소개 관련
    if any(kw in category_lower for kw in ["회사", "기업", "소개", "개요", "정보"]):
        return {"include_company_profile": True, ...}
    
    # 정성 DP
    if dp_type in ["narrative", "qualitative"]:
        return {"include_rulebook": True, "include_ucm": True, ...}
    
    # 환경 관련
    if any(kw in category_lower for kw in ["재생", "에너지", "ghg", "배출", "환경"]):
        return {"include_subsidiary_data": True, "include_external_data": True, ...}
    
    # 거버넌스 관련
    if any(kw in category_lower for kw in ["이사회", "거버넌스", "지배구조"]):
        return {"include_company_profile": True, ...}
    
    # 기본값: 모두 포함
    return {k: True for k in ["include_company_profile", ...]}
```

---

## 6. 설정

### 6.1 환경변수

```bash
# .env
GEMINI_API_KEY=your_gemini_api_key
ORCHESTRATOR_GEMINI_MODEL=gemini-2.5-pro  # 기본값, 변경 가능
```

### 6.3 패키지 의존성

```txt
# backend/requirement.txt
google-genai>=0.1.0  # 신규 패키지 (google-generativeai는 deprecated)
```

**마이그레이션**: `google.generativeai` → `google.genai` (2026-04-06 적용)

### 6.2 Settings

```python
# backend/core/config/settings.py
@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = ""
    orchestrator_gemini_model: str = "gemini-2.5-pro"
```

---

## 7. 효과

### 7.1 토큰 절약

**기존** (모든 데이터 전달):
```json
{
    "fact_data": {
        "company_profile": { /* 20개 필드 */ },
        "dp_metadata": { /* 10개 필드 */ },
        "ucm": { /* 15개 필드 */ },
        "rulebook": { /* 10개 필드 */ }
    }
}
```
→ 약 **2,000 토큰**

**개선** (필요한 데이터만):
```json
{
    "dp_data": {
        "company_profile": { /* 4개 필드만 */ }
    }
}
```
→ 약 **300 토큰** (85% 절감)

### 7.2 프롬프트 명확성

- gen_node가 **관련 없는 정보에 혼란**을 겪지 않음
- "회사 소개" 섹션에 `subsidiary_data`가 포함되어 사업장 정보가 섞이는 문제 해결

### 7.3 컨텍스트 적응

- 동일한 DP라도 **카테고리에 따라 다른 데이터 선택**
- 예: "이사회 구성" + DP "근로자 대표" → `company_profile` (이사회 정보) 포함
- 예: "재생에너지" + DP "태양광 발전량" → `subsidiary_data` (사업장 상세) 포함

---

## 8. 제약 사항

1. **Gemini API 의존**: API 키 없으면 규칙 기반 폴백
2. **LLM 비용**: Phase 2에서 매번 Gemini 호출 (약 500 토큰)
3. **프롬프트 유지보수**: 새 데이터 타입 추가 시 프롬프트 업데이트 필요

---

## 8.1 HTTP API 노출 (`POST /ifrs-agent/reports/create`)

클라이언트는 **원본 수집 결과**와 **Phase 2 정제 결과**를 동시에 볼 수 있다.

| 필드 | 내용 |
|------|------|
| `references` | Phase 1 원본: `sr_data`, `fact_data`, `agg_data` (c_rag / dp_rag / aggregation_node 그대로) |
| `gen_input` | Phase 2에서 구성한 **gen_node 전달용** 정제 페이로드 (`ref_2024`/`ref_2023` 요약, `dp_data`, 선택 시 `agg_data`) |
| `data_selection` | `include_company_profile`, `include_dp_metadata`, … 및 `rationale` |

`POST /ifrs-agent/reports/refine`에서는 Phase 2를 타지 않으므로 `gen_input`·`data_selection`은 `null`이다.

구현: `backend/api/v1/ifrs_agent/router.py` — `WorkflowResponse`, 오케스트레이터 반환값·`run_workflow` 최종 상태에 연동.

---

## 9. 향후 개선

1. **캐싱**: 동일 카테고리·DP 조합은 선택 결과 캐시
2. **학습**: 사용자 피드백으로 선택 규칙 개선
3. **세분화**: 이미지 선택, 텍스트 길이 조절 등 추가 필터링

---

## 10. 관련 파일

| 파일 | 역할 |
|------|------|
| `hub/orchestrator/orchestrator.py` | Phase 2 구현, `gen_input`·`data_selection` 반환 |
| `api/v1/ifrs_agent/router.py` | `WorkflowResponse`에 `gen_input`·`data_selection` |
| `models/langgraph/workflow.py` | 최종 상태에 필드 전달 |
| `core/config/settings.py` | `orchestrator_gemini_model` 설정 |
| `docs/REVISED_WORKFLOW.md` | Phase 2 설계 (§4.2) |
| `docs/orchestrator/PHASE2_DATA_SELECTION.md` | 본 문서 |

---

**끝.**

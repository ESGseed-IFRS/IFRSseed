# Phase 3: 유연한 사용자 입력 · 프롬프트 해석 · 다중 DP 설계

> 작성일: 2026-04-06  
> 업데이트: 2026-04-06  
> 상태: **Phase 0 & Phase 1 구현 완료, Phase 1.5 구현 완료**

---

## 1. 목표 요약

현재 `/ifrs-agent/reports/create` 는 `company_id`, `category`, `dp_id(단일·선택)` 만 받는다.  
이를 아래와 같이 확장한다.

| # | 요구 | 핵심 변경 |
|---|------|-----------|
| A | 사용자 **자유 프롬프트** 해석 | 오케스트레이터가 프롬프트를 파싱하여 c_rag·dp_rag 에 **의미 기반 지시**를 전달 |
| B | c_rag **프롬프트 검색** | 기존 `category` 임베딩 검색에 **프롬프트 키워드**를 결합; LLM 2차 선택 시 프롬프트 내용도 평가 |
| C | c_rag **페이지 다이렉트 지정** | 사용자가 "전년 89p, 전전년 75p" 라고 하면 벡터 검색 없이 **직접 페이지 반환** |
| D | dp_rag **다중 DP** 수용 | `dp_id` 대신 `dp_ids: List[str]` (1개 이상) → 각각 collect → 병합 |
| E | DP **계층 검증** (child_dps / parent_indicator) | 상위 DP가 들어오면 하위 DP 선택을 사용자에게 되돌림 |

---

## 2. 현재 구조 (AS-IS)

### 2.1 API 입력

```
POST /ifrs-agent/reports/create
{
  "company_id": str,      ← 필수
  "category": str,        ← 필수
  "dp_id": str | null,    ← 선택 (단일)
  "max_retries": int       ← 기본 3
}
```

`toc_path`, `subtitle`, `prompt` 같은 필드는 **없음**.

### 2.2 오케스트레이터 Phase 1

```
_parallel_collect(user_input)
  ├─ c_rag.collect({ company_id, category, years=[2024,2023] })
  ├─ dp_rag.collect({ company_id, dp_id, year=2024 })          ← dp_id 있을 때만
  └─ aggregation_node.collect({ company_id, category, years })  ← 등록 시
```

- c_rag: `category` 문자열을 **그대로 임베딩** → 상위 4건 벡터 → LLM 재선택 1건
- dp_rag: **단일** `dp_id` 만 처리
- 프롬프트/페이지 지정: **지원 안 됨**

### 2.3 dp_query.query_dp_metadata

```sql
SELECT dp_id, name_ko, name_en, description, topic, subtopic,
       category, dp_type, unit, validation_rules
FROM data_points WHERE dp_id = $1
```

**`child_dps`, `parent_indicator` 는 DB 컬럼이 있지만 조회하지 않음.**

---

## 3. TO-BE 설계

### 3.1 API 확장

```
POST /ifrs-agent/reports/create
{
  "company_id": str,
  "category": str,                 ← 기존과 동일 (toc_path/subtitle 기반)
  "dp_ids": List[str] | null,      ← 1개 이상 DP (기존 dp_id 하위 호환)
  "prompt": str | null,            ← 사용자 자유 프롬프트 (신규)
  "ref_pages": {                   ← 페이지 다이렉트 지정 (신규, 선택)
    "2024": int | null,
    "2023": int | null
  } | null,
  "max_retries": int
}
```

#### 하위 호환

| 기존 필드 | 처리 |
|-----------|------|
| `dp_id: str` | `dp_ids = [dp_id]` 로 정규화 |
| `prompt` 없음 | 기존 로직 그대로 |
| `ref_pages` 없음 | c_rag 벡터 검색 그대로 |

### 3.2 오케스트레이터: 프롬프트 해석 (Phase 0 신규)

`_parallel_collect` **직전**에 **`_interpret_user_prompt`** 단계를 추가한다.

```
async def _interpret_user_prompt(self, user_input) -> Dict[str, Any]:
    """
    사용자 prompt + category 를 LLM(Gemini)으로 해석하여
    c_rag · dp_rag 에 전달할 지시를 생성한다.

    Returns:
        {
          "search_intent": str,       # c_rag 검색에 사용할 의미 요약
          "content_focus": str,       # 예: "고객 VoC 채널/처리 절차 및 프로세스"
          "ref_pages": {              # 사용자 지정 시 다이렉트
            "2024": int | None,
            "2023": int | None
          } | None,
          "dp_validation_needed": bool  # DP 계층 검증 필요 여부
        }
    """
```

**해석 규칙:**
1. `prompt` 에 "~페이지" / "p." / "페이지" 패턴 → `ref_pages` 추출
2. 나머지 텍스트 → `search_intent` (c_rag 검색 쿼리 보강용), `content_focus` (LLM 2차 선택 기준)
3. `ref_pages` 가 명시되면 c_rag 는 **벡터 검색 스킵, 다이렉트 페이지 조회**

#### 처리 흐름

```
orchestrate(user_input)
  │
  ├─ Phase 0: _interpret_user_prompt(user_input)
  │     → interpretation = { search_intent, content_focus, ref_pages, ... }
  │     → user_input 에 병합
  │
  ├─ Phase 1: _parallel_collect(user_input)
  │     ├─ c_rag  ← interpretation 전달
  │     ├─ dp_rag ← dp_ids[] 루프
  │     └─ aggregation_node
  │
  ├─ Phase 1.5: DP 계층 검증 (신규)
  │     → 상위 DP 감지 시 사용자에게 child_dps 반환 + 재선택 요청
  │
  ├─ Phase 2: _merge_and_filter_data → _build_gen_input
  └─ Phase 3: gen_node → validator_node
```

### 3.3 c_rag 확장

#### 3.3.1 페이지 다이렉트 모드

`ref_pages` 가 있으면 벡터 검색을 건너뛰고 **지정 페이지 직접 조회**.

```python
# c_rag agent.py — collect 분기
if payload.get("ref_pages"):
    # 다이렉트 모드: 벡터/LLM 없이 직접 조회
    for year in years:
        page = ref_pages.get(str(year))
        if page:
            result[str(year)] = await self._query_sr_by_page(company_id, year, page)
else:
    # 기존 벡터 검색 모드
    ...
```

**신규 메서드:**

```python
async def _query_sr_by_page(self, company_id, year, page_number):
    """page_number로 SR 본문·이미지 직접 조회"""
    body_row = await self.infra.call_tool("query_sr_body_by_page", {
        "company_id": company_id,
        "year": year,
        "page_number": page_number
    })
    images = await self._query_sr_images(body_row["report_id"], page_number)
    return {
        "sr_body": body_row["body"],
        "sr_images": images,
        "page_number": page_number,
        "report_id": body_row["report_id"]
    }
```

**신규 툴:** `query_sr_body_by_page` — `sr_report_body` 에서 `company_id + year + page_number` 로 직접 SELECT.

#### 3.3.2 프롬프트 기반 검색 보강

벡터 검색 모드에서:

1. **임베딩 입력** 변경: `category` 만 → `category + " " + search_intent`
2. **LLM 2차 선택** 변경: 기존 시스템 프롬프트에 `content_focus` 추가

```python
# 기존
search_text = category

# 변경
search_intent = payload.get("search_intent", "")
search_text = f"{category} {search_intent}".strip()
```

LLM 재선택 시:

```python
# system_msg 에 추가
if content_focus:
    system_msg += f"\n\n사용자가 특히 관심 있는 내용: {content_focus}"
    system_msg += "\n위 내용과 가장 관련 높은 페이지를 우선 선택하세요."
```

### 3.4 dp_rag 다중 DP

#### 3.4.1 오케스트레이터 측

```python
# _parallel_collect 내부
dp_ids = user_input.get("dp_ids") or []
if user_input.get("dp_id"):  # 하위 호환
    dp_ids = [user_input["dp_id"]]

dp_rag_tasks = []
for dp_id in dp_ids:
    task = self.infra.call_agent("dp_rag", "collect",
        self._agent_payload({
            "company_id": company_id,
            "dp_id": dp_id,
            "year": 2024,
        }),
        timeout=heavy_timeout,
    )
    dp_rag_tasks.append((dp_id, task))
```

**병합:** `fact_data` 를 단일 dict → **`fact_data_list: List[Dict]`** 또는 **`fact_data_by_dp: Dict[str, Dict]`** 로 구조 변경.

#### 3.4.2 gen_input 구조 변경

```python
# 기존
dp_data = { "dp_id": ..., "latest_value": ..., ... }

# 변경: 다중 DP
dp_data_list = [
    { "dp_id": "GRI2-11", ... },
    { "dp_id": "IFRS1-25-a", ... },
    { "dp_id": "ESRS-E1-23", ... }
]
```

`gen_node` 프롬프트(`prompts.py`)에서 `dp_data` → `dp_data_list` 루프로 각 DP 섹션을 빌드.

### 3.5 DP 계층 검증 (Phase 1.5)

#### 3.5.1 dp_query.py 확장

```sql
-- query_dp_metadata 에 추가
SELECT dp_id, name_ko, name_en, description,
       topic, subtopic, category, dp_type, unit,
       validation_rules,
       child_dps,           -- ARRAY(String), 신규 노출
       parent_indicator     -- String, 신규 노출
FROM data_points WHERE dp_id = $1
```

#### 3.5.2 검증 로직 (오케스트레이터)

Phase 1 후, dp_rag 결과를 받으면:

```python
async def _validate_dp_hierarchy(self, dp_results: List[Dict]) -> Dict:
    """
    상위 DP 감지 시 사용자에게 하위 선택을 요청하는 응답을 만든다.

    판단 기준:
    1. child_dps 가 비어있지 않음
    2. description / validation_rules 에 하위 항목 공시 지시 문구 포함
       예: "문단 63(적용)·64(목적)·65(a)~(f)를 하위 DP로 둡니다."
    3. parent_indicator 가 None (즉 자신이 최상위)

    Returns:
        {
          "needs_user_selection": True,
          "problematic_dps": [
            {
              "dp_id": "ESRS2-MDR-P",
              "name_ko": "MDR-P: 정책",
              "description": "문단 63~65 하위 DP 포함 ...",
              "validation_rules": [...],
              "child_dps": ["ESRS2-MDR-P-63", "ESRS2-MDR-P-64", ...],
              "parent_indicator": null,
              "reason": "상위 DP — 하위 문단·항목을 선택해주세요"
            }
          ]
        }
    """
```

검증에서 **"부적합"** 판정된 DP가 있으면:

1. **즉시 gen_node 로 가지 않고**
2. 사용자에게 **`status: "needs_dp_selection"`** 응답 반환
3. 응답에 `child_dps` + `parent_indicator` + `description` 을 포함
4. 사용자가 하위 DP를 다시 선택하여 재요청

**UCM 은 이 검증에서 제외** (UCM은 자체 hierarchy가 다르므로).

#### 3.5.3 API 응답 확장

```python
# WorkflowResponse 에 신규 필드
class WorkflowResponse(BaseModel):
    ...
    dp_selection_required: Optional[List[Dict[str, Any]]] = None
    # DP 계층 검증 실패 시 하위 선택지 제시
```

---

## 4. 파일별 변경 범위

| 파일 | 변경 내용 | 규모 |
|------|-----------|------|
| `router.py` | `CreateReportRequest` 에 `dp_ids`, `prompt`, `ref_pages` 추가; `WorkflowResponse` 에 `dp_selection_required` | S |
| `orchestrator.py` | `_interpret_user_prompt` 신규; `_parallel_collect` dp_ids 루프; `_validate_dp_hierarchy` 신규; `_build_gen_input` dp_data_list 지원 | L |
| `c_rag/agent.py` | `_query_sr_by_page` 신규; `search_text` 보강; LLM 2차에 `content_focus` 주입 | M |
| `dp_query.py` | `query_dp_metadata` SQL에 `child_dps`, `parent_indicator` 추가; `query_sr_body_by_page` 신규 툴 | S |
| `state.py` | `fact_data` → `fact_data_list` 또는 `fact_data_by_dp` 지원 | S |
| `gen_node/prompts.py` | `_build_latest_data_section` → 다중 DP 루프 | M |
| `bootstrap.py` | `query_sr_body_by_page` 툴 등록 | S |

---

## 5. 엔드-투-엔드 시나리오

### 시나리오 A: 프롬프트 + 벡터 검색

```
사용자 입력:
  category: "고객 고객지원"
  dp_ids: ["GRI2-29"]
  prompt: "고객 VoC 채널/처리 절차 및 프로세스에 대해 작성해봐"

→ Phase 0: _interpret_user_prompt
  search_intent: "고객 VoC 채널 처리 절차 프로세스 고객지원"
  content_focus: "고객 VoC 채널/처리 절차 및 프로세스"
  ref_pages: null

→ Phase 1:
  c_rag.collect({
    company_id, category: "고객 고객지원",
    search_intent: "고객 VoC 채널 처리 절차 프로세스 고객지원",
    content_focus: "고객 VoC 채널/처리 절차 및 프로세스",
    years: [2024, 2023]
  })
    1차: "고객 고객지원 고객 VoC 채널 처리 절차 프로세스 고객지원" 임베딩 → 상위 4건
    2차: LLM이 4건 중 "VoC 채널/처리 절차" 내용이 있는 페이지 선택

  dp_rag.collect({ dp_id: "GRI2-29", ... })

→ Phase 2·3: 기존과 동일
```

### 시나리오 B: 페이지 다이렉트

```
사용자 입력:
  category: "고객 고객지원"
  dp_ids: ["GRI2-29"]
  prompt: "전년 89페이지와 전전년 75페이지를 참고해서 작성해"
  ref_pages: { "2024": 89, "2023": 75 }   ← 프론트가 파싱 or Phase 0 파싱

→ Phase 0: _interpret_user_prompt
  ref_pages: { "2024": 89, "2023": 75 }
  content_focus: "작성해" (약한 프롬프트)

→ Phase 1:
  c_rag.collect({
    company_id, category: "고객 고객지원",
    ref_pages: { "2024": 89, "2023": 75 },
    years: [2024, 2023]
  })
    → 다이렉트 모드: 89p, 75p 직접 조회 (벡터/LLM 스킵)
```

### 시나리오 C: 다중 DP + 계층 검증 실패

```
사용자 입력:
  dp_ids: ["ESRS2-MDR-P", "GRI2-11"]

→ Phase 1:
  dp_rag[0]: ESRS2-MDR-P → fact_data (description, child_dps, ...)
  dp_rag[1]: GRI2-11     → fact_data (leaf DP, child_dps=[])

→ Phase 1.5: _validate_dp_hierarchy
  ESRS2-MDR-P:
    child_dps = ["ESRS2-MDR-P-63", "ESRS2-MDR-P-64", "ESRS2-MDR-P-65-a", ...]
    → 상위 DP! gen_node 전달 부적합
  GRI2-11:
    child_dps = [] → OK

→ 응답:
  status: "needs_dp_selection"
  dp_selection_required: [
    {
      "dp_id": "ESRS2-MDR-P",
      "name_ko": "MDR-P: 정책",
      "description": "문단 63(적용)·64(목적)·65(a)~(f)를 ...",
      "child_dps": ["ESRS2-MDR-P-63", "ESRS2-MDR-P-64", ...],
      "parent_indicator": null,
      "reason": "상위 DP — 아래 하위 DP 중 필요한 항목을 선택해주세요"
    }
  ]

사용자 재요청:
  dp_ids: ["ESRS2-MDR-P-65-a", "GRI2-11"]
  → Phase 1.5 통과 → Phase 2·3 진행
```

---

## 6. 설계 판단 · 의견

### 6.1 프롬프트 해석을 어디서 할 것인가

| 방안 | 장점 | 단점 |
|------|------|------|
| **A. 오케스트레이터(Gemini)** | 단일 해석 지점, c_rag·dp_rag 에 정제된 지시 전달 | Gemini 호출 1회 추가 (지연·비용) |
| B. 프론트에서 파싱 | 오케스트레이터 변경 최소 | 프론트 로직 복잡, 의미 해석 불가 |
| C. c_rag 내부에서 자체 해석 | c_rag 자율성 | 오케스트레이터 통합 어려움 |

**추천: A** — 오케스트레이터가 "슈퍼바이저" 역할을 하는 현 구조에 맞고, 한 번의 해석으로 c_rag·dp_rag 모두에 일관된 지시를 줄 수 있다. `ref_pages` 는 정규식 패턴으로 빠르게 추출 가능하므로 **LLM 없이도 가능한 부분은 규칙 기반**으로 처리.

### 6.2 다중 DP → gen_node 프롬프트

1개 DP일 때와 N개 DP일 때 프롬프트 구조가 달라진다.

| 방안 | 설명 |
|------|------|
| **A. dp_data_list[]** | `_build_latest_data_section` 을 루프 호출 → 각 DP 별 섹션 병합 |
| B. dp_data를 하나로 flatten | DP간 필드 충돌 위험 |

**추천: A** — DP별로 독립된 컨텍스트 블록을 만들고, gen_node 에 "아래 N개 DP의 정보를 종합하여 작성하세요" 지시.

### 6.3 DP 계층 검증 기준

**부적합 판정 조건 (AND):**
1. `child_dps` 배열이 **비어있지 않음** (하위 존재)
2. 해당 DP 자체가 **leaf가 아님** (하위 DP에 실질 공시 항목이 있음)

**적합 판정:**
- `child_dps` 가 비어있거나 null → leaf DP → 바로 gen_node 전달
- UCM ID → 계층 검증 스킵

### 6.4 `ref_pages` 파싱 위치

`prompt` 에서 "89페이지" 같은 패턴을 뽑는 것은 **규칙 기반**(정규식)으로 충분하다.  
프론트에서 별도 필드로 보내도 되고, 오케스트레이터 Phase 0에서 `prompt` 텍스트를 파싱해도 된다.  
**권장:** 프론트가 가능하면 `ref_pages` 필드로 구조화하여 보내고, 안 되면 Phase 0에서 정규식 추출.

---

## 7. 구현 순서 (권장)

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | `dp_query.py`: `child_dps`, `parent_indicator` SELECT 추가 | 없음 |
| 2 | `router.py`: `CreateReportRequest` 확장 (`dp_ids`, `prompt`, `ref_pages`) | 없음 |
| 3 | 오케스트레이터 `_interpret_user_prompt` (Phase 0) | 2 |
| 4 | c_rag: `_query_sr_by_page` + `search_text` 보강 + LLM `content_focus` | 3, `query_sr_body_by_page` 툴 |
| 5 | 오케스트레이터: 다중 DP 루프 (`dp_ids`) | 2 |
| 6 | 오케스트레이터: `_validate_dp_hierarchy` (Phase 1.5) | 1, 5 |
| 7 | `_build_gen_input`: `dp_data_list` 구조 | 5 |
| 8 | `gen_node/prompts.py`: 다중 DP 프롬프트 | 7 |
| 9 | 통합 테스트 | 전체 |

---

## 8. 현재 코드 참조

| 항목 | 파일 | 라인/메서드 |
|------|------|-------------|
| API 입력 | `backend/api/v1/ifrs_agent/router.py` | `CreateReportRequest` |
| Phase 0 | `backend/.../orchestrator/prompt_interpretation.py` | ✅ 구현 완료 |
| Phase 1 | `backend/.../orchestrator/orchestrator.py` | ✅ `_parallel_collect` 다중 DP 지원 |
| c_rag 벡터 검색 | `backend/.../c_rag/agent.py` | ✅ `search_intent` 결합, `ref_pages` 직접 조회 |
| c_rag LLM 재선택 | `backend/.../c_rag/agent.py` | ✅ `content_focus` 반영 |
| dp_rag 메타 조회 | `backend/.../dp_query.py` | ✅ `child_dps`, `parent_indicator` 노출 |
| dp_rag collect | `backend/.../dp_rag/agent.py` | ✅ 다중 DP 병렬 호출 |
| DP ORM | `backend/.../esg_data/models/bases/data_point.py` | `child_dps`, `parent_indicator` 컬럼 존재 |
| DP 시드 예시 | `backend/.../data/gri_2/datapoint.json` | `child_dps`, `parent_indicator` 값 확인 |
| gen_input 빌드 | `backend/.../orchestrator/orchestrator.py` | ✅ `_build_gen_input` dp_data_list 지원 |
| gen_node 프롬프트 | `backend/.../gen_node/prompts.py` | ✅ `_build_latest_data_section` 다중 DP 루프 |
| state | `backend/.../models/langgraph/state.py` | ✅ `fact_data_by_dp`, `prompt_interpretation` 추가 |
| Phase 1.5 검증 | `backend/.../orchestrator/orchestrator.py` | ✅ `_validate_dp_hierarchy` 구현 |
| API 응답 | `backend/api/v1/ifrs_agent/router.py` | ✅ `dp_selection_required` 필드 추가 |

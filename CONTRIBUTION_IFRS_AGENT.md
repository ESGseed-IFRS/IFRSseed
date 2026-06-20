# IFRS Agent 구현기 — LangGraph 멀티 에이전트로 ESG 보고서를 생성하다

> "데이터를 모아 → 표준에 맞춰 → 문단으로 쓰는 SR 보고서 작성을, 에이전트들이 협업해서 자동으로 끝낼 수 있을까? 그리고 그 문단의 **모든 숫자가 어디서 왔는지** 끝까지 추적할 수 있을까?"
>
> IFRSseed에서 내가 맡은 **IFRS Agent**는 이 두 질문에 답하는 엔진입니다. 이 글은 내가 직접 구현한 로직과, 가장 까다로웠던 문제들의 해결 과정을 정리한 기록입니다.

---

## 0. TL;DR

- **내 역할**: 4인 팀(BE 2 / FE 1 / AI 1)에서 **백엔드 핵심 로직**, 특히 **IFRS Agent(SR 보고서 자동 생성 엔진)**의 워크플로우 설계·구현 담당
- **무엇을 만들었나**: LangGraph 기반 5개 에이전트 오케스트레이터(Phase 0~4), 3-에이전트 병렬 데이터 수집, 외부 SR PDF 파싱 파이프라인, 문장 단위 데이터 출처 추적
- **핵심 기술**: `LangGraph` · `Gemini 2.5-pro` · `pgvector` · `asyncio/asyncpg` · `Docling/LlamaParse` · `FastAPI(SSE)`
- **대표 성과**: 데이터 수집 단계 병렬화로 **Phase 1 지연 2분 → 약 40초(3배↑)**, 생성 문단의 **출처 커버리지 80%+** 강제 검증

---

## 1. 내가 맡은 것

ESG 지속가능경영보고서(SR)는 "데이터를 모아 → 표준에 맞춰 → 문단으로 쓰는" 작업입니다. 나는 이 전 과정을 자동화하는 **IFRS Agent**를 맡아 다음을 구현했습니다.

- **LangGraph 기반 멀티 에이전트 오케스트레이터** — 5개 에이전트의 협업 워크플로우(Phase 0~4)
- **3개 에이전트 병렬 데이터 수집** — `c_rag` / `dp_rag` / `aggregation_node`를 `asyncio.gather`로 동시 실행
- **외부 SR PDF 파싱 파이프라인** — Docling → LlamaParse 폴백, 목차/본문/이미지 추출
- **문장 단위 데이터 출처 추적(Data Provenance)** — 생성된 문단의 모든 수치를 원본 DB까지 역추적
- **GHG 계산 결과와의 연동** — 계열사 제출 데이터·배출량 결과를 보고서 문단에 주입

핵심 파일:
```
backend/domain/v1/ifrs_agent/
├── hub/orchestrator/orchestrator.py        # 메인 워크플로우 (1,200+ LOC)
├── models/langgraph/workflow.py            # StateGraph 빌더
└── spokes/agents/
    ├── c_rag/agent.py                      # SR 본문·이미지 검색
    ├── dp_rag/agent.py                     # 정량(DP/UCM)·정성(rulebook) 데이터
    ├── aggregation_node/agent.py           # 계열사·외부기업 데이터 통합
    ├── gen_node/agent.py + prompts.py      # SR 문단 생성 + 출처 스키마
    └── validator_node/agent.py             # 검증 + 재시도
```

---

## 2. 전체 구조 — 도메인 레이어드 아키텍처

백엔드는 도메인별로 책임을 쪼갠 **레이어드 모놀리식** 구조이고, 각 도메인은 다시 **Hub**(오케스트레이터·서비스·리포지토리)와 **Spokes**(에이전트·툴·인프라)로 나뉩니다. 비즈니스 로직과 외부 연동을 분리해 **에이전트/툴을 플러그인처럼 교체**할 수 있게 한 것이 핵심 설계 의도입니다.

```
API Layer (FastAPI Router)
   ↓
Core Layer (settings, asyncpg pool, 미들웨어)
   ↓
Domain Layer (v1)
   ├── ifrs_agent        ← 내가 담당한 SR 생성 엔진
   ├── ghg_calculation   ← Scope 1/2/3 배출량 계산 (연동)
   ├── esg_data          ← 크로스 스탠다드 UCM 매핑 (연동)
   └── data_integration  ← 외부 SR 수집/파싱 (연동)
   ↓
PostgreSQL + pgvector
```

IFRS Agent는 다른 세 도메인의 출력을 **소비**합니다. `ghg_calculation`이 만든 `ghg_emission_results`, `esg_data`가 만든 `unified_column_mappings`, `data_integration`이 파싱한 `sr_report_body`를 모두 끌어와 하나의 보고서 문단으로 합칩니다. 그래서 IFRS Agent의 설계 난이도는 "여러 출처를 어떻게 일관되게 통합하느냐"에 있었습니다.

---

## 3. 핵심 기능 — IFRS Agent 워크플로우 (Phase 0~4)

LangGraph `StateGraph` 위에서 하나의 `orchestrator_node`가 단계별 상태(`WorkflowState`)를 넘기며 동작합니다. 조건부 엣지(conditional edge)로 검증 실패 시 재시도 루프를 돌립니다.

### Phase 0 — 프롬프트 해석
사용자의 자유 입력("삼성SDS 2024년 Scope 2 보고서 만들어줘")을 **구조화된 검색 의도**로 변환합니다. Gemini로 `search_intent`, `content_focus`, `ref_pages`, `dp_validation_needed`를 뽑아내고, LLM이 실패하면 휴리스틱으로 폴백합니다.

### Phase 1 — 3개 에이전트 병렬 데이터 수집 ⭐
이 프로젝트에서 가장 공들인 부분입니다. 세 에이전트가 **서로 의존하지 않으므로** 순차가 아니라 동시에 실행합니다.

| 에이전트 | 역할 | 출력 |
|----------|------|------|
| `c_rag` | 2024/2023 SR 본문·이미지 검색 (pgvector) | `ref_data` |
| `dp_rag` | 정량 데이터(DP/UCM) + 정성 데이터(rulebook) 조회 | `fact_data_by_dp` |
| `aggregation_node` | 계열사 제출 데이터 + 외부기업 뉴스(Tavily) | `agg_data` |

```python
# orchestrator.py — 진짜 병렬 실행
all_tasks = [c_rag_task]
for dp_id, task in dp_rag_tasks:
    all_tasks.append(task)
if aggregation_task:
    all_tasks.append(aggregation_task)

results = await asyncio.gather(*all_tasks, return_exceptions=True)
```

### Phase 1.5 — DP 계층 검증 (선택)
데이터포인트(DP)는 부모-자식 관계를 가질 수 있습니다(예: "온실가스 배출" → "Scope 1 / 2 / 3"). 부모 DP를 요청했는데 실제로는 자식이 필요한 경우, 잘못 집계되지 않도록 **조기 반환**하고 프론트에 선택을 요청합니다.

### Phase 2 — 데이터 병합·동적 선택
수집한 데이터를 Gemini가 필터링/우선순위화해 생성 입력(`gen_input`)을 구성합니다. 참조 SR 페이지 + 정량/정성 팩트를 하나로 합칩니다.

### Phase 3 — 생성·검증 루프
- **Gen Node**: Gemini로 한국어 SR 문단 생성
- **Validator Node**: 정확도·일관성·요구사항 일치 검증, 실패 시 최대 3회 자동 재시도

### Phase 4 — 최종 반환
출처 체인(provenance), 검증 결과, 참조 페이지를 모두 담은 구조화 JSON으로 API 응답을 만듭니다.

---

## 4. 기술 스택

| 구분 | 기술 | 용도 |
|------|------|------|
| **오케스트레이션** | LangGraph `StateGraph` | 멀티 에이전트 워크플로우, 재시도 엣지 |
| **LLM 통합** | LangChain, Google Gemini 2.5-pro | Phase 0/2/3 해석·선택·생성 |
| **벡터 검색** | PostgreSQL + pgvector, BGE-M3(1024d) | SR 본문·DP 임베딩 검색 |
| **비동기** | asyncio, asyncpg(pool min5/max20) | 에이전트 병렬 실행, DB 연결 풀 |
| **문서 파싱** | Docling(주) → LlamaParse(폴백) | PDF 목차/표 추출 |
| **OCR 폴백(설계)** | PyMuPDF, pypdf, PaddleOCR | 손상된 PDF 페이지 추출 |
| **API** | FastAPI, SSE(Server-Sent Events) | 실시간 진행 상황 스트리밍 |
| **로깅** | loguru | 구조화 로깅, 진단 |

---

## 5. 구현하면서 부딪힌 문제와 해결

여기가 이 글의 핵심입니다. 실제로 막혔던 지점과 어떻게 풀었는지를 정리했습니다.

### 문제 1. 순차 에이전트 호출의 지연 → 병렬화

**문제**: 초기 설계는 `c_rag` → `dp_rag` → `aggregation_node`를 순차 호출했습니다. 각 에이전트가 LLM·DB·외부 API를 호출하다 보니 네트워크 지연이 누적돼 Phase 1만 **약 2분**이 걸렸습니다.

**해결**: 세 에이전트가 입력을 공유하지 않고 독립적으로 동작한다는 점에 착안해 `asyncio.gather`로 **진짜 병렬 실행**으로 전환했습니다. 각 태스크에 `heavy_timeout`(~60s)을 걸어 한 에이전트가 멈춰도 전체가 막히지 않게 했습니다.

**결과**: Phase 1 지연 **2분 → 약 40초(3배 이상 단축)**.

---

### 문제 2. AI가 생성한 문단의 "출처를 알 수 없다"

**문제**: ESG 보고서는 모든 수치에 근거가 있어야 합니다. 그런데 Gen Node는 처음엔 문단 텍스트만 돌려줬고, **"이 숫자가 어느 테이블의 어느 값에서 왔는지"**를 추적할 수 없었습니다. ESG 공시에서 출처 불명은 치명적입니다.

**해결**: Gen Node 프롬프트를 재설계해, 텍스트와 함께 **문장 단위 출처 체인(`data_provenance`)**을 강제 출력하도록 스키마를 정의했습니다.

```jsonc
{
  "generated_text": "...",
  "data_provenance": {
    "quantitative_sources": [{
      "value": "1234.5", "unit": "tCO₂e", "dp_id": "GRI-305-2",
      "source_type": "subsidiary_data | environmental_data | external_news | sr_reference",
      "source_details": {
        "table": "ghg_emission_results", "column": "scope2_total",
        "year": 2024, "subsidiary_name": "멀티캠퍼스",
        "matched_via": "dp_direct | dp_ucm | category"
      },
      "used_in_sentences": ["이 값이 실제로 쓰인 문장"]
    }],
    "qualitative_sources": [ ... ],
    "reference_pages": { "2024": 89, "2023": 75 }
  }
}
```

규칙으로 **각 문장이 최소 1개 출처에 매핑**되도록 했고, **전체 문장의 80% 이상 커버리지**를 검증 조건으로 걸었습니다. 정량(숫자)과 정성(정책·참조)을 분리 추적해, 프론트에서 문단 옆에 출처 배지로 표시할 수 있게 됐습니다.

---

### 문제 3. 외부 SR PDF 파싱 중 MuPDF 스택 오버플로우

**문제**: 외부 보고서(삼성SDS 2025 목차, 146–153p)를 파싱할 때 `_extract_pages_to_pdf()`가 PyMuPDF의 내부 재귀 한계에 걸려 **스택 오버플로우(error code 5)**로 죽었습니다. 페이지 추출이 실패하니 LlamaParse로 넘길 페이지조차 못 만들어 **목차 레코드가 0건**이 되는 치명적 버그였습니다.

**해결**: 다단계 폴백 전략을 구현했습니다.
1. **페이지 범위 최적화** — 전체 문서 요청 시 `page_range` 인자를 생략해 불필요한 추출 회피
2. **전체 PDF 폴백** — `page_range` 추출 실패 시 전체 PDF로 재시도
3. **파일 핸들 강제 정리** — Docling이 열기 전에 `fsync()`로 임시 파일 핸들을 닫아 WinError 32(파일 사용 중) 회피
4. **추가 폴백 설계** — pypdf(2차), PaddleOCR로 페이지를 이미지 렌더링 후 OCR(3차)

이 경험으로 **"외부 PDF는 항상 깨질 수 있다"**는 전제로 파서를 다층 폴백 구조로 짜야 한다는 걸 배웠습니다.

---

### 문제 4. 배출계수 매핑 화면의 "빈 값" 미스터리

**문제**: 프론트의 배출계수 매핑 테이블에서 `source_unit`이 공란, `annual_activity`가 0으로 표시되는 제보가 들어왔습니다. 처음엔 코드 버그를 의심했지만, 백엔드(값 계산·DTO 전달)도 프론트(API 응답 추출)도 **코드는 모두 정상**이었습니다.

**해결**: 근본 원인은 코드가 아니라 **데이터**였습니다. 5가지 시나리오로 분해해 진단 로직을 만들었습니다.
1. 스테이징 데이터 0건
2. `raw_data.items`가 null → 집계 실패
3. 에너지 단위가 CSV에서 미인식 → `_classify_fuel_type_and_unit()`가 None 반환
4. 배출계수 DB에 해당 연료-단위 조합 없음
5. 월별 데이터 컬럼이 전부 0 → 연간 활동량 합계 0

각 분기점에 **진단 로그**를 심어, 운영 중에도 어느 단계에서 데이터가 비는지 즉시 알 수 있게 했습니다.

```python
logger.info(f"🔍 스테이징 데이터: {len(snaps)}개 스냅샷")
logger.info(f"🔍 집계 후 Bucket: {len(bucket)}개 (에너지타입×시설)")
if annual_activity == 0:
    logger.warning(f"⚠️ 연간 활동량 0: facility={facility}, et={et}, unit={source_unit}")
```

**교훈**: "값이 비어 보인다"는 버그의 상당수는 코드가 아니라 **데이터 파이프라인의 공백**이다. 코드를 의심하기 전에 **데이터 흐름의 각 단계를 관측 가능하게** 만들어야 한다.

---

### 문제 5. 여러 출처의 데이터를 하나의 그룹 보고서로 통합

**문제**: 지주사(삼성SDS) 자체 배출량과 계열사(오픈핸즈·멀티캠퍼스 등)가 제출한 배출량을 **하나의 그룹 보고서**로 합쳐야 했습니다. 그런데 어떤 수치가 지주사 자체인지, 계열사 보고인지 구분이 안 됐습니다.

**해결**: `aggregation_node`가 **승인된(`status='approved'`) 계열사 제출분만** 집계하도록 하고, 각 데이터에 출처 타입(`holding_own` vs `subsidiary_reported`)을 부여했습니다. 생성된 문단에는 이렇게 인용됩니다.

> "2024년 그룹 전체 Scope 2 배출량은 183,204 tCO₂e입니다. 이 중 지주사(삼성SDS) 자체는 179,480 tCO₂e이며, 멀티캠퍼스로부터 보고받은 3,349 tCO₂e와 오픈핸즈의 375 tCO₂e를 포함합니다."

이로써 보고서의 모든 그룹 합계가 **계열사 단위까지 역추적 가능**해졌습니다.

---

## 6. 회고

IFRS Agent를 구현하며 가장 크게 남은 것들입니다.

**잘한 선택**
- 독립적인 세 에이전트를 `asyncio.gather`로 병렬화해 응답 시간을 3배 이상 줄인 것
- 문단 생성 단계에서 **출처 추적을 스키마로 강제**한 것 — 나중에 ESG 공시 신뢰성의 핵심이 됨
- 외부 PDF 파서를 처음부터 다층 폴백 구조로 설계한 것

**배운 점 & 아쉬운 점**
- **멀티 에이전트는 "쪼개기"보다 "통합"이 어렵다.** 서로 다른 출처를 일관된 상태로 합치고 출처를 추적하는 설계가 진짜 난이도였다.
- **외부 입력(PDF·CSV)은 항상 깨진다는 전제로 짜야 한다.** 다층 폴백과 진단 로그가 없으면 운영에서 무너진다.
- **버그는 코드가 아니라 데이터 경계에 숨어 있다.** 파이프라인 각 단계를 관측 가능하게 만든 것이 디버깅 시간을 가장 많이 줄였다.

---

## 7. 한 줄 요약

> 흩어진 ESG 데이터를, 여러 표준을 넘나들며, **출처까지 끝까지 추적 가능한** 보고서 문단으로 —
> AI 에이전트들이 협업해 자동 생성하도록 만든 것이 내 기여입니다.

기술 스택: `LangGraph` · `LangChain` · `Gemini 2.5-pro` · `pgvector` · `asyncio/asyncpg` · `Docling/LlamaParse` · `FastAPI(SSE)`

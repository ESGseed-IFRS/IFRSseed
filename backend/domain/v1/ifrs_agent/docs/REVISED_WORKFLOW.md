# 수정된 에이전트 워크플로우 설계

> **작성일**: 2026-03-31  
> **최종 수정**: 2026-04-04 (노드별 LLM: Gemini 3.1 Pro / Gemini 2.5 Pro / GPT-5 mini, 임베딩 BGE-M3 현행 기준 반영, **orchestrator → infra → agent** 아키텍처 명시)  
> **목적**: DB 테이블 기반 전년도 참조 SR 보고서 자동 생성 워크플로우  
> **핵심 변경**: PDF 파싱 제거, 전년/전전년 본문+이미지 동시 참조, 변화 패턴 학습, **계열사/자회사 상세는 `aggregation_node`에서 집계**, **`external_company_data`는 삼성SDS [언론보도](https://www.samsungsds.com/kr/news/index.html)의 `#bThumbs`·`#sThumbs`(또는 RSS)를 **배치 또는 준실시간 백그라운드 폴링**으로 적재하고, SR 생성 시에는 DB 조회만**, **오케스트레이터·에이전트 간 통신은 `spokes/infra/` 인프라 레이어(in-process MCP) 경유**

---

## 📋 목차

1. [개요](#1-개요)
2. [데이터 구조](#2-데이터-구조)
3. [**노드 아키텍처 및 역할 (신규)**](#3-노드-아키텍처-및-역할)
4. [**Orchestrator 중심 워크플로우 (신규)**](#4-orchestrator-중심-워크플로우)
5. [단계별 상세 로직](#5-단계별-상세-로직)
6. [페이지 선택 전략](#6-페이지-선택-전략)
7. [Gen Node 입력 구조](#7-gen-node-입력-구조)
8. [계열사/자회사·외부 기업 데이터 통합](#8-계열사자회사외부-기업-데이터-통합)
9. [기존 워크플로우와의 차이점](#9-기존-워크플로우와의-차이점)
10. [구현 고려사항](#10-구현-고려사항)

---

## 1. 개요

### 1.1 목적

사용자가 선택한 **DP(Data Point)**와 **카테고리**(예: "협력회사 ESG 관리")를 기반으로, 전년도·전전년도 SR 보고서를 참조하여 **2년간의 변화 패턴을 학습**하고, 최신 데이터로 업데이트된 **현재 연도 SR 보고서**를 자동 생성합니다.

### 1.2 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **DB 중심** | PDF 업로드·파싱 없이 기존 테이블에서 직접 조회 |
| **시계열 학습** | 2개년(전년+전전년) 데이터로 변화 추세 파악 |
| **형식 일관성** | 전년도 문체·구조·이미지 스타일 유지 |
| **데이터 최신성** | 사용자 선택 DP의 최신 값으로 교체 |
| **단일 페이지 참조** | 각 연도당 최상위 유사도 1페이지만 선택 |
| **계열사·외부 데이터** | SR 본문(`c_rag`) + 계열사/외부 스냅샷(`aggregation_node`) 결합 |

### 1.3 입력 및 출력

**입력**:
- 사용자 선택 **DP ID** (예: `UCM_ESRS2_BP_2_17_e__IFRS1_51_a`, `ESRS2-GOV-1-21-a`)
- 사용자 선택 **카테고리** (예: `협력회사 ESG 관리`)
- 대상 **기업 ID** 및 **현재 연도**

**출력**:
- 현재 연도 SR 보고서 문단 (본문)
- 추천 이미지·차트 메타데이터
- 생성 근거 및 참조 출처

---

## 2. 데이터 구조

### 2.1 테이블 분류

#### **그룹 A: 기업 실데이터 테이블 (10개)**

| 테이블명 | 역할 | 사용 시점 |
|---------|------|----------|
| `social_data` | 사회 지표 팩트 데이터 | Step 4: 최신 DP 값 추출 |
| `company_info` | 기업 기본 정보 | Step 4: 최신 DP 값 추출 |
| `environmental_data` | 환경 지표 팩트 데이터 | Step 4: 최신 DP 값 추출 |
| `governance_data` | 지배구조 지표 팩트 데이터 | Step 4: 최신 DP 값 추출 |
| `sr_report_index` | SR 보고서 페이지별 메타데이터 | (미사용: DP는 사용자 입력으로 대체) |
| `sr_report_body` | SR 보고서 본문 | Step 1~2: 전년도 본문 검색·추출 |
| `sr_report_images` | SR 보고서 이미지 | Step 2: 전년도 이미지 추출 |
| `history_sr_reports` | 과거 SR 보고서 이력 | (연도 필터링 참조용) |
| **`subsidiary_data_contributions`** | **계열사/자회사 제공 데이터** | **`aggregation_node`: 사업장별 상세 검색** |
| **`external_company_data`** | **보도·언론 스냅샷 (배치·선택 준실시간 폴링 적재 + 선택적 수동 보완)** | **`aggregation_node`: 적재분 조회 (SR 요청 경로에서 크롤 없음)** |

#### **그룹 B: 기준서·매핑 테이블 (3개)**

| 테이블명 | 역할 | 사용 시점 |
|---------|------|----------|
| `unified_column_mappings` | DP ↔ 실데이터 테이블 컬럼 매핑 | Step 3: DP → 테이블·컬럼 조회 |
| `data_points` | DP 메타데이터 (이름, 단위, 검증 규칙) | Step 3: DP 정보 조회 |
| `rulebooks` | IFRS/GRI 기준서 요구사항 | Step 3: 검증 규칙 조회 |

---

### 2.2 주요 테이블 스키마

#### `sr_report_body`

```sql
CREATE TABLE sr_report_body (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    report_year INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    toc_path TEXT,                      -- 목차 경로 (예: "3.2 협력회사 ESG 관리")
    toc_path_embedding VECTOR(1024),    -- toc_path 임베딩
    subtitle TEXT,                      -- 부제목 (추후 추가 예정)
    subtitle_embedding VECTOR(1024),    -- subtitle 임베딩 (추후 추가)
    body_text TEXT,                     -- 본문
    category_column TEXT,               -- 카테고리 정확 매칭용 컬럼 (예: "협력회사 ESG 관리")
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sr_body_category ON sr_report_body(company_id, report_year, category_column);
CREATE INDEX idx_sr_body_toc_embedding ON sr_report_body USING ivfflat (toc_path_embedding vector_cosine_ops);
```

#### `sr_report_images`

```sql
CREATE TABLE sr_report_images (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    report_year INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    image_path TEXT,                    -- 이미지 파일 경로
    image_type VARCHAR(50),             -- 차트 타입 (bar, line, table, diagram)
    caption TEXT,                       -- 이미지 캡션
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (company_id, report_year, page_number) 
        REFERENCES sr_report_body(company_id, report_year, page_number)
);
```

#### `unified_column_mappings`

```sql
CREATE TABLE unified_column_mappings (
    id UUID PRIMARY KEY,
    dp_id VARCHAR(100) NOT NULL,        -- DP ID
    source_table VARCHAR(100),          -- 소스 테이블명 (예: social_data)
    source_column VARCHAR(100),         -- 소스 컬럼명 (예: employee_count)
    standard VARCHAR(50),               -- 기준서 (IFRS_S1, GRI, ESRS)
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `subsidiary_data_contributions` (신규)

```sql
CREATE TABLE subsidiary_data_contributions (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,              -- 모회사 ID
    subsidiary_name VARCHAR(200),          -- 계열사/자회사명
    facility_name VARCHAR(200),            -- 사업장/시설명 (예: "동탄 데이터센터")
    report_year INTEGER NOT NULL,
    
    -- 컨텍스트 정보
    category TEXT,                         -- 카테고리 (예: "재생에너지", "온실가스")
    category_embedding VECTOR(1024),       -- 카테고리 임베딩
    
    -- 본문 데이터
    description TEXT,                      -- 상세 설명
    description_embedding VECTOR(1024),    -- 본문 임베딩
    
    -- DP 연결
    related_dp_ids TEXT[],                 -- 관련 DP ID 배열
    
    -- 정량 데이터
    quantitative_data JSONB,               -- {"태양광_발전량_kWh": 172497, "설비용량_kW": 374}
    
    -- 메타데이터
    data_source VARCHAR(100),              -- 데이터 출처 (예: "자회사 제출", "EMS 연동")
    submitted_by VARCHAR(200),             -- 제출 담당자/부서
    submission_date DATE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_subsidiary_category_emb 
    ON subsidiary_data_contributions 
    USING ivfflat (category_embedding vector_cosine_ops);

CREATE INDEX idx_subsidiary_desc_emb 
    ON subsidiary_data_contributions 
    USING ivfflat (description_embedding vector_cosine_ops);

CREATE INDEX idx_subsidiary_dp 
    ON subsidiary_data_contributions 
    USING GIN (related_dp_ids);

CREATE INDEX idx_subsidiary_company_year 
    ON subsidiary_data_contributions(company_id, report_year, category);
```

#### `external_company_data` (신규)

**삼성SDS SR 자동작성 플랫폼(주체: 삼성SDS)** 기준으로, 아래 **공식 페이지를 배치(스케줄) 크롤링**해 채우는 테이블입니다. SR **생성 요청 시점**에는 웹을 다시 긁지 않고, 여기에 적재된 스냅샷만 조회합니다. 필요 시 운영자 **수동 주입(폼/파일/API)**으로 동일 테이블을 보완할 수 있습니다.

##### 삼성SDS 뉴스: 크롤링 진입 URL·DOM 위치

| 구분 | 값 |
|------|-----|
| **진입 URL (단일 허용)** | `https://www.samsungsds.com/kr/news/index.html` — 삼성SDS **언론보도** 랜딩 ([공개 페이지](https://www.samsungsds.com/kr/news/index.html)) |
| **보도자료(메인 블록)** | `div#bThumbs` — 클래스 예: `thumbList tabControlBox_content`. 큰 썸네일 + **카테고리·날짜** + **제목** + **요약** + 「자세히 보기」 등 **사내 보도자료** 성격. |
| **언론이 본 삼성SDS(사이드)** | `div#sThumbs` — 클래스 예: `thumbList is_side is_newsTitle tabControlBox_content`. **언론사·날짜** + **제목** 위주, **외부 언론 보도** 성격. |

**구현 시 유의**: 목록 일부는 **클라이언트(JS)에서 채워질 수 있음**. 정적 HTML만으로 부족하면 **헤드리스 렌더링** 또는 사이트 **내부 API** 호출 여부를 확인한다.

**적재 주기**: 운영 정책에 따른 **배치 잡**(예: 일 1회 / 주 1회). **준실시간**이 필요하면 **실행 경로 밖 워커**에서 **짧은 간격 폴링**(예: 5~15분) + **ETag·Last-Modified·목록 해시**로 변경 시에만 파싱·적재하는 방식을 쓸 수 있다(HTML은 푸시가 없어 **진짜 실시간 push는 불가**에 가깝다). **RSS·피드**가 있으면 우선 검토. `fetched_at`·`ingest_batch_id`로 수집 시각·배치 단위를 남긴다. 상세는 [data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md](../../data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md) §5.1.

**`external_company_data` 매핑 가이드 (권장)**:

- `anchor_company_id`: 삼성SDS(모회사) `company_id`
- `source_type`: 예) `#bThumbs` → `homepage`(또는 `press`), `#sThumbs` → `news`
- `source_url`: 기사·보도 **상세 페이지 URL**(목록의 「자세히 보기」/제목 링크)
- `external_org_name`: `#sThumbs`는 **언론사명**; `#bThumbs`는 `NULL` 또는 `Samsung SDS` 등 정책에 따름
- `title` / `body_text`: 제목·요약/본문
- `structured_payload`: 예) `{"section":"bThumbs"|"sThumbs","list_page":"https://www.samsungsds.com/kr/news/index.html"}`

```sql
CREATE TABLE external_company_data (
    id UUID PRIMARY KEY,
    anchor_company_id UUID NOT NULL,       -- 기준 기업(모회사 등) ID — 조회 시 필터
    external_org_name VARCHAR(300),        -- 외부 기업·기관명
    source_type VARCHAR(50) NOT NULL,       -- dart_disclosure, news, homepage, regulator, ...
    source_url TEXT,
    report_year INTEGER,                    -- 연도(없으면 NULL, as_of_date 사용)
    as_of_date DATE,                        -- 스냅샷 기준일

    category TEXT,                          -- SR 카테고리 정렬용 (예: "협력회사 ESG 관리")
    category_embedding VECTOR(1024),

    title TEXT,
    body_text TEXT,                         -- 본문/요약
    body_embedding VECTOR(1024),

    structured_payload JSONB,               -- 정형 필드 (지표, 공시 메타 등)
    related_dp_ids TEXT[],

    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ingest_batch_id UUID,                   -- 배치 크롤/수동 주입 실행 단위 ID

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ext_company_anchor_year
    ON external_company_data(anchor_company_id, report_year, source_type);
CREATE INDEX idx_ext_company_category_emb
    ON external_company_data
    USING ivfflat (category_embedding vector_cosine_ops);
```

---

## 3. 노드 아키텍처 및 역할

### 3.1 노드 구성 개요

본 시스템은 **Star Topology** 구조로, Orchestrator를 중심으로 **실행 경로상 6개** 노드(오케스트레이터 + 전문 노드 5개)가 동작합니다. `external_company_data`는 **실행 경로 밖의 배치·(선택) 준실시간 워커**가 삼성SDS [언론보도 페이지](https://www.samsungsds.com/kr/news/index.html)의 **`#bThumbs`·`#sThumbs`**(또는 RSS)에서 수집·적재하고, (선택) **수동 주입**으로 보완합니다. SR 생성 요청 시에는 **크롤 없이 DB 조회**만 한다.

| 노드명 | 역할 | 입력 | 출력 | 모델 |
|-------|------|------|------|------|
| **`orchestrator`** | 중앙 제어, 데이터 흐름 관리, **Phase 2 동적 데이터 선택**, 재시도 루프 | 사용자 입력 | 최종 보고서 | Gemini 3.1 Pro (분기·재시도), **Gemini 2.5 Pro (Phase 2 데이터 선택)** |
| **`c_rag`** | 카테고리 기반 **SR** 참조 데이터 수집 | 카테고리 | SR 본문, 이미지(연도별) | Gemini 2.5 Pro (Tool/함수 호출) |
| **`dp_rag`** | DP 기반 최신 팩트 데이터 수집 | DP ID | 실데이터 테이블 값 | Gemini 2.5 Flash (`gemini-2.5-flash`, 매핑용 generateContent) |
| **`aggregation_node`** | 계열사/자회사·외부 기업 데이터 **집계·조회** | 카테고리, DP(선택), 기업 ID | 연도별 계열사 상세 + `external_company_data` 매칭분 | Gemini 2.5 Pro (Tool/함수 호출) |
| **`gen_node`** | IFRS 문체 문단 생성 | **정제된 gen_input** (Phase 2 필터링 결과) | 생성된 본문 | GPT-5 mini |
| **`validator_node`** | 검증 및 품질 관리 | 생성 결과 | 검증 결과 | Gemini 3.1 Pro |

### 3.1.1 LLM·임베딩 운영 기준 (현행)

**LLM**은 위 표와 같이 배치한다. 실제 호출은 **Google AI(Gemini)**·**OpenAI(GPT)** 등 배포 환경의 API 키·엔드포인트에 매핑하면 되며, 동일 역할군에 대체 모델을 쓸 경우에도 **도구 호출 가능 여부**(RAG 3노드)·**추론 안정성**(오케스트레이터·검증)을 우선한다.

| 구분 | 모델 | 담당 노드 | 선택 이유 (요약) |
|------|------|-----------|------------------|
| 고역량 추론·판정 | **Gemini 3.1 Pro** | `orchestrator` (분기·재시도), `validator_node` | 분기·재시도·그린워싱·데이터 일관성 등 판단 품질 |
| **컨텍스트 분석·선택** | **Gemini 2.5 Pro** | `orchestrator` (Phase 2 데이터 선택), `c_rag`, `aggregation_node` | **카테고리·DP 분석하여 필요 데이터 동적 선택**, SQL/검색 도구 연계 |
| 경량 매핑 | **Gemini 2.5 Flash** | `dp_rag` | 물리 테이블·컬럼 매핑 (빠른 응답) |
| 고빈도 생성 | **GPT-5 mini** | `gen_node` | 초안·재생성·refine 반복에 따른 비용·지연 완화 |

**임베딩**은 **BGE-M3**를 **현행 운영 모델**로 사용한다. DB 스키마의 `VECTOR(1024)` 컬럼(`sr_report_body` 본문 임베딩, `subsidiary_data_contributions`·`external_company_data`의 category/body 임베딩 등)과 차원을 맞춘다. RAG·유사도 검색용 **쿼리 벡터**(`embed_text` 등)도 동일 **BGE-M3**로 생성해 분포 드리프트를 줄인다. (하이브리드 검색 시 BM25 등 키워드 층은 기존 설계와 병용 가능.)

### 3.1.2 구현 아키텍처: orchestrator → infra → agent

**물리 계층**은 오케스트레이터가 에이전트를 **infra(in-process MCP 추상)** 를 경유해 호출하는 방식으로 구성한다. 이는 **Star Topology 논리 구조**를 유지하면서 **프로토콜·툴 레지스트리·로깅을 단일 레이어(infra)로 통일**하기 위함이다.

| 레이어 | 위치 (예상 경로) | 역할 |
|--------|------------------|------|
| **Orchestrator** | `hub/orchestrator/` | 워크플로 제어: 사용자 요청 분석 → Phase 1 병렬 수집 → **Phase 2 동적 데이터 선택(Gemini 2.5 Pro)** → Phase 3 생성·검증 루프 → 최종 반환. **LLM 기반 분기·재시도** 결정(Gemini 3.1 Pro). |
| **Infra** | `spokes/infra/` | **in-process MCP 추상**: 에이전트·툴 레지스트리, `call_agent(name, action, payload)` / `call_tool(...)` 직렬화, 타임아웃·로깅·권한. **오케스트레이터·에이전트 모두 infra만 의존**. |
| **Agent (c_rag 등)** | `spokes/agents/c_rag/` | 전문 작업 수행: `collect(company_id, category, years)` 진입점, 내부에서 DB/검색 **툴**이 필요하면 다시 `infra.call_tool`로 호출. **오케스트레이터를 직접 import하지 않음**. |

**호출 흐름 예시**:

```python
# hub/orchestrator/orchestrator.py
c_rag_result = await self.infra.call_agent(
    agent_name="c_rag",
    action="collect",
    payload={"company_id": "...", "category": "재생에너지", "years": [2023, 2024]}
)

# → spokes/infra/agent_dispatcher.py (in-process MCP 세션)
registry["c_rag"].collect(payload)  # 에이전트 진입점

# → spokes/agents/c_rag/agent.py
def collect(self, payload):
    # SR 본문 검색 툴 호출
    body = await self.infra.call_tool("query_sr_body", {"category": ...})
    # 이미지 툴 호출
    images = await self.infra.call_tool("query_sr_images", {"report_id": ...})
    return {"2024": {"sr_body": body, "sr_images": images}, ...}
```

**의존성 방향 (단방향 보장)**:

```
orchestrator → infra
agent        → infra
(routing 독립 모듈 제거 — 오케스트레이터 내부 _route 메서드로 단순화)
```

**LangGraph 통합**: 오케스트레이터를 **단일 LangGraph 노드**(`orchestrator_node`)로 등록하고, 내부에서 `infra` 경유·병렬/순차 제어를 **Python 로직**으로 직접 구현한다. LangGraph는 상태 관리·재실행만 담당. (상세는 [§3.1.3](#313-langgraph-환경-구성) 참고.)

### 3.1.3 LangGraph 환경 구성

**방침**: LangGraph는 **최소 관여**(상태 컨테이너·체크포인팅만)하고, 실제 분기·노드 선택은 **오케스트레이터 Python 로직**이 담당한다.

```python
from langgraph.graph import StateGraph
from typing import TypedDict

class WorkflowState(TypedDict):
    user_input: dict
    ref_data: dict
    fact_data: dict
    generated_text: str
    validation: dict
    status: str
    attempt: int

def build_workflow():
    workflow = StateGraph(WorkflowState)
    
    # 단일 노드: orchestrator_node (핵심)
    workflow.add_node("orchestrator_node", orchestrator_run)
    
    # 진입점
    workflow.set_entry_point("orchestrator_node")
    
    # 조건부 간선 (오케스트레이터가 "재시도" 신호 시 자기 자신 다시 호출)
    def should_retry(state: WorkflowState) -> str:
        if state.get("status") == "retry":
            return "orchestrator_node"
        return "__end__"
    
    workflow.add_conditional_edges("orchestrator_node", should_retry, {
        "orchestrator_node": "orchestrator_node",
        "__end__": "__end__"
    })
    
    return workflow.compile()

async def orchestrator_run(state: WorkflowState) -> WorkflowState:
    """LangGraph 노드 — 오케스트레이터 진입점"""
    orchestrator = Orchestrator(infra=get_infra_instance())
    result = await orchestrator.orchestrate(state["user_input"])
    
    state["generated_text"] = result["generated_text"]
    state["validation"] = result["validation"]
    state["status"] = result["metadata"]["status"]
    state["attempt"] = result["metadata"]["attempts"]
    return state
```

**핵심**: LangGraph 그래프는 **`orchestrator_node` 하나**만 두고, 내부에서 오케스트레이터가 `infra → c_rag/dp_rag/aggregation/gen/validator` 모두를 **직접·병렬·순차 제어**한다. 상태 재시도가 필요하면 조건부 간선으로 **동일 노드**를 다시 호출한다. 이렇게 하면 **LangGraph는 상태 관리 컨테이너**에 가깝고, **에이전틱 루프는 오케스트레이터가 담당**한다.

### 3.2 노드별 상세 설명

#### 3.2.1 Orchestrator (오케스트레이터)

**역할**:
- 전체 워크플로우 제어 및 노드 호출 순서 결정
- **Phase 1**에서 `c_rag`, `dp_rag`, `aggregation_node` **병렬** 호출 후 `ref_data`와 `agg_data` 병합
- 생성-검증 반복 루프 관리 (최대 3회)
- 최종 결과 통합 및 반환

**핵심 기능**:
```python
class Orchestrator:
    async def orchestrate(self, user_input: dict) -> dict:
        # 1. 병렬 데이터 수집 (c_rag, dp_rag, aggregation_node)
        # 2. ref_data + agg_data 병합 → gen_node 입력 준비
        # 3. 생성-검증 반복 루프 (최대 3회)
        # 4. 최종 반환
```

**모델**: **Gemini 3.1 Pro**
- 복잡한 의사결정·상태 전이(재시도·경로 선택)
- (필요 시) 경량 규칙과 병행해 LLM 기반 분기만 사용하는 구성도 가능

---

#### 3.2.2 c_rag (카테고리 기반 참조 데이터 수집 노드)

**역할**:
- 사용자 선택 카테고리로 전년/전전년도 **SR 보고서**만 검색
- 각 연도별 **본문 + 이미지** 추출 (계열사/외부 기업 데이터는 **`aggregation_node`로 분리**)

**처리 흐름**:
1. `sr_report_body` 테이블에서 카테고리 검색 (정확 매칭 → 벡터 검색)
2. 각 연도별 최상위 유사도 페이지 1개 선택
3. `sr_report_images` JOIN으로 이미지 추출

**출력 구조**:
```python
{
    "2024": {
        "sr_body": "본문...",
        "sr_images": [...],
    },
    "2023": {
        "sr_body": "본문...",
        "sr_images": [...],
    }
}
```

**모델**: **Gemini 2.5 Pro** (Tool/함수 호출)
- 벡터 검색·SQL·DB 조회 도구를 안정적으로 호출

---

#### 3.2.3 dp_rag (DP 기반 팩트 데이터 수집 노드)

**역할**:
- 사용자 선택 DP의 최신 값 추출
- `unified_column_mappings`로 소스 테이블·컬럼 매핑
- 실데이터 테이블(`social_data`, `environmental_data` 등)에서 조회

**처리 흐름**:
1. `unified_column_mappings` 조회 → DP → 테이블·컬럼 매핑
2. `data_points` 조회 → DP 메타데이터 (단위, 검증 규칙)
3. 동적 쿼리 생성 → 실데이터 테이블에서 최신 값 추출
4. 데이터 유효성 검사 (오래됨 여부, 누락 여부)

**출력 구조**:
```python
{
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
    "dp_meta": {...},
    "latest_value": 200,
    "is_outdated": False,
    "source": "social_data.supplier_esg_evaluation_count"
}
```

**모델**: **Gemini 2.5 Pro** (Tool/함수 호출)

---

#### 3.2.4 aggregation_node (계열사·외부 기업 데이터 집계 노드)

**역할**:
- **`subsidiary_data_contributions`**: 계열사/자회사 **회사명·사업장·카테고리·본문(description)·정량값** 등 사업장별 상세 검색·정렬
- **`external_company_data`**: 배치 크롤(삼성SDS 뉴스 `#bThumbs`/`#sThumbs`)·수동 보완으로 적재된 보도·언론 스냅샷을 카테고리/DP/연도 기준으로 조회
- 연도별(전년·전전년)로 묶어 Orchestrator가 `ref_data`와 병합하기 쉬운 형태로 반환

**처리 흐름**:
1. `subsidiary_data_contributions`에 대해 기존 문서의 계열사 검색 로직(정확 매칭 → 벡터) 실행
2. 동일 `company_id`·대상 연도·카테고리(및 임베딩)로 `external_company_data` 상위 N건 조회
3. (선택) `related_dp_ids`와 사용자 DP 교차 필터로 노이즈 감소

**출력 구조**:
```python
{
    "2024": {
        "subsidiary_data": [...],       # 사업장별 상세 (기존 스키마와 동일 계열)
        "external_company_data": [...], # 배치 크롤·수동 보완 스냅샷 행 목록
    },
    "2023": {
        "subsidiary_data": [...],
        "external_company_data": [...],
    }
}
```

**모델**: **Gemini 2.5 Pro** (Tool/함수 호출)

---

#### 3.2.5 gen_node (문단 생성 노드)

**역할**:
- 수집된 모든 데이터를 기반으로 IFRS 문체 문단 생성
- **2가지 모드 지원**: draft_mode (초안 생성), refine_mode (사용자 수정)

**2가지 동작 모드**:

##### **A. draft_mode (초안 생성 모드)**

**트리거**: Orchestrator가 첫 생성 시 또는 validator 재시도 시

**입력 데이터**:
- SR 본문 (2년치, `c_rag`)
- SR 이미지 (2년치, `c_rag`)
- 계열사·외부 기업 데이터 (2년치, `aggregation_node` 병합분)
- 최신 DP 값 (`dp_rag`)
- DP 메타데이터
- (선택적) validator 피드백

**생성 지시**:
1. 2023→2024 변화 패턴 학습
2. 2024년 문체·구조 유지
3. SR 본문(전체 요약) + 계열사 데이터(구체적 사례) 통합
4. 데이터만 2025년 값으로 업데이트

**출력 구조**:
```python
{
    "generated_text": "생성된 본문 (300~500자)",
    "mode": "draft",
    "rationale": "생성 근거",
    "recommended_images": [...],
    "references": ["2023년 15페이지", "2024년 12페이지"],
    "has_feedback": False  # validator 피드백 반영 여부
}
```

##### **B. refine_mode (사용자 수정 모드)**

**트리거**: 사용자가 이미 생성·저장된 페이지를 보고 수정 요청

**입력 데이터**:
- 기존 생성 문단 (previous_text)
- **사용자 수정 요청** (user_instruction)
- 스타일 가이드 (고정)
- 수치 레지스트리 (동적)

**5 Block 구조 프롬프트**:
```
Block 1: 스타일 가이드 (고정)
Block 2: 수치 레지스트리 (동적)
Block 3: 이전 생성 문단 (기존 페이지)
Block 4: 사용자 수정 요청 (자유 텍스트)
Block 5: 수정 지시 (핵심 변경)
```

**출력 구조**:
```python
{
    "generated_text": "수정된 본문",
    "mode": "refine",
    "user_instruction": "재무 효과를 더 강조해주세요",
    "previous_text": "이전 문단...",
    "changes_summary": "재무 효과 구체화, 수치 추가"
}
```

**모델**: **GPT-5 mini**
- 초안·validator 재시도·`refine_mode` 등 **호출 빈도**가 높아 비용·지연을 완화
- IFRS 문체·용어는 **프롬프트·스타일 가이드**로 보정 (필요 시 소형 검증 패스 추가)

---

#### 3.2.6 validator_node (검증 노드)

**역할**:
- 생성된 문단의 품질 검증
- DP 규칙 준수, 형식 일관성, 그린워싱 탐지

**검증 항목**:

| 항목 | 설명 | 방법 |
|------|------|------|
| **dp_compliance** | DP 검증 규칙 준수 (범위, 타입) | 규칙 기반 |
| **format_check** | 전년도 대비 형식 유사도 | 코사인 유사도 |
| **greenwashing_check** | 과장 표현 탐지 | LLM 기반 |
| **ifrs_compliance** | IFRS S1/S2 요구사항 준수 | 규칙 기반 |
| **data_consistency** | 텍스트 vs 입력 데이터 일치 | 정규식 + LLM |

**출력 구조**:
```python
{
    "is_valid": True,
    "errors": [],
    "warnings": [],
    "greenwashing_score": 0.15,
    "scores": {
        "dp_compliance": 1.0,
        "format_similarity": 0.92,
        "data_consistency": 1.0
    }
}
```

**모델**: **Gemini 3.1 Pro**
- 그린워싱·과장 표현, 텍스트·팩트 불일치 등 **LLM 검증** 항목의 판정 품질
- 규칙 기반 항목(`dp_compliance` 등)과 병행

---

#### 3.2.7 `external_company_data` 배치 크롤·수동 보완 (실행 경로 외)

**역할** (노드가 아닌 **인제스션 잡/서비스**):

1. **기본(자동)**: 고정 진입 URL `https://www.samsungsds.com/kr/news/index.html` 에서 **`div#bThumbs`**(보도자료 메인)·**`div#sThumbs`**(언론이 본 삼성SDS) 내 기사 항목을 주기적으로 수집한다.
2. **보완(선택)**: 운영자가 웹 폼/엑셀/API로 추가 사례를 넣어 동일 테이블에 **INSERT/UPSERT**할 수 있다.
3. **준실시간(선택)**: 동일 URL을 **고빈도 폴링**(분 단위)하되, **변경 감지 후에만** 전체 파싱·적재. **RSS**가 있으면 HTML보다 우선 검토. 모두 **요청 경로 밖 워커**에서만 수행.
4. SR 생성 API 호출 시에는 **크롤링하지 않음** — 신선도는 **배치·폴링 주기·`fetched_at`**으로 관리한다.

**와이어 관계**:
- `aggregation_node`는 이 테이블만 **읽기**
- 크롤/적재 실패·빈 테이블이면 내부 DB만으로 진행하거나, 운영 정책에 따라 사용자 알림

---

### 3.3 Star Topology 구조

```
                    ┌─────────────────────┐
                    │                     │
                    │   Orchestrator      │
                    │   (중앙 제어)        │
                    │                     │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐     ┌──────────────────┐
│   c_rag       │      │   dp_rag      │     │ aggregation_node │
└───────┬───────┘      └───────┬───────┘     └────────┬─────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Orchestrator      │
                    │   (데이터 통합)      │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
            ┌───────────────┐     ┌──────────────┐
            │   gen_node    │     │validator_node│
            └───────┬───────┘     └──────┬───────┘
                    │                     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Orchestrator      │
                    │   (최종 반환)        │
                    └─────────────────────┘
```

**핵심 원칙**:
- ✅ 모든 노드는 Orchestrator만 호출
- ✅ 노드 간 직접 통신 없음
- ✅ Orchestrator가 모든 데이터 흐름 제어

---

## 4. Orchestrator 중심 워크플로우

### 4.1 3가지 실행 경로

Orchestrator는 사용자 요청(`action`)에 따라 3가지 경로로 분기합니다.

```
                    Orchestrator
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   [경로 1]         [경로 2]         [경로 3]
  초안 생성      validator 재시도   사용자 수정
  (draft)         (draft)          (refine)

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ gen_node    │  │ gen_node    │  │ gen_node    │
│ (draft)     │  │ (draft +    │  │ (refine)    │
│             │  │  feedback)  │  │             │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       ▼                ▼                ▼
  validator       validator         사용자 확인
       │                │                │
       ├─ 성공 → 저장   ├─ 성공 → 저장   └─ 완료
       │                │
       └─ 실패 → 재시도 └─ 실패 → 재시도
            (경로 2)         (경로 2)
```

#### **경로 1: 초안 생성 (action: "create")**

**트리거**: 사용자가 새 섹션 생성 요청

**실행 흐름**:
1. 데이터 수집 (Phase 1)
2. gen_node (draft_mode, 첫 시도)
3. validator_node 검증
4. 성공 → 저장 / 실패 → 경로 2

**사용자 요청 예시**:
```json
{
    "action": "create",
    "dp_id": "UCM_ESRS2_BP_2_17_e",
    "category": "협력회사 ESG 관리"
}
```

---

#### **경로 2: Validator 자동 재시도 (action: "create" 실패 시)**

**트리거**: validator 검증 실패 (시스템 자동)

**실행 흐름**:
1. validator 피드백 수집
2. gen_node (draft_mode, feedback 추가)
3. validator_node 재검증
4. 최대 3회 반복

**핵심**:
- ✅ 여전히 draft_mode 사용 (refine_mode 아님)
- ✅ 시스템 내부 자동 처리
- ✅ 사용자에게 보이지 않음 (최종 결과만 표시)

**validator 피드백 예시**:
```python
feedback = [
    "재무 연결성 누락: 비용 절감 효과 명시 필요",
    "과장 표현 발견: '획기적인' 제거",
    "형식 불일치: 2024년은 4문장, 생성문은 6문장"
]
```

---

#### **경로 3: 사용자 수정 요청 (action: "refine")**

**트리거**: 사용자가 이미 생성·저장된 페이지를 보고 수정 요청

**실행 흐름**:
1. 기존 페이지 로드
2. gen_node (refine_mode, 사용자 지시사항 반영)
3. (선택적) validator 실행 → 경고만 표시
4. 사용자 확인 후 저장

**핵심**:
- ✅ refine_mode 사용
- ✅ 사용자 자유 텍스트 입력
- ⚠️ validator 필수 통과 아님 (사용자 만족도 기준)

**사용자 요청 예시**:
```json
{
    "action": "refine",
    "report_id": "report_12345",
    "page_number": 12,
    "user_instruction": "재무 효과를 더 구체적으로 강조하고, 문체를 더 격식있게 바꿔주세요"
}
```

---

### 4.2 전체 실행 흐름 (경로 1 & 2: 초안 생성)

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 입력                              │
│   - action: "create"                                        │
│   - DP ID: "UCM_ESRS2_BP_2_17_e__IFRS1_51_a"                │
│   - 카테고리: "협력회사 ESG 관리"                            │
│   - 기업 ID: company_123                                    │
│   - 현재 연도: 2025                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: 병렬 데이터 수집                                   │
│                                                             │
│  c_rag, dp_rag, aggregation_node 동시 시작·완료 대기        │
│  (요청 경로에서 실시간 웹 크롤링 없음)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: 데이터 통합 및 필터링 (LLM 기반 동적 선택)         │
│                                                             │
│  1. LLM 분석 (Gemini 2.5 Pro)                               │
│     - 카테고리·DP·SR 본문 분석                               │
│     - 필요한 데이터 선택 결정                                │
│                                                             │
│  2. gen_input 구성 (필터링된 데이터만)                       │
│     - SR 본문·이미지 (2024, 2023) — c_rag                   │
│     - 계열사 + external_company_data — aggregation (선택적)  │
│     - 최신 DP 값 + company_profile — dp_rag (선택적)        │
│                                                             │
│  상세: docs/orchestrator/PHASE2_DATA_SELECTION.md           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: 생성-검증 반복 루프 (최대 3회) - draft_mode       │
│                                                             │
│  Iteration 1 (경로 1):                                      │
│    Orchestrator → gen_node (draft) → Orchestrator           │
│    Orchestrator → validator_node → Orchestrator             │
│    검증 결과: 실패 → feedback 추가                           │
│                                                             │
│  Iteration 2 (경로 2):                                      │
│    Orchestrator → gen_node (draft + feedback) → Orchestrator│
│    Orchestrator → validator_node → Orchestrator             │
│    검증 결과: 성공 ✓                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: 최종 결과 반환                                     │
│                                                             │
│  - 생성된 SR 보고서 문단 (2025년)                            │
│  - 추천 이미지 메타데이터                                    │
│  - 참조 출처 (2023, 2024 페이지 번호)                        │
│  - 검증 결과 (점수, 경고사항)                                │
│  - 메타데이터 (시도 횟수, 외부 스냅샷 사용 여부 등)          │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.3 Phase 1: 병렬 데이터 수집 (c_rag · dp_rag · aggregation_node)

#### 4.3.0 실행 타임라인

```
시간축:  0초                    T완료
         │                       │
c_rag:   ████████████░░░░░░░░░░░│ (SR 본문·이미지)
         │                       │
dp_rag:  ████████████░░░░░░░░░░░│ (최신 DP 팩트)
         │                       │
agg:     ████████████░░░░░░░░░░░│ (계열사 + external_company_data)
         │                       │
         └──── asyncio.gather ──┘
```

#### 4.3.1 데이터 충분성 판단 로직

```python
def _check_data_sufficiency(merged_ref_data, fact_data) -> bool:
    """
    데이터 충분성 판단 (병합 후 merged_ref_data 기준)

    조건:
    1. DP 값 존재
    2. DP 값 최신 (6개월 이내)
    3. SR 2개년 데이터 존재
    4. 계열사 데이터 1개 이상 (선택적 — 정책에 따라 완화 가능)
    """
    if not fact_data.get("latest_value"):
        return False
    if fact_data.get("is_outdated"):
        return False
    if not (merged_ref_data.get("2024") and merged_ref_data.get("2023")):
        return False
    if len(merged_ref_data["2024"].get("subsidiary_data", [])) == 0:
        return False
    return True
```

#### 4.3.2 병렬 수집 및 병합

```python
async def parallel_collect(self, user_input):
    c_rag_task = asyncio.create_task(self.c_rag.collect(...))
    dp_rag_task = asyncio.create_task(self.dp_rag.collect(...))
    agg_task = asyncio.create_task(self.aggregation_node.collect(...))

    ref_data, fact_data, agg_data = await asyncio.gather(
        c_rag_task, dp_rag_task, agg_task
    )

    merged_ref = self._merge_ref_and_agg(ref_data, agg_data)
    # merged_ref[연도] = { sr_body, sr_images, subsidiary_data, external_company_data }

    return {
        "ref_data": merged_ref,
        "fact_data": fact_data,
        "agg_raw": agg_data,  # 디버깅·로깅용 (선택)
    }
```

### 4.4 Phase 3: 생성-검증 반복 루프 (경로 1 → 2)

#### 4.3.1 반복 루프 구조 (경로 1 → 경로 2)

```python
async def generation_validation_loop(self, state, max_retries=3):
    """
    생성-검증 반복 루프 (draft_mode)
    
    - 경로 1: 첫 시도 (feedback 없음)
    - 경로 2: validator 재시도 (feedback 반영)
    - 최대 3회 시도
    """
    for attempt in range(max_retries):
        # draft_mode (피드백 있으면 반영)
        generated = await self.gen_node.generate(
            state=state,
            mode="draft",
            feedback=state.get("feedback")  # 경로 2에서만 존재
        )
        
        state["generated_text"] = generated["text"]
        
        # 검증
        validation = await self.validator_node.validate(state)
        
        # 성공: 루프 종료
        if validation["is_valid"]:
            state["validation"] = validation
            state["status"] = "success"
            break
        
        # 실패: 피드백 저장 후 재시도 (경로 2)
        state["feedback"] = validation["errors"]
        state["attempt"] = attempt + 1
        
        if attempt == max_retries - 1:
            # 최대 시도 초과
            state["status"] = "max_retries_exceeded"
            state["validation"] = validation
    
    return state
```

#### 4.4.2 피드백 기반 재생성 예시 (경로 2)

```python
# Iteration 1 (경로 1): 초기 생성
state = {
    "ref_data": {...},
    "fact_data": {...},
    "feedback": None  # 피드백 없음
}
generated = gen_node.generate(state, mode="draft")
# → "당사는 협력회사 ESG 평가를 200개사로 확대..."

validation = validator_node.validate(state)
# → {"is_valid": False, "errors": ["재무 연결성 누락"]}

# Iteration 2 (경로 2): validator 피드백 반영 재생성
state["feedback"] = ["재무 연결성을 명시하세요"]
generated = gen_node.generate(state, mode="draft")
# → "당사는 협력회사 ESG 평가를 200개사로 확대하여, 
#     공급망 리스크 관리 비용을 전년 대비 15% 절감..."

validation = validator_node.validate(state)
# → {"is_valid": True}  ✓
```

---

### 4.5 사용자 수정 요청 워크플로우 (경로 3)

#### 4.5.1 refine_mode 실행 흐름

```python
async def _refine_existing_report(self, user_input: dict) -> dict:
    """
    경로 3: 사용자 수정 요청 (refine_mode)
    
    - validator 필수 통과 아님
    - 사용자 만족도가 기준
    """
    # 1. 기존 페이지 로드
    existing_page = self._load_from_db(
        report_id=user_input["report_id"],
        page_number=user_input["page_number"]
    )
    
    # 2. refine_mode 실행
    refined = await self.gen_node.generate(
        state=existing_page["state"],
        mode="refine",
        previous_text=existing_page["generated_text"],
        user_instruction=user_input["user_instruction"]
    )
    
    # 3. validator 선택적 실행 (참고용)
    validation = await self.validator_node.validate({
        **existing_page["state"],
        "generated_text": refined["text"]
    })
    
    # 4. 사용자에게 결과 + 경고 반환
    return {
        "generated_text": refined["text"],
        "previous_text": existing_page["generated_text"],
        "validation": validation,  # 참고용 (강제 아님)
        "user_instruction": user_input["user_instruction"],
        "mode": "refine"
    }
```

#### 4.5.2 refine_mode 5 Block 프롬프트 구조

```python
def _build_refine_prompt(
    state: dict,
    previous_text: str,
    user_instruction: str
) -> str:
    """refine_mode 프롬프트 (5 Block 구조)"""
    return f"""
당신은 IFRS SR 보고서 작성자입니다.

## Block 1: 스타일 가이드 (고정)
- IFRS S1/S2 문체 사용
- 재무 연결성 명시
- 객관적 톤 유지
- 과장 표현 금지

## Block 2: 수치 레지스트리 (동적)
- {state["fact_data"]["dp_meta"]["name_ko"]}: {state["fact_data"]["latest_value"]} {state["fact_data"]["dp_meta"]["unit"]}
- 2023년: {추출된 값}
- 2024년: {추출된 값}
- 증감률: {계산된 증감률}%

## Block 3: 이전 생성 문단 (교체)
=== 현재 문단 ===
{previous_text}

## Block 4: 사용자 수정 요청 (교체)
=== 사용자 지시사항 ===
{user_instruction}

## Block 5: 수정 지시 (핵심 변경)
위 "사용자 지시사항"을 반영하여 "현재 문단"을 수정하세요.

주의사항:
- Block 1 스타일 가이드 준수
- Block 2 수치 레지스트리 값 활용
- 사용자 요청 사항을 정확히 반영
- 불필요한 변경 최소화 (요청 부분만 수정)

수정된 문단을 생성하세요.
"""
```

---

### 4.5 전체 Orchestrator 구현 (3가지 경로 통합)

```python
async def generation_validation_loop(self, state, max_retries=3):
    """
    생성-검증 반복 루프
    
    - 최대 3회 시도
    - 검증 실패 시 피드백 추가 후 재생성
    - 검증 성공 시 즉시 종료
    """
    for attempt in range(max_retries):
        # Step 1: 문단 생성
        generated = await self.gen_node.generate(state)
        state["generated_text"] = generated["text"]
        
        # Step 2: 검증
        validation = await self.validator_node.validate(state)
        
        # Step 3: 결과 확인
        if validation["is_valid"]:
            # 성공: 루프 종료
            state["validation"] = validation
            state["status"] = "success"
            break
        
        # Step 4: 실패 시 피드백 추가
        state["feedback"] = validation["errors"]
        state["attempt"] = attempt + 1
        
        if attempt == max_retries - 1:
            # 최대 시도 초과
            state["status"] = "max_retries_exceeded"
            state["validation"] = validation
    
    return state
```

#### 4.3.2 피드백 기반 재생성

```python
# Iteration 1: 초기 생성
state = {
    "ref_data": {...},
    "fact_data": {...},
    "feedback": None  # 피드백 없음
}
generated = gen_node.generate(state)
# → "당사는 협력회사 ESG 평가를 200개사로 확대..."

validation = validator_node.validate(state)
# → {"is_valid": False, "errors": ["재무 연결성 누락"]}

# Iteration 2: 피드백 반영 재생성
state["feedback"] = ["재무 연결성을 명시하세요"]
generated = gen_node.generate(state)
# → "당사는 협력회사 ESG 평가를 200개사로 확대하여, 
#     공급망 리스크 관리 비용을 전년 대비 15% 절감..."

validation = validator_node.validate(state)
# → {"is_valid": True}  ✓
```

#### 4.3.3 Star Topology 유지 확인

**중요**: 반복 루프는 Orchestrator **내부** 로직입니다.

```
❌ 잘못된 이해 (Star 깨짐):
gen_node ──▶ validator_node  (직접 통신)

✅ 올바른 구조 (Star 유지):
Orchestrator ──▶ gen_node ──▶ Orchestrator
Orchestrator ──▶ validator_node ──▶ Orchestrator
Orchestrator ──▶ gen_node ──▶ Orchestrator (재시도)
```

**gen_node와 validator_node는 서로를 모릅니다!**

---

### 4.4 전체 Orchestrator 구현 (Pseudo Code)

```python
class Orchestrator:
    def __init__(self):
        self.c_rag = CRagNode()
        self.dp_rag = DpRagNode()
        self.aggregation_node = AggregationNode()
        self.gen_node = GenNode()
        self.validator_node = ValidatorNode()
    
    async def orchestrate(self, user_input: dict) -> dict:
        """
        전체 워크플로우 제어
        
        action에 따라 분기:
        - "create": 경로 1 → 경로 2 (초안 생성 + validator 루프)
        - "refine": 경로 3 (사용자 수정 요청)
        """
        if user_input["action"] == "create":
            # 경로 1 → 경로 2
            return await self._create_new_report(user_input)
        
        elif user_input["action"] == "refine":
            # 경로 3
            return await self._refine_existing_report(user_input)
    
    async def _create_new_report(self, user_input: dict) -> dict:
        """
        경로 1 → 경로 2: 초안 생성 + validator 자동 재시도
        
        Phase 1: 병렬 데이터 수집 (c_rag, dp_rag, aggregation_node)
        Phase 2: 데이터 통합
        Phase 3: 생성-검증 반복 루프 (draft_mode)
        Phase 4: 최종 반환
        """
        # Phase 1: 병렬 데이터 수집
        data = await self._parallel_collect(user_input)
        
        state = {
            "ref_data": data["ref_data"],
            "fact_data": data["fact_data"],
            "user_input": user_input,
            "feedback": None
        }
        
        # Phase 2: 데이터 통합
        state = self._merge_data(state)
        
        # Phase 3: 생성-검증 반복 루프
        state = await self._generation_validation_loop(state, max_retries=3)
        
        # Phase 4: 최종 결과 반환
        return {
            "generated_text": state["generated_text"],
            "validation": state["validation"],
            "references": {
                "sr_pages": [
                    state["ref_data"]["2024"]["page_number"],
                    state["ref_data"]["2023"]["page_number"]
                ],
                "subsidiary_data": state["ref_data"]["2024"]["subsidiary_data"],
                "fact_data": state["fact_data"]
            },
            "metadata": {
                "attempts": state.get("attempt", 0) + 1,
                "external_company_snapshot_used": bool(
                    state["ref_data"].get("2024", {}).get("external_company_data")
                    or state["ref_data"].get("2023", {}).get("external_company_data")
                ),
                "status": state["status"],
                "mode": "draft"
            }
        }
    
    async def _refine_existing_report(self, user_input: dict) -> dict:
        """
        경로 3: 사용자 수정 요청 (refine_mode)
        
        - validator 필수 통과 아님
        - 사용자 만족도가 기준
        """
        # 1. 기존 페이지 로드
        existing_page = self._load_from_db(
            report_id=user_input["report_id"],
            page_number=user_input["page_number"]
        )
        
        # 2. refine_mode 실행
        refined = await self.gen_node.generate(
            state=existing_page["state"],
            mode="refine",
            previous_text=existing_page["generated_text"],
            user_instruction=user_input["user_instruction"]
        )
        
        # 3. validator 선택적 실행 (참고용)
        validation = await self.validator_node.validate({
            **existing_page["state"],
            "generated_text": refined["text"]
        })
        
        # 4. 사용자에게 결과 + 경고 반환
        return {
            "generated_text": refined["text"],
            "previous_text": existing_page["generated_text"],
            "validation": validation,  # 참고용 (강제 아님)
            "user_instruction": user_input["user_instruction"],
            "mode": "refine",
            "warnings": validation["warnings"] if not validation["is_valid"] else []
        }
    
    async def _parallel_collect(self, user_input):
        """Phase 1: c_rag · dp_rag · aggregation_node 병렬 수집 후 병합"""
        # ... (4.3.2 parallel_collect와 동일)
    
    async def _generation_validation_loop(self, state, max_retries=3):
        """Phase 3: 생성-검증 반복 루프 (draft_mode)"""
        for attempt in range(max_retries):
            # draft_mode (피드백 있으면 반영)
            generated = await self.gen_node.generate(
                state=state,
                mode="draft",
                feedback=state.get("feedback")
            )
            
            state["generated_text"] = generated["text"]
            
            # 검증
            validation = await self.validator_node.validate(state)
            
            # 성공: 루프 종료
            if validation["is_valid"]:
                state["validation"] = validation
                state["status"] = "success"
                break
            
            # 실패: 피드백 저장 후 재시도
            state["feedback"] = validation["errors"]
            state["attempt"] = attempt + 1
            
            if attempt == max_retries - 1:
                # 최대 시도 초과
                state["status"] = "max_retries_exceeded"
                state["validation"] = validation
        
        return state
```

---

### 4.6 gen_node 구현 (2가지 모드 통합)

```python
class GenNode:
    def __init__(self):
        self.llm = GPT_5_MINI  # 문단 생성 전용 (고빈도 호출)
    
    async def generate(
        self,
        state: dict,
        mode: Literal["draft", "refine"] = "draft",
        feedback: Optional[List[str]] = None,      # 경로 2: validator 피드백
        previous_text: Optional[str] = None,       # 경로 3: 기존 문단
        user_instruction: Optional[str] = None     # 경로 3: 사용자 지시
    ) -> dict:
        """
        2가지 모드 지원 생성 함수
        
        draft_mode:
          - 경로 1: 초안 생성 (feedback=None)
          - 경로 2: validator 재시도 (feedback 있음)
        
        refine_mode:
          - 경로 3: 사용자 수정 (previous_text + user_instruction 필수)
        """
        if mode == "draft":
            return await self._generate_draft(state, feedback)
        
        elif mode == "refine":
            if not previous_text or not user_instruction:
                raise ValueError("refine_mode requires previous_text and user_instruction")
            
            return await self._refine_by_user(
                state=state,
                previous_text=previous_text,
                user_instruction=user_instruction
            )
    
    async def _generate_draft(
        self,
        state: dict,
        feedback: Optional[List[str]] = None
    ) -> dict:
        """
        draft_mode: 초안 생성
        
        경로 1: feedback 없음 (첫 시도)
        경로 2: feedback 있음 (validator 재시도)
        """
        prompt = self._build_draft_prompt(state)
        
        # validator 피드백이 있으면 프롬프트에 추가
        if feedback:
            prompt += f"""
            
## 이전 시도의 문제점 (자동 검증 실패)
{chr(10).join(f'- {fb}' for fb in feedback)}

위 문제를 개선하여 다시 생성하세요.
"""
        
        response = await self.llm.generate(prompt)
        
        return {
            "text": response,
            "mode": "draft",
            "has_feedback": feedback is not None,
            "rationale": "초안 생성" if not feedback else f"피드백 반영 재생성 ({len(feedback)}개 개선)"
        }
    
    async def _refine_by_user(
        self,
        state: dict,
        previous_text: str,
        user_instruction: str
    ) -> dict:
        """
        refine_mode: 사용자 수정 요청
        
        경로 3: 사용자가 생성된 페이지를 보고 수정 요청
        """
        prompt = self._build_refine_prompt(
            state=state,
            previous_text=previous_text,
            user_instruction=user_instruction
        )
        
        response = await self.llm.generate(prompt)
        
        return {
            "text": response,
            "mode": "refine",
            "user_instruction": user_instruction,
            "previous_text": previous_text,
            "rationale": f"사용자 수정: {user_instruction[:50]}..."
        }
    
    def _build_draft_prompt(self, state: dict) -> str:
        """draft_mode 프롬프트 (간결)"""
        return f"""
당신은 IFRS S1/S2 기준 SR 보고서 작성 전문가입니다.

## 입력 정보

### [1] 전전년도(2023) 참조
**본문**: {state["ref_data"]["2023"]["sr_body"]}
**계열사 데이터**: {state["ref_data"]["2023"]["subsidiary_data"]}
**외부 기업 스냅샷**: {state["ref_data"]["2023"].get("external_company_data", [])}

### [2] 전년도(2024) 참조
**본문**: {state["ref_data"]["2024"]["sr_body"]}
**계열사 데이터**: {state["ref_data"]["2024"]["subsidiary_data"]}
**외부 기업 스냅샷**: {state["ref_data"]["2024"].get("external_company_data", [])}

### [3] 현재 연도(2025) 데이터
**DP**: {state["fact_data"]["dp_meta"]["name_ko"]}
**최신 값**: {state["fact_data"]["latest_value"]} {state["fact_data"]["dp_meta"]["unit"]}

## 생성 지시
1. 2024년 문체와 구조를 유지하세요
2. 2023→2024 변화 패턴을 2024→2025에 반영하세요
3. 계열사 데이터를 구체적 사례로 활용하세요
4. 재무 연결성을 명시하세요

생성하세요.
"""
    
    def _build_refine_prompt(
        self,
        state: dict,
        previous_text: str,
        user_instruction: str
    ) -> str:
        """refine_mode 프롬프트 (5 Block 구조)"""
        return f"""
당신은 IFRS SR 보고서 작성자입니다.

## Block 1: 스타일 가이드 (고정)
- IFRS S1/S2 문체 사용
- 재무 연결성 명시
- 객관적 톤 유지
- 과장 표현 금지

## Block 2: 수치 레지스트리 (동적)
### DP 값
- {state["fact_data"]["dp_meta"]["name_ko"]}: {state["fact_data"]["latest_value"]} {state["fact_data"]["dp_meta"]["unit"]}

### 시계열 비교
- 2023년: {추출된 2023년 값}
- 2024년: {추출된 2024년 값}
- 2025년: {state["fact_data"]["latest_value"]}
- 2024→2025 증감: {증감률}%

## Block 3: 이전 생성 문단 (교체)
=== 현재 문단 ===
{previous_text}

## Block 4: 사용자 수정 요청 (교체)
=== 사용자 지시사항 ===
{user_instruction}

## Block 5: 수정 지시 (핵심 변경)
위 "사용자 지시사항"을 반영하여 "현재 문단"을 수정하세요.

주의사항:
1. Block 1 스타일 가이드를 준수하세요
2. Block 2 수치 레지스트리의 값을 활용하세요
3. 사용자 요청 사항을 정확히 반영하세요
4. 불필요한 변경을 최소화하세요 (요청 부분만 수정)

수정된 문단을 생성하세요.
"""

```

---

### 4.7 UI/UX 시나리오

#### 시나리오 A: 초안 생성 (경로 1 → 2)

```
[사용자 화면]

┌────────────────────────────────────────────┐
│ 새 섹션 생성                                │
│                                            │
│ DP 선택: "협력회사 ESG 평가 실시 현황"      │
│ 카테고리: "협력회사 ESG 관리"               │
│                                            │
│ [생성 시작] 버튼                            │
└────────────────────────────────────────────┘

[클릭 후]

생성 중... (draft_mode)
 ↓
자동 검증 중... (validator)
 ↓ (실패 - 사용자에게 보이지 않음)
 ↓
재생성 중... (draft_mode + feedback)
 ↓
자동 검증 중...
 ↓ (성공 ✓)
 ↓
[생성 완료]

┌────────────────────────────────────────────┐
│ 생성된 페이지                               │
│                                            │
│ "당사는 협력회사 ESG 평가 체계를 강화하여    │
│  200개사로 확대하였으며, 이는 공급망        │
│  리스크 관리 비용을 연간 약 3억원 절감하는  │
│  효과를 가져왔습니다..."                    │
│                                            │
│ [저장] [수정 요청] 버튼                     │
└────────────────────────────────────────────┘
```

---

#### 시나리오 B: 사용자 수정 (경로 3)

```
[사용자 화면 - 이미 저장된 페이지]

┌────────────────────────────────────────────┐
│ 페이지 12: 협력회사 ESG 관리                │
│                                            │
│ "당사는 협력회사 ESG 평가 체계를 강화하여    │
│  200개사로 확대하였으며, 이는 공급망        │
│  리스크 관리 비용 15% 절감으로 이어졌습니다"│
│                                            │
│ [수정 요청] 버튼                            │
└────────────────────────────────────────────┘

[수정 요청 클릭]

┌────────────────────────────────────────────┐
│ 수정 요청 입력                              │
│ ┌────────────────────────────────────────┐ │
│ │ 재무 효과를 더 구체적으로 강조하고,     │ │
│ │ 금액을 명시해주세요                    │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [수정 실행] 버튼                            │
└────────────────────────────────────────────┘

[수정 실행 클릭]

수정 중... (refine_mode)
 ↓
[수정 완료 - 비교 화면]

┌────────────────────────────────────────────┐
│ 수정된 내용                                 │
│                                            │
│ [이전] "이는 공급망 리스크 관리 비용        │
│        15% 절감으로 이어졌습니다"           │
│        ▼                                   │
│ [수정] "이는 공급망 리스크 관리 비용을      │
│        연간 약 3억원 절감하는 효과를        │
│        가져왔으며, 운영 효율성 지표가       │
│        전년 대비 15% 개선되었습니다"        │
│                                            │
│ ⚠ 검증 경고: "문단 길이 증가 (4→6문장)"    │
│                                            │
│ [적용] [다시 수정] [취소] 버튼              │
└────────────────────────────────────────────┘
```

---

### 4.9 API 엔드포인트 설계

#### 4.9.1 초안 생성 API (경로 1 → 2)

```http
POST /api/v1/ifrs-agent/reports/generate

Request:
{
    "action": "create",
    "company_id": "company_123",
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
    "category": "협력회사 ESG 관리",
    "fiscal_year": 2025
}

Response (성공):
{
    "status": "success",
    "report_id": "report_12345",
    "generated_text": "당사는 협력회사 ESG 평가 체계를...",
    "validation": {
        "is_valid": true,
        "scores": {
            "dp_compliance": 1.0,
            "format_similarity": 0.92,
            "data_consistency": 1.0
        }
    },
    "metadata": {
        "attempts": 2,
        "external_company_snapshot_used": true,
        "execution_time_ms": 5200
    },
    "references": {
        "sr_pages": [12, 15],
        "subsidiary_facilities": ["동탄 데이터센터", "판교 사옥"]
    }
}

Response (실패):
{
    "status": "max_retries_exceeded",
    "generated_text": "...",
    "validation": {
        "is_valid": false,
        "errors": ["..."]
    },
    "metadata": {
        "attempts": 3
    }
}
```

---

#### 4.9.2 사용자 수정 API (경로 3)

```http
POST /api/v1/ifrs-agent/reports/refine

Request:
{
    "action": "refine",
    "report_id": "report_12345",
    "page_number": 12,
    "user_instruction": "재무 효과를 더 구체적으로 강조하고, 금액을 명시해주세요"
}

Response:
{
    "status": "success",
    "report_id": "report_12345",
    "generated_text": "당사는 협력회사 ESG 평가 체계를 강화하여 200개사로 확대하였으며, 이는 공급망 리스크 관리 비용을 연간 약 3억원 절감하는 효과를...",
    "previous_text": "당사는 협력회사 ESG 평가 체계를 강화하여 200개사로 확대하였으며, 이는 공급망 리스크 관리 비용 15% 절감으로...",
    "changes_summary": "재무 효과 구체화 (금액 추가: 3억원)",
    "validation": {
        "is_valid": true,
        "warnings": []  # 경고 있어도 저장 가능
    },
    "metadata": {
        "mode": "refine",
        "execution_time_ms": 4800
    }
}
```

---

### 4.10 모드별 비교표

| 항목 | draft_mode (경로 1, 2) | refine_mode (경로 3) |
|------|------------------------|----------------------|
| **트리거** | Orchestrator (자동) | 사용자 버튼 클릭 |
| **목적** | 초안 생성 + 품질 보장 | 사용자 맞춤 수정 |
| **입력** | 병합 ref_data + fact_data + (feedback) | previous_text + user_instruction |
| **프롬프트 구조** | 단순 (3개 섹션) | 복잡 (5 Block) |
| **프롬프트 길이** | 짧음 (2,000 토큰) | 긺 (5,000 토큰) |
| **validator 통과** | **필수** (3회 재시도) | **선택적** (경고만) |
| **판정 기준** | validator 규칙 | 사용자 만족도 |
| **반복 횟수** | 최대 3회 (자동) | 무제한 (사용자 주도) |
| **사용자 인지** | 보이지 않음 (최종 결과만) | 명시적 (수정 과정 표시) |
| **실행 시간** | 3~15초 (재시도 포함) | 5초 |
| **비용** | 중간 (재시도 시 증가) | 낮음 (1회 실행) |
| **사용 빈도** | 높음 (모든 신규 생성) | 낮음 (선택적 수정) |

---

## 5. 단계별 상세 로직

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 입력                              │
│   - DP ID: "UCM_ESRS2_BP_2_17_e__IFRS1_51_a"                │
│   - 카테고리: "협력회사 ESG 관리"                            │
│   - 기업 ID: company_123                                    │
│   - 현재 연도: 2025                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: 병렬 수집 (요청당 실시간 크롤링 없음)              │
│                                                             │
│  • c_rag: 전년·전전년 sr_report_body 검색 + 이미지 JOIN      │
│  • aggregation_node: subsidiary_data_contributions +       │
│    external_company_data(배치 크롤·수동 보완 적재분) 조회   │
│  • dp_rag: DP 매핑 및 실데이터 테이블 최신 값                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Orchestrator 병합 (연도별 구조로 정렬)             │
│                                                             │
│  [2023년] c_rag: sr_report_body + sr_report_images           │
│          aggregation: subsidiary + external_company_data     │
│  [2024년] 동일 구조 병합                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Gen Node 실행 (문단 생성)                           │
│                                                             │
│  입력:                                                       │
│  - 2023·2024: 본문·이미지(c_rag) + 계열사·외부스냅샷(aggregation) │
│  - 사용자 선택 DP + 2025년 최신 값 (dp_rag)                  │
│  - DP 메타데이터 (단위, 검증 규칙)                           │
│                                                             │
│  생성 지시:                                                  │
│  - 2023→2024 변화 패턴 학습                                 │
│  - 2024년 문체·구조 유지                                     │
│  - SR 본문(전체 요약) + 계열사·외부 기업 스냅샷(구체적 사례)  │
│  - 데이터만 2025년 값으로 업데이트                           │
│  - 이미지 스타일 일관성 유지                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Supervisor 검증 (선택적)                            │
│  - IFRS 준수 검사                                            │
│  - 그린워싱 탐지                                             │
│  - 데이터 일관성 검증                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      출력                                    │
│  - 2025년 SR 보고서 문단                                     │
│  - 추천 이미지 메타데이터                                    │
│  - 참조 출처 (2023, 2024 페이지 번호)                        │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.1 전년도·전전년도 참조 페이지 검색 (c_rag 노드)

#### 5.1.1 검색 로직 (2단계 폴백)

**우선순위 1: 정확 매칭**

```sql
-- category_column이 정확히 일치하는 튜플 찾기
SELECT 
    page_number,
    toc_path,
    body_text,
    report_year
FROM sr_report_body
WHERE company_id = :company_id
  AND report_year = :target_year  -- 2024 또는 2023
  AND category_column = :user_category  -- '협력회사 ESG 관리'
ORDER BY page_number
LIMIT 1;  -- 첫 번째 매칭 페이지만
```

**우선순위 2: 벡터 유사도 검색 (정확 매칭 실패 시)**

```sql
-- toc_path 임베딩 기반 유사도 검색
SELECT 
    page_number,
    toc_path,
    body_text,
    report_year,
    (toc_path_embedding <-> :category_embedding) AS similarity_score
FROM sr_report_body
WHERE company_id = :company_id
  AND report_year = :target_year
ORDER BY toc_path_embedding <-> :category_embedding
LIMIT 1;  -- 최상위 유사도 1개만
```

**추후 개선 (subtitle 컬럼 추가 시)**:

```sql
-- toc_path + subtitle 평균 유사도
SELECT 
    page_number,
    toc_path,
    subtitle,
    body_text,
    report_year,
    ((toc_path_embedding <-> :category_embedding) + 
     (subtitle_embedding <-> :category_embedding)) / 2.0 AS avg_similarity
FROM sr_report_body
WHERE company_id = :company_id
  AND report_year = :target_year
ORDER BY avg_similarity
LIMIT 1;
```

#### 5.1.2 검색 결과 예시

```python
# 전년도(2024) 검색 결과
reference_2024 = {
    "page_number": 12,
    "toc_path": "3.2 협력회사 ESG 관리",
    "body_text": "당사는 협력회사 ESG 평가 체계를 고도화하여 150개사로 확대...",
    "report_year": 2024,
    "similarity_score": 0.95
}

# 전전년도(2023) 검색 결과
reference_2023 = {
    "page_number": 15,
    "toc_path": "3.2 협력회사 ESG 관리",
    "body_text": "협력회사 ESG 평가를 신규 도입하여 100개사를 대상으로...",
    "report_year": 2023,
    "similarity_score": 0.91
}
```

---

### 5.2 본문 + 이미지 추출

#### 5.2.1 SQL 쿼리

```sql
-- 2024년 본문 + 이미지
SELECT 
    b.page_number,
    b.body_text,
    b.toc_path,
    i.image_path,
    i.image_type,
    i.caption
FROM sr_report_body b
LEFT JOIN sr_report_images i 
    ON b.company_id = i.company_id 
    AND b.report_year = i.report_year 
    AND b.page_number = i.page_number
WHERE b.company_id = :company_id
  AND b.report_year = 2024
  AND b.page_number = 12;  -- Step 1에서 찾은 페이지

-- 2023년 본문 + 이미지 (동일 쿼리, report_year=2023, page_number=15)
```

#### 5.2.2 추출 데이터 구조

```python
reference_data = {
    "2023": {
        "page_number": 15,
        "toc_path": "3.2 협력회사 ESG 관리",
        "body_text": "협력회사 ESG 평가를 신규 도입하여 100개사를 대상으로 환경·사회·지배구조 3개 영역 20개 항목을 평가하였습니다...",
        "images": [
            {
                "image_path": "s3://bucket/2023/page15_chart1.png",
                "image_type": "bar_chart",
                "caption": "협력회사 ESG 평가 결과 분포"
            }
        ]
    },
    "2024": {
        "page_number": 12,
        "toc_path": "3.2 협력회사 ESG 관리",
        "body_text": "당사는 협력회사 ESG 평가 체계를 고도화하여 150개사로 확대하고, 평가 결과를 바탕으로 개선 지원 프로그램을 운영하였습니다...",
        "images": [
            {
                "image_path": "s3://bucket/2024/page12_chart1.png",
                "image_type": "stacked_bar_chart",
                "caption": "협력회사 ESG 평가 결과 및 개선 현황"
            },
            {
                "image_path": "s3://bucket/2024/page12_table1.png",
                "image_type": "table",
                "caption": "협력회사 ESG 등급 분포"
            }
        ]
    }
}
```

---

### 5.3 DP 메타데이터 및 최신 팩트 데이터 수집 (dp_rag 노드)

#### 5.3.1 DP → 테이블·컬럼 매핑

```sql
-- unified_column_mappings에서 DP가 어느 테이블의 어느 컬럼인지 조회
SELECT 
    ucm.dp_id,
    ucm.source_table,
    ucm.source_column,
    dp.name_ko,
    dp.name_en,
    dp.unit,
    dp.validation_rules
FROM unified_column_mappings ucm
JOIN data_points dp ON ucm.dp_id = dp.dp_id
WHERE ucm.dp_id = :user_selected_dp_id;  -- 'UCM_ESRS2_BP_2_17_e__IFRS1_51_a'
```

**결과 예시**:

```python
dp_mapping = {
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
    "source_table": "social_data",
    "source_column": "supplier_esg_evaluation_count",
    "name_ko": "협력회사 ESG 평가 실시 현황",
    "name_en": "Supplier ESG Evaluation Status",
    "unit": "개사",
    "validation_rules": {"min": 0, "type": "integer"}
}
```

#### 5.3.2 최신 팩트 데이터 추출

```sql
-- 동적 쿼리 생성 (source_table, source_column 기반)
-- 예시: social_data 테이블에서 supplier_esg_evaluation_count 조회

SELECT 
    report_year,
    supplier_esg_evaluation_count AS value
FROM social_data
WHERE company_id = :company_id
  AND report_year = 2025  -- 현재 연도
ORDER BY updated_at DESC
LIMIT 1;
```

**결과 예시**:

```python
latest_data = {
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
    "value": 200,
    "unit": "개사",
    "report_year": 2025
}
```

#### 5.3.3 외부 기업 정보 보완 (배치 크롤 적재분 조회)

```python
# dp_rag는 내부 실데이터 테이블만 조회한다.
# 보도·언론 스냅샷은 배치 크롤(삼성SDS 뉴스 #bThumbs/#sThumbs)·수동 보완이 external_company_data에 적재하고,
# aggregation_node가 조회하여 gen 입력에 합친다.
if not latest_data or is_outdated(latest_data):
    # 옵션: 사용자 수동 입력, 기본값, 또는 "데이터 없음" 경고
    ...
```

---

## 6. 페이지 선택 전략

### 6.1 선택 기준: 각 연도당 최상위 1개

**결정 근거**:
- Gen Node 프롬프트 길이 관리
- 명확한 단일 참조점 확보
- 2개년 비교 시 각 연도의 **대표 페이지**로 충분

### 6.2 선택 알고리즘

```python
def select_reference_page(company_id: str, target_year: int, category: str) -> dict:
    """
    단일 연도에서 최상위 유사도 페이지 1개 선택
    
    Args:
        company_id: 기업 ID
        target_year: 대상 연도 (2024 또는 2023)
        category: 사용자 선택 카테고리 ("협력회사 ESG 관리")
    
    Returns:
        {
            "page_number": int,
            "body_text": str,
            "toc_path": str,
            "similarity_score": float,
            "images": List[dict]
        }
    """
    # 1. 정확 매칭 시도
    exact_match = query_exact_match(company_id, target_year, category)
    if exact_match:
        return extract_page_data(exact_match)
    
    # 2. 벡터 유사도 검색 (정확 매칭 실패 시)
    category_embedding = embed_text(category)
    
    result = query_vector_search(
        company_id=company_id,
        target_year=target_year,
        category_embedding=category_embedding,
        limit=1  # 최상위 1개만
    )
    
    if not result:
        raise NotFoundError(f"No reference found for {target_year}")
    
    # 3. 본문 + 이미지 추출
    page_data = extract_page_data(result[0])
    
    return page_data


def extract_page_data(page_result: dict) -> dict:
    """페이지 번호로 본문 + 이미지 추출"""
    page_number = page_result["page_number"]
    company_id = page_result["company_id"]
    report_year = page_result["report_year"]
    
    # 이미지 조회
    images = query_images(company_id, report_year, page_number)
    
    return {
        "page_number": page_number,
        "body_text": page_result["body_text"],
        "toc_path": page_result["toc_path"],
        "similarity_score": page_result.get("similarity_score"),
        "images": images
    }
```

### 6.3 2개년 페이지 수집

```python
def collect_two_year_references(company_id: str, category: str) -> dict:
    """전년도 + 전전년도 참조 페이지 수집"""
    current_year = datetime.now().year
    
    # 전년도 (2024)
    ref_2024 = select_reference_page(
        company_id=company_id,
        target_year=current_year - 1,
        category=category
    )
    
    # 전전년도 (2023)
    ref_2023 = select_reference_page(
        company_id=company_id,
        target_year=current_year - 2,
        category=category
    )
    
    return {
        "previous_year": ref_2024,      # 2024년
        "two_years_ago": ref_2023       # 2023년
    }
```

---

## 7. Gen Node 입력 구조

### 7.1 프롬프트 구조

```python
GEN_NODE_PROMPT = """
당신은 IFRS S1/S2 기준 SR 보고서 작성 전문가입니다.

## 입력 정보

### [1] 전전년도(2023) 참조
**페이지**: {ref_2023["page_number"]}
**목차**: {ref_2023["toc_path"]}
**본문**:
{ref_2023["body_text"]}

**이미지**:
{format_images(ref_2023["images"])}

---

### [2] 전년도(2024) 참조
**페이지**: {ref_2024["page_number"]}
**목차**: {ref_2024["toc_path"]}
**본문**:
{ref_2024["body_text"]}

**이미지**:
{format_images(ref_2024["images"])}

---

### [3] 현재 연도(2025) 생성 데이터
**DP ID**: {dp_id}
**DP 명칭**: {dp_name_ko}
**최신 값**: {latest_value} {unit}
**기준 연도**: 2025년

---

## 생성 지시사항

### 문체 및 구조
1. **2024년 본문의 문체와 구조를 최대한 유지**하세요.
2. 문단 길이, 문장 톤, 표현 방식을 2024년과 일관되게 작성하세요.
3. 목차 경로(`{ref_2024["toc_path"]}`)와 동일한 섹션 구조를 사용하세요.

### 변화 패턴 반영
1. **2023년 → 2024년 변화 추이**를 분석하세요:
   - 수치 변화 (예: 100개사 → 150개사)
   - 표현 강도 변화 (예: "도입" → "고도화")
   - 추가된 내용 (예: "개선 지원 프로그램" 신규 언급)

2. **2024년 → 2025년 변화**를 동일한 패턴으로 작성하세요:
   - 2023→2024 증가율을 참고하여 2024→2025 서술
   - 2024년에 추가된 내용을 2025년에서 더 발전시킨 형태로 표현

### 데이터 업데이트
1. **2025년 최신 값({latest_value} {unit})**을 본문에 자연스럽게 삽입하세요.
2. 전년 대비 증감률을 계산하여 포함하세요:
   - 예: "전년(2024년) 150개사 대비 33% 증가한 200개사..."

### 이미지 일관성
1. **2024년 이미지 스타일을 유지**하세요:
   - 차트 타입: {ref_2024["images"][0]["image_type"]}
   - 캡션 형식: {ref_2024["images"][0]["caption"]}

2. 추천 이미지 메타데이터를 생성하세요 (실제 이미지 생성 X):
   ```json
   {{
       "image_type": "stacked_bar_chart",
       "caption": "협력회사 ESG 평가 결과 및 개선 현황 (2025)",
       "data_source": "2025년 사회 데이터"
   }}
   ```

---

## 출력 형식

{{
    "generated_text": "생성된 본문 (300~500자)",
    "rationale": "생성 근거 및 2023→2024→2025 변화 분석",
    "recommended_images": [
        {{
            "image_type": "차트 타입",
            "caption": "캡션",
            "data_source": "데이터 출처"
        }}
    ],
    "references": [
        "2023년 15페이지",
        "2024년 12페이지"
    ]
}}
"""
```

### 7.2 입력 데이터 예시

```python
gen_input = {
    "ref_2023": {
        "page_number": 15,
        "toc_path": "3.2 협력회사 ESG 관리",
        "body_text": "협력회사 ESG 평가를 신규 도입하여 100개사를 대상으로 환경·사회·지배구조 3개 영역 20개 항목을 평가하였습니다. 평가 결과, 전체 협력회사의 평균 점수는 72점으로 나타났으며, 우수 등급(80점 이상) 협력회사는 25%를 차지하였습니다.",
        "images": [
            {
                "image_type": "bar_chart",
                "caption": "협력회사 ESG 평가 결과 분포"
            }
        ]
    },
    "ref_2024": {
        "page_number": 12,
        "toc_path": "3.2 협력회사 ESG 관리",
        "body_text": "당사는 협력회사 ESG 평가 체계를 고도화하여 150개사로 확대하고, 평가 결과를 바탕으로 개선 지원 프로그램을 운영하였습니다. 평가 항목을 25개로 세분화하였으며, 전체 평균 점수는 76점으로 전년 대비 4점 상승하였습니다. 우수 등급 협력회사 비율은 32%로 증가하였으며, 하위 등급 협력회사를 대상으로 맞춤형 컨설팅을 제공하였습니다.",
        "images": [
            {
                "image_type": "stacked_bar_chart",
                "caption": "협력회사 ESG 평가 결과 및 개선 현황"
            },
            {
                "image_type": "table",
                "caption": "협력회사 ESG 등급 분포"
            }
        ]
    },
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
    "dp_name_ko": "협력회사 ESG 평가 실시 현황",
    "latest_value": 200,
    "unit": "개사",
    "report_year": 2025
}
```

### 7.3 Gen Node 출력 예시

```json
{
    "generated_text": "당사는 협력회사 ESG 평가 체계를 지속적으로 강화하여 200개사로 확대하였으며, 전년(2024년) 150개사 대비 33% 증가하였습니다. 평가 항목을 30개로 세분화하여 환경·사회·지배구조 영역의 리스크를 보다 정밀하게 진단하였습니다. 평가 결과, 전체 평균 점수는 79점으로 전년 대비 3점 상승하였으며, 우수 등급(80점 이상) 협력회사 비율은 38%로 증가하였습니다. 개선 지원 프로그램을 고도화하여 하위 등급 협력회사 대상 집중 컨설팅 및 교육을 실시하였으며, 이를 통해 전체 협력망의 ESG 수준 향상을 도모하고 있습니다.",
    
    "rationale": "2023년(100개사) → 2024년(150개사, 50% 증가) → 2025년(200개사, 33% 증가) 추이를 반영. 2024년 '고도화' 표현을 2025년 '지속적으로 강화'로 발전. 평가 항목 세분화 추세(20개→25개→30개) 유지. 평균 점수 상승폭(72→76→79점) 일관성 유지. 2024년 신규 언급된 '맞춤형 컨설팅'을 2025년 '집중 컨설팅 및 교육'으로 확장.",
    
    "recommended_images": [
        {
            "image_type": "stacked_bar_chart",
            "caption": "협력회사 ESG 평가 결과 및 개선 현황 (2025)",
            "data_source": "2025년 사회 데이터",
            "note": "2024년 동일 차트 타입 유지"
        },
        {
            "image_type": "table",
            "caption": "협력회사 ESG 등급 분포 (2023-2025)",
            "data_source": "3개년 비교 데이터",
            "note": "2024년 표 형식 유지, 시계열 비교 추가"
        }
    ],
    
    "references": [
        "2023년 15페이지 (협력회사 ESG 관리)",
        "2024년 12페이지 (협력회사 ESG 관리)"
    ]
}
```

---

## 8. 계열사/자회사·외부 기업 데이터 통합

### 8.1 개요

SR 보고서는 **그룹 전체의 요약**을 제공하지만, 실제 ESG 활동은 **개별 사업장·시설 단위**에서 발생합니다. **`aggregation_node`**가 `subsidiary_data_contributions`와 배치 크롤·수동 보완으로 채워진 **`external_company_data`**를 조회·정렬하여, Gen Node가 **구체적 사례와 정량 데이터**를 함께 생성할 수 있도록 합니다. (요청 경로에서 **실시간** 웹 크롤링은 하지 않습니다.)

### 8.2 역할 구분

| 데이터 종류 | 역할 | 예시 |
|-----------|------|------|
| **SR 본문** | 전체 요약·정책 수준 | "당사는 협력회사 ESG 평가를 150개사로 확대..." |
| **계열사 데이터** | 구체적 사례·사업장별 상세 | "동탄 데이터센터는 태양광 발전설비 374kW를 추가 증설하여 172,497kWh 발전..." |

### 8.3 데이터 예시

#### 실제 계열사 데이터 (이미지 기반)

```
동탄 데이터센터는 준공 시 전용 옥상에 태양광 발전설비를 구축하였습니다.
2024년 7월 동탄 데이터센터 옥상 내 추가장에 태양광 발전설비 374kW를 
추가 증설하여 재생에너지 비중을 확대하고 제생에너지 사용 확대 노력을 
지속하고 있습니다. 이를 통해 2024년 한 해 동안 당사 동탄 데이터센터 
사업장에서는 6개월간 172,497kWh를 발전하였습니다.
```

#### DB 저장 구조

```json
{
    "company_id": "company_123",
    "subsidiary_name": "○○ 자회사",
    "facility_name": "동탄 데이터센터",
    "report_year": 2024,
    "category": "재생에너지",
    "description": "동탄 데이터센터는 준공 시 전용 옥상에 태양광 발전설비를 구축하였습니다. 2024년 7월 동탄 데이터센터 옥상 내 추가장에 태양광 발전설비 374kW를 추가 증설하여...",
    "related_dp_ids": ["ENV_ENERGY_SOLAR_001", "ENV_GHG_REDUCTION_002"],
    "quantitative_data": {
        "태양광_발전량_kWh": 172497,
        "설비용량_kW": 374,
        "발전기간_개월": 6,
        "CO2_감축량_tCO2eq": 38.5
    },
    "data_source": "자회사 제출"
}
```

### 8.4 검색 로직 (`aggregation_node` 내부)

#### SQL 쿼리

```sql
-- 사용자 선택 카테고리로 계열사 데이터 검색
SELECT 
    subsidiary_name,
    facility_name,
    description,
    quantitative_data,
    related_dp_ids,
    report_year,
    (category_embedding <-> :category_embedding) as similarity
FROM subsidiary_data_contributions
WHERE company_id = :company_id
  AND report_year IN (:target_year)  -- 2024 또는 2023
  AND (
      category = :user_category  -- 정확 매칭 우선 (예: "재생에너지")
      OR 
      (category_embedding <-> :category_embedding) < 0.3  -- 벡터 유사도
  )
ORDER BY report_year DESC, similarity
LIMIT 5;  -- 상위 5개 사업장 데이터
```

#### Python 함수

```python
def select_subsidiary_data(
    company_id: str, 
    target_year: int, 
    category: str
) -> List[dict]:
    """
    계열사/자회사 데이터 검색
    
    Args:
        company_id: 기업 ID
        target_year: 대상 연도 (2024 또는 2023)
        category: 사용자 선택 카테고리 ("재생에너지", "협력회사 ESG 관리" 등)
    
    Returns:
        List of subsidiary data (최대 5개)
    """
    # 1. 정확 매칭 시도
    exact_matches = query_subsidiary_exact(company_id, target_year, category)
    if exact_matches:
        return exact_matches[:5]
    
    # 2. 벡터 유사도 검색
    category_embedding = embed_text(category)
    
    results = query_subsidiary_vector(
        company_id=company_id,
        target_year=target_year,
        category_embedding=category_embedding,
        limit=5
    )
    
    return results
```

### 8.5 통합 데이터 구조

```python
# Step 2-1 실행 후 통합된 참조 데이터
reference_data = {
    "2023": {
        "sr_body": {
            "page_number": 15,
            "toc_path": "3.2 재생에너지 확대",
            "body_text": "그룹 전체 재생에너지 발전량 95,000kWh 달성..."
        },
        "sr_images": [...],
        "subsidiary_data": [  # 신규 추가
            {
                "subsidiary": "○○ 자회사",
                "facility": "동탄 데이터센터",
                "description": "2023년 태양광 발전설비 초기 구축...",
                "quantitative_data": {
                    "태양광_발전량_kWh": 95000,
                    "설비용량_kW": 200
                }
            }
        ]
    },
    "2024": {
        "sr_body": {
            "page_number": 12,
            "toc_path": "3.2 재생에너지 확대",
            "body_text": "그룹 전체 재생에너지 발전량 172,497kWh 달성..."
        },
        "sr_images": [...],
        "subsidiary_data": [  # 신규 추가
            {
                "subsidiary": "○○ 자회사",
                "facility": "동탄 데이터센터",
                "description": "동탄 데이터센터는 준공 시 전용 옥상에 태양광 발전설비를 구축하였습니다. 2024년 7월 동탄 데이터센터 옥상 내 추가장에 태양광 발전설비 374kW를 추가 증설하여...",
                "quantitative_data": {
                    "태양광_발전량_kWh": 172497,
                    "설비용량_kW": 374,
                    "발전기간_개월": 6
                }
            },
            {
                "subsidiary": "△△ 자회사",
                "facility": "판교 사옥",
                "description": "판교 사옥 옥상 태양광...",
                "quantitative_data": {
                    "태양광_발전량_kWh": 45000,
                    "설비용량_kW": 150
                }
            }
        ]
    }
}
```

### 8.6 Gen Node 프롬프트 확장

```python
GEN_NODE_PROMPT_WITH_SUBSIDIARY = """
당신은 IFRS S1/S2 기준 SR 보고서 작성 전문가입니다.

## 입력 정보

### [1] 전전년도(2023) 참조
**본문**: {ref_2023["sr_body"]["body_text"]}
**이미지**: {format_images(ref_2023["sr_images"])}

**계열사/자회사 제공 데이터** (신규):
{for item in ref_2023["subsidiary_data"]}
  - **사업장**: {item["facility"]}
  - **내용**: {item["description"]}
  - **정량 데이터**: {json.dumps(item["quantitative_data"], ensure_ascii=False)}
{endfor}

---

### [2] 전년도(2024) 참조
**본문**: {ref_2024["sr_body"]["body_text"]}
**이미지**: {format_images(ref_2024["sr_images"])}

**계열사/자회사 제공 데이터** (신규):
{for item in ref_2024["subsidiary_data"]}
  - **사업장**: {item["facility"]}
  - **내용**: {item["description"]}
  - **정량 데이터**: {json.dumps(item["quantitative_data"], ensure_ascii=False)}
{endfor}

---

## 생성 지시사항

### 계열사 데이터 활용 (신규)
1. **구체성 강화**: 계열사/자회사 데이터는 **사업장별 구체적 사례**입니다.
   - SR 본문의 전체 요약을 보완하는 **세부 예시**로 활용
   - 예: "당사 그룹의 재생에너지 확대 노력의 일환으로, 동탄 데이터센터는..."

2. **정량 데이터 통합**: 
   - 계열사 정량 데이터를 집계하여 전체 그룹 수치에 반영
   - 예: "동탄 데이터센터 172,497kWh 포함, 전체 그룹 태양광 발전량 X kWh 달성"

3. **변화 추이 반영**:
   - 2023년 계열사 데이터 vs 2024년 계열사 데이터 비교
   - 예: "동탄 데이터센터 설비용량 200kW(2023) → 374kW(2024) 87% 증가"

4. **사업장 언급**:
   - 주요 사업장은 구체적으로 명시
   - 예: "특히 동탄 데이터센터는 6개월간 172,497kWh를 발전하여..."
"""
```

### 8.7 Gen Node 출력 예시 (계열사 데이터 통합)

```json
{
    "generated_text": "당사 그룹은 재생에너지 확대를 위해 사업장별 태양광 발전설비 구축을 지속하고 있습니다. 2025년 전체 그룹의 태양광 발전량은 250,000kWh로, 전년(2024년) 217,497kWh 대비 15% 증가하였습니다. 특히 동탄 데이터센터는 2024년 7월 추가 증설한 374kW 설비를 통해 안정적으로 가동하여, 2025년 한 해 동안 210,000kWh를 발전하였습니다. 이는 약 46.8tCO2eq의 온실가스 감축 효과를 가져왔으며, 판교 사옥 등 타 사업장에서도 40,000kWh를 발전하여 그룹 전체의 재생에너지 비중을 12%까지 확대하였습니다.",
    
    "rationale": "2023년 동탄 DC(95,000kWh) → 2024년 동탄 DC(172,497kWh, 81% 증가) 추세를 반영하여 2025년 210,000kWh(22% 증가)로 설정. 계열사 상세 데이터를 활용하여 '동탄 데이터센터 374kW 설비' 등 구체적 사례 명시. 전체 그룹 수치는 동탄+판교 등 집계값 반영.",
    
    "subsidiary_data_used": [
        "2024년 동탄 데이터센터 (172,497kWh, 374kW)",
        "2024년 판교 사옥 (45,000kWh)",
        "2023년 동탄 데이터센터 (95,000kWh, 200kW)"
    ],
    
    "recommended_images": [
        {
            "image_type": "bar_chart",
            "caption": "사업장별 태양광 발전량 (2023-2025)",
            "data_source": "계열사 제공 데이터 집계"
        }
    ]
}
```

### 8.8 구현 함수

런타임에서는 **`c_rag`**가 SR 본문·이미지만, **`aggregation_node`**가 계열사·`external_company_data`만 채우고, Orchestrator가 연도별로 병합한다. 아래는 병합 후 연도당 페이로드 형태를 보여 주는 참고 코드다.

```python
def build_merged_year(
    company_id: str,
    year: int,
    category: str,
) -> dict:
    """c_rag 결과 + aggregation_node 결과를 한 연도 dict로 합침 (개념 예시)"""
    sr_page = select_reference_page(company_id, year, category)  # c_rag 내부
    subsidiary_data = select_subsidiary_data(company_id, year, category)  # aggregation
    external_rows = select_external_company_data(company_id, year, category)  # aggregation

    return {
        str(year): {
            "sr_body": {
                "page_number": sr_page["page_number"],
                "toc_path": sr_page["toc_path"],
                "body_text": sr_page["body_text"],
            },
            "sr_images": sr_page["images"],
            "subsidiary_data": subsidiary_data,
            "external_company_data": external_rows,
        }
    }


def aggregate_subsidiary_quantitative_data(subsidiary_data_list: List[dict]) -> dict:
    """계열사별 정량 데이터 합산"""
    total = {}
    for item in subsidiary_data_list:
        for key, value in item["quantitative_data"].items():
            if key not in total:
                total[key] = 0
            if isinstance(value, (int, float)):
                total[key] += value
    
    return total


# 사용 예시
merged = {}
merged.update(build_merged_year("company_123", 2024, "재생에너지"))
merged.update(build_merged_year("company_123", 2023, "재생에너지"))

# 2024년 계열사 데이터 집계
total_2024 = aggregate_subsidiary_quantitative_data(
    merged["2024"]["subsidiary_data"]
)
# → {"태양광_발전량_kWh": 217497, "설비용량_kW": 524}
```

### 8.9 데이터 수집 전략

#### 8.9.1 계열사·외부 데이터 출처

| 출처 | 수집 방식 | 예시 |
|------|----------|------|
| **자회사 직접 제출** | 웹 폼 또는 Excel 업로드 | "동탄 데이터센터 담당자가 월별 발전량 제출" |
| **EMS 시스템 연동** | API 자동 수집 | "데이터센터 전력 관리 시스템에서 실시간 수집" |
| **사업장 보고서 파싱** | PDF/이미지 OCR | "자회사 SR 보고서에서 텍스트 추출" |
| **보도·언론 스냅샷** | **배치·(선택) 준실시간 폴링** — [삼성SDS 언론보도](https://www.samsungsds.com/kr/news/index.html)의 **`#bThumbs`·`#sThumbs`** 또는 **RSS** → `external_company_data` | "일/주 또는 분 단위 백그라운드 적재 후 생성 시 조회만"; (선택) 폼/API 수동 보완 |

#### 8.9.2 DP 자동 연결

```python
def link_subsidiary_data_to_dp(description: str, quantitative_data: dict) -> List[str]:
    """계열사 데이터에서 관련 DP 자동 추출"""
    
    # 키워드 기반 DP 매핑
    keyword_to_dp = {
        "태양광": ["ENV_ENERGY_SOLAR_001"],
        "풍력": ["ENV_ENERGY_WIND_001"],
        "온실가스": ["ENV_GHG_SCOPE1_001", "ENV_GHG_SCOPE2_001"],
        "재생에너지": ["ENV_ENERGY_RENEWABLE_001"],
        "협력회사": ["SOC_SUPPLIER_ESG_001"]
    }
    
    related_dps = []
    for keyword, dp_ids in keyword_to_dp.items():
        if keyword in description:
            related_dps.extend(dp_ids)
    
    # 정량 데이터 키 기반 매핑
    data_key_to_dp = {
        "태양광_발전량_kWh": "ENV_ENERGY_SOLAR_001",
        "온실가스_배출량_tCO2eq": "ENV_GHG_TOTAL_001"
    }
    
    for key in quantitative_data.keys():
        if key in data_key_to_dp:
            related_dps.append(data_key_to_dp[key])
    
    return list(set(related_dps))  # 중복 제거
```

---

## 9. 기존 워크플로우와의 차이점

| 항목 | 기존 워크플로우 (문서 기반) | 수정된 워크플로우 (DB 기반) |
|------|----------------------------|---------------------------|
| **데이터 소스** | PDF/Excel 업로드 → 멀티모달 파싱 | DB 테이블 직접 조회 (파싱 완료 가정) |
| **RAG 검색 대상** | 외부 문서 벡터 임베딩 | `sr_report_body.toc_path` 임베딩 |
| **참조 방식** | 유사 보고서 범용 검색 | **동일 회사·동일 섹션 2개년 정확 매칭** |
| **참조 데이터** | 단일 연도 또는 복수 문서 혼합 | **전년 + 전전년 각 1페이지씩** |
| **DP 출처** | RAG가 추출한 DP 목록 | **사용자 선택 DP** + 실데이터 테이블 직접 조회 |
| **Gen 입력** | 팩트 시트 (DP 값 중심) | **2개년 본문·이미지 + 계열사 + 외부 스냅샷 + 최신 DP** (c_rag·aggregation·dp_rag 병합) |
| **Supervisor 역할** | 동적 노드 선택 (`_decide_next_action`) | **고정 파이프라인** (검색→추출→생성) |
| **검증 로직** | Supervisor 내부 통합 (그린워싱 등) | (선택적) 간소화된 IFRS 준수 검사 |
| **이미지 처리** | 멀티모달 파싱 + OCR | DB에서 메타데이터만 조회 (경로, 타입, 캡션) |
| **외부 기업 정보** | 요청 시 크롤링 노드 | **`external_company_data` 배치 크롤·수동 보완 적재분** + `aggregation_node` 조회 |
| **계열사 상세** | (기존) c_rag에 포함 가정 | **`aggregation_node`로 분리** |

---

## 10. 구현 고려사항

### 10.1 성능 최적화

#### 10.1.1 벡터 검색 인덱스

```sql
-- pgvector IVFFlat 인덱스 생성
CREATE INDEX idx_sr_body_toc_embedding 
ON sr_report_body 
USING ivfflat (toc_path_embedding vector_cosine_ops)
WITH (lists = 100);

-- 인덱스 활용 쿼리
SET ivfflat.probes = 10;  -- 검색 정확도 조정

SELECT * FROM sr_report_body
WHERE company_id = :company_id
  AND report_year = :target_year
ORDER BY toc_path_embedding <-> :query_embedding
LIMIT 1;
```

#### 10.1.2 캐싱 전략

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def get_reference_pages(company_id: str, category: str) -> dict:
    """
    동일 회사·카테고리 요청 시 캐시 활용
    (같은 사용자가 여러 DP 선택 시 재사용)
    """
    return collect_two_year_references(company_id, category)
```

### 10.2 오류 처리

#### 10.2.1 참조 페이지 없음

```python
def handle_missing_reference(company_id: str, target_year: int) -> dict:
    """
    특정 연도 참조 페이지가 없을 때 처리
    
    옵션 1: 더 과거 연도 검색 (2022, 2021...)
    옵션 2: 기본 템플릿 사용
    옵션 3: 사용자에게 알림 후 스킵
    """
    # 옵션 1: 재귀적으로 과거 연도 검색
    for fallback_year in range(target_year - 1, target_year - 3, -1):
        result = select_reference_page(company_id, fallback_year, category)
        if result:
            return result
    
    # 옵션 2: 기본 템플릿 반환
    return get_default_template(category)
```

#### 10.2.2 DP 매핑 실패

```python
def handle_dp_mapping_error(dp_id: str):
    """
    unified_column_mappings에 DP가 없을 때
    
    옵션 1: external_company_data에서 관련 스냅샷 검색 (배치 크롤·수동 보완분)
    옵션 2: 사용자에게 수동 입력 요청
    옵션 3: 해당 DP 스킵 후 경고
    """
    logger.warning(f"DP mapping not found: {dp_id}")
    # 실시간 크롤링은 하지 않음 (적재된 스냅샷만 조회)
    raise UserInputRequired(f"Please provide value for {dp_id}")
```

### 10.3 데이터 일관성

#### 10.3.1 카테고리 표준화

```python
# 사용자 입력 카테고리를 정규화
CATEGORY_MAPPING = {
    "협력회사": "협력회사 ESG 관리",
    "협력업체": "협력회사 ESG 관리",
    "공급망": "협력회사 ESG 관리",
    "supplier": "협력회사 ESG 관리"
}

def normalize_category(user_input: str) -> str:
    """카테고리 입력 정규화"""
    return CATEGORY_MAPPING.get(user_input.lower(), user_input)
```

#### 10.3.2 연도 검증

```python
def validate_report_years(company_id: str, current_year: int):
    """
    전년도·전전년도 데이터 존재 여부 확인
    """
    required_years = [current_year - 1, current_year - 2]
    
    for year in required_years:
        count = query_page_count(company_id, year)
        if count == 0:
            raise DataNotFoundError(f"No SR report data for {year}")
```

### 10.4 확장성 고려

#### 10.4.1 3개년 이상 참조

```python
def collect_multi_year_references(
    company_id: str, 
    category: str, 
    num_years: int = 2
) -> dict:
    """
    N개년 참조 확장 가능 구조
    (예: 3개년 시계열 분석)
    """
    current_year = datetime.now().year
    references = {}
    
    for i in range(1, num_years + 1):
        target_year = current_year - i
        ref = select_reference_page(company_id, target_year, category)
        references[f"year_minus_{i}"] = ref
    
    return references
```

#### 10.4.2 멀티 DP 처리

```python
def process_multiple_dps(
    company_id: str,
    dp_ids: List[str],
    category: str
) -> List[dict]:
    """
    여러 DP를 동시 처리 (배치)
    """
    # 참조 페이지는 1회만 조회 (캐싱)
    references = get_reference_pages(company_id, category)
    
    results = []
    for dp_id in dp_ids:
        # 각 DP별 최신 데이터 조회
        latest_data = get_latest_dp_value(company_id, dp_id)
        
        # Gen Node 실행
        output = gen_node.generate(
            references=references,
            dp_id=dp_id,
            latest_data=latest_data
        )
        results.append(output)
    
    return results
```

### 10.5 모니터링 및 로깅

```python
import structlog

logger = structlog.get_logger()

def log_workflow_step(step: str, **kwargs):
    """워크플로우 각 단계 로깅"""
    logger.info(
        "workflow_step",
        step=step,
        company_id=kwargs.get("company_id"),
        category=kwargs.get("category"),
        dp_id=kwargs.get("dp_id"),
        elapsed_ms=kwargs.get("elapsed_ms")
    )

# 사용 예시
with Timer() as timer:
    ref_2024 = select_reference_page(company_id, 2024, category)

log_workflow_step(
    step="search_reference_2024",
    company_id=company_id,
    category=category,
    page_found=ref_2024["page_number"],
    similarity=ref_2024["similarity_score"],
    elapsed_ms=timer.elapsed_ms
)
```

---

## 11. 다음 단계

### 11.1 즉시 구현 항목

1. **SQL 쿼리 구현**
   - [ ] `sr_report_body` 정확 매칭 쿼리
   - [ ] `sr_report_body` 벡터 유사도 쿼리
   - [ ] 본문 + 이미지 JOIN 쿼리
   - [ ] **`subsidiary_data_contributions` 검색 쿼리** (`aggregation_node`)
   - [ ] **`external_company_data` 조회 쿼리** (`aggregation_node`)
   - [ ] DP 매핑 및 최신 데이터 쿼리 (`dp_rag`)

2. **페이지·집계 로직**
   - [ ] `select_reference_page()` — `c_rag`
   - [ ] **`select_subsidiary_data()` — `aggregation_node`**
   - [ ] **`select_external_company_data()` — `aggregation_node`**
   - [ ] **`_merge_ref_and_agg()` — Orchestrator**
   - [ ] 오류 처리 (참조 없음, 매핑 실패)

2b. **`external_company_data` 배치 인제스션 (실행 경로 외)**
   - [ ] [삼성SDS 언론보도](https://www.samsungsds.com/kr/news/index.html) — `div#bThumbs`·`div#sThumbs` 항목 수집·정규화·중복 제거·`INSERT/UPSERT`
   - [ ] (선택) 상세 기사 페이지 본문 fetch, `structured_payload.section` 구분(`bThumbs`/`sThumbs`)
   - [ ] (선택) 준실시간: 고빈도 폴링 + ETag/Last-Modified/목록 해시 변경 감지, 또는 RSS 우선

3. **Gen Node 프롬프트**
   - [ ] 2개년 참조 프롬프트 템플릿 작성
   - [ ] **계열사 데이터 통합 지시 추가 (신규)**
   - [ ] 변화 패턴 학습 지시 추가
   - [ ] 이미지 메타데이터 생성 로직

### 11.2 추후 개선 항목

1. **subtitle 컬럼 추가**
   - `sr_report_body` 테이블에 `subtitle` 컬럼 추가
   - 목차 + 부제목 혼합 검색으로 정확도 향상

2. **연속 페이지 클러스터링**
   - 단일 페이지 → 2~3페이지 연속 참조로 확장
   - 긴 섹션 처리 개선

3. **Supervisor 재도입**
   - 현재는 고정 파이프라인이지만
   - 데이터 부족 시 재검색, 품질 검증 루프 추가

4. **벤치마킹 통합**
   - 경쟁사 보고서와 비교
   - 업계 평균 대비 우수성 강조

5. **계열사·외부 데이터 파이프라인**
   - 자회사 제출 웹 폼 → `subsidiary_data_contributions`
   - EMS 시스템 API 연동
   - **배치·(선택) 준실시간 폴링 크롤([삼성SDS 언론보도](https://www.samsungsds.com/kr/news/index.html) `#bThumbs`/`#sThumbs` 또는 RSS) + (선택) 수동 주입 → `external_company_data` 적재**
   - DP 자동 연결 로직

---

## 12. 부록

### 12.1 용어 정리

| 용어 | 설명 |
|------|------|
| **DP (Data Point)** | 단일 ESG 지표 (예: "협력회사 ESG 평가 실시 현황") |
| **카테고리** | SR 보고서 목차 섹션 (예: "협력회사 ESG 관리") |
| **toc_path** | Table of Contents Path, 목차 경로 |
| **정확 매칭** | `category_column = '협력회사 ESG 관리'` SQL 일치 |
| **벡터 검색** | 임베딩 기반 코사인 유사도 검색 |
| **시계열 학습** | 2023→2024 변화 패턴을 2025 생성에 반영 |
| **계열사 데이터** | 사업장/시설 단위의 구체적 ESG 활동 상세 (예: 동탄 데이터센터 태양광) |
| **aggregation_node** | 계열사·외부 기업 스냅샷을 연도별로 조회·정렬하는 실행 노드 |
| **external_company_data** | 삼성SDS 뉴스 **`#bThumbs`/`#sThumbs`**(또는 RSS) **배치·선택적 준실시간 폴링**·수동 보완으로 채운 보도·언론 스냅샷 테이블 (**SR 요청 시** 크롤 없음) |
| **사업장별 데이터** | 각 계열사/자회사가 제공하는 실측 데이터 및 설명 |

### 12.2 참조 문서

- 기존 워크플로우: `ARCHITECTURE.md`, `NODES.md`
- 데이터 온톨로지: `DATA_ONTOLOGY.md`
- DB 구조: `DATABASE_TABLES_STRUCTURE.md`
- 전년도 파싱: `HISTORICAL_REPORT_PARSING.md`

---

**문서 버전**: 3.0  
**최종 수정**: 2026-04-04 (§3.1 LLM: Gemini 3.1 Pro / 2.5 Pro / GPT-5 mini, §3.1.1 임베딩 BGE-M3 현행, §3.1.2 **orchestrator → infra → agent** 아키텍처 명시, LangGraph 통합 방침)  
**작성자**: AI Assistant  
**검토 필요**: Orchestrator 병합 로직, `aggregation_node`·뉴스 배치/준실시간 폴링 인제스션·수동 보완, 반복 루프 테스트

**주요 참조 문서**:
- `orchestrator.md`: 오케스트레이터 구현 상세 (LangGraph 통합 포함)
- `c_rag.md`: c_rag 에이전트 구현 상세
- `DATABASE_TABLES_STRUCTURE.md`: DB 스키마
- `DATA_ONTOLOGY.md`: DP·임베딩 구조


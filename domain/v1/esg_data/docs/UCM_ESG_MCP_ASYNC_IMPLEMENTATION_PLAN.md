# UCM/ESG: MCP 정책 정렬·저장 전략·Async 통합 구현 계획

`data_integration`의 `MCPClient` 정책(환경 변수·in-process vs Streamable HTTP)과 생명주기를 맞추고, 정책 파이프라인의 저장 시점을 선택 가능하게 하며, 워크플로를 **async**로 통일하기 위한 단계별 작업서다.

상위 문서: [architecture.md](./architecture.md), [UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md](./UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md), [data_integration MCP 아키텍처](../../../data_integration/docs/MCP_ARCHITECTURE_RESILIENCE_REVIEW.md), [MCP_STREAMABLE_HTTP.md](../../../data_integration/docs/MCP_STREAMABLE_HTTP.md).

---

## 정책 (실행 코드 기준)

`esg_data_tools`는 **배포 서비스 간 streamable HTTP MCP 연결을 쓰지 않는다.** `mcp_esg_data_tools_url` / `MCP_ESG_DATA_TOOLS_URL` / HTTP 호스트·포트 설정은 제거되었고, `esg_tools_server.py`는 **stdio 전용(`mcp.run()`)**이다. 앱 내부는 `DirectEsgToolRuntime`·`load_inprocess_tools("esg_data_tools")` 경로만 사용한다. SR 등 다른 서버의 streamable HTTP 정책과는 분리된다.

---

## 목표 요약

| 구분 | 목표 |
|------|------|
| MCP | ESG는 **in-process·stdio만**; SR 등은 기존처럼 URL·`MCP_INTERNAL_TRANSPORT` 규칙 유지 |
| 저장 | 정책 파이프라인에서 **단계별 upsert** vs **단일 노드/트랜잭션에서 일괄 반영** 중 운영 요구에 맞게 선택 |
| Async | 오케스트레이터·에이전트·MCP `call_tool` 경로를 **async 일관**으로 정리 (`data_integration` SR 워크플로와 유사한 골격) |

---

## 0단계: 전제·용어

- **서버 논리 이름**: `esg_data_tools` (제안). `data_integration`의 `sr_tools`, `sr_index_tools`와 동일하게 `MCPClient`의 `server_name`으로 등록한다.
- **툴 본문**: 기존 `esg_ucm_tool_handlers.py`의 `handle_*`를 유지한다. HTTP/in-process 모두 최종적으로 동일 핸들러(또는 FastMCP 핸들러)에 도달하게 한다.
- **재귀 방지**: 원격 MCP가 `run_ucm_workflow` 등을 호출할 때 **새 오케스트레이터를 또 HTTP로 부르지 않도록**, 에이전트 쪽 런타임은 **항상 in-process 핸들러**를 쓰거나, 별도 플래그로 “내부 전용 런타임”을 고정한다(현재 `DirectEsgToolRuntime` 정책과 동일한 원칙).

---

## 1단계: `DirectEsgToolRuntime` ↔ `MCPClient` 정책·설정·생명주기 정렬

### 1.1 설정 (`backend/core/config/settings.py`)

- ESG 원격 MCP URL·HTTP 바인드 필드는 **추가하지 않음**(의도적으로 비움).

### 1.2 `data_integration` `mcp_client.py`

- `_INPROCESS_ELIGIBLE_SERVERS`에 `"esg_data_tools"` 유지
- `_MCP_STREAMABLE_HTTP_SERVERS` / `_MCP_SERVER_ENV_KEYS` / `_remote_url_from_settings`에는 **`esg_data_tools`를 넣지 않음** → 원격 HTTP로 붙지 않음
- `load_inprocess_tools("esg_data_tools")` 구현:
  - `esg_ucm_tool_handlers`의 함수들을 `_wrap_inprocess_tool` 또는 동일 패턴으로 노출
  - 툴 이름은 **MCP 서버(`esg_tools_server.py`)에 등록된 이름과 1:1 일치** (`create_unified_column_mapping`, `validate_ucm_mappings`, …)

### 1.3 앱 내부 비동기 경로

- `UCMCreationAgent.acreate_mappings` / `UCMOrchestrator.arun_validation_step`: **`asyncio.to_thread` + `DirectEsgToolRuntime.call_tool`** (원격 `tool_runtime` 분기 없음).
- `esg_mcp_transport.py`: 서버 이름 상수·헬퍼만 유지(원격 URL은 항상 빈 문자열).

### 1.4 Studio / 로컬 stdio

- IDE에서 subprocess로 붙일 때: `python -m backend.domain.v1.esg_data.spokes.infra.esg_tools_server` (기본 stdio).

### 1.5 검증 체크리스트 (1단계 끝)

- [ ] in-process 도구 목록 로드·실행 성공
- [ ] ESG `tests/` 통과

---

## 2단계: 정책 파이프라인 저장 전략 결정 및 구현 분기

운영·감사 요구에 따라 아래 중 하나를 **명시적으로 선택**하고, 코드에 **플래그 또는 전략 객체**로 고정한다.

### 2.1 옵션 A — 현행 유지: 단계별 upsert

- `run_ucm_policy_pipeline` 루프 안에서 `accept` 등 판정 직후 `mapping_service.upsert_ucm_from_payload` 호출
- **장점**: 부분 성공 시 이미 반영된 행이 DB에 남음, 재시작 시 중복 설계만 잘하면 됨
- **단점**: 배치 중간 실패 시 DB 상태가 혼합

### 2.2 옵션 B — 단일 저장 노드(또는 단일 트랜잭션)

- 루프에서는 **payload·메타만 `state["pending_upserts"]`에 적재**, 마지막 노드(또는 `finally`에 해당하는 그래프 엣지)에서 일괄 `upsert` 또는 단일 트랜잭션 커밋
- **장점**: “한 배치 단위”로 롤백·리포트가 쉬움
- **단점**: 대량 시 메모리·트랜잭션 길이 증가, 타임아웃 정책 필요

### 2.3 구현 메모

- TypedDict / `UCMWorkflowState`에 `persist_mode: Literal["per_item", "batch_end"]` 등 필드 추가 검토
- LangGraph 노드를 쪼갤 경우: `policy_evaluate` → `persist` 노드 분리
- 문서·런북에 **운영 기본값**을 한 줄로 명시 (예: “스테이징은 B, 프로덕션 일 배치는 A”)

### 2.4 검증 체크리스트 (2단계 끝)

- [ ] 선택한 모드에 대한 통합 테스트(드라이런·실DB 모킹)
- [ ] `dry_run=True`일 때 두 모드 모두 DB 미반영 보장

---

## 3단계: 워크플로 Async 통일

### 3.1 원칙

- 공개 API(라우터)는 `async def` + `await orchestrator.run_*` 형태로 통일
- **동기 오케스트레이터 안에서 `asyncio.run()` 남발 금지** — 이미 실행 중인 루프가 있으면 `RuntimeError` 위험. 상위를 async로 올리거나 `anyio`/`asyncio.create_task` 정책을 한 곳에만 둔다.

### 3.2 단계적 마이그레이션 (권장 순서)

1. **MCP 호출만 async**: `MCPClient.tool_runtime` 사용 지점을 에이전트에 도입 (`async with ...`)
2. **`UCMOrchestrator`에 `async def run_ucm_workflow_async` 등 병행 제공** — 기존 동기 메서드는 내부에서 `asyncio.run` 대신 **deprecated 래퍼**로만 유지하거나, 제거 시기 명시
3. **LangGraph**: 노드 함수를 `async def`로 통일 (`data_integration` `sr_workflow.py` 패턴)
4. **정책 파이프라인**: DB/CPU 블로킹 구간은 `asyncio.to_thread`로 감싸 이벤트 루프 양보

### 3.3 `data_integration`과의 “비슷한 플로우” 정렬

- 허브: `StateGraph` + 상태 TypedDict
- 스포크: ESG는 `DirectEsgToolRuntime`·핸들러 직결(또는 로컬 stdio MCP); SR 계열만 `MCPClient.tool_runtime` HTTP 경로
- 저장: 2단계에서 선택한 A/B에 맞춰 노드 배치

### 3.4 검증 체크리스트 (3단계 끝)

- [ ] FastAPI 라우터 전 구간 async 일관
- [ ] MCP in-process·ESG stdio 경로가 async 컨텍스트에서 동작
- [ ] CI에서 LangGraph 미설치 폴백 경로도 async 시그니처 정리(또는 동기 폴백을 한 파일로 격리)

---

## 작업 순서 권장

1. **1단계** (설정 + `MCPClient` 확장 + in-process 툴 등록) — 동작 변화를 최소화하면서 환경 정렬
2. **2단계** (저장 전략 결정 + 플래그) — 제품/운영 합의 후 코드 분기
3. **3단계** (async 리팩터) — API·오케스트레이터·에이전트를 한 번에 넓게 만지므로 별도 PR 권장

---

## 관련 파일 (참고)

| 영역 | 파일 |
|------|------|
| MCP 정책 | `backend/domain/v1/data_integration/spokes/infra/mcp_client.py` |
| 설정 | `backend/core/config/settings.py` |
| ESG 핸들러 | `backend/domain/v1/esg_data/spokes/infra/esg_ucm_tool_handlers.py` |
| ESG 인프로 런타임 | `backend/domain/v1/esg_data/spokes/infra/esg_ucm_tool_runtime.py` |
| ESG MCP 서버 | `backend/domain/v1/esg_data/spokes/infra/esg_tools_server.py` |
| 오케스트레이터 | `backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py` |
| SR 워크플로 참고 | `backend/domain/v1/data_integration/hub/orchestrator/sr_workflow.py` |

---

**작성일**: 2026-03-26  
**상태**: 구현 계획(초안)

---

## 구현 반영 요약 (코드)

- **1단계**: `MCPClient`에 `esg_data_tools` in-process 등록·`load_inprocess_tools`·stdio `cwd`; streamable HTTP 목록에서 ESG 제외; `esg_mcp_transport.py`·`esg_tools_server.py`(stdio).
- **2단계**: `run_ucm_policy_pipeline` / `run_ucm_nearest_pipeline`에 `persist_mode: per_item | batch_end`(기본 `per_item`), API 요청 모델·응답 `persist_mode` 필드.
- **3단계**: `UCMCreationAgent.acreate_mappings` / `UCMOrchestrator.arun_validation_step`는 `to_thread` + `DirectEsgToolRuntime`; `UCMOrchestrator`의 `*_async` 메서드, FastAPI `ucm_router`는 `await *_async`. LangGraph 경로는 **`ainvoke` + 비동기 노드**(create/validate) 우선, 실패 시 동기 `invoke`를 스레드로 폴백.
- **내부 런타임**: `DirectEsgToolRuntime`은 **항상 핸들러 직결**.

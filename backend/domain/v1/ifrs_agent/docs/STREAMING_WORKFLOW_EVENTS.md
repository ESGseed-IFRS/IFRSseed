# IFRS Agent 워크플로우 실시간 단계 이벤트(SSE) 구현 가이드

> **목표(B)**: 생성 요청 중 사용자에게 Gemini류 UI처럼 **현재 단계**(프롬프트 해석, DB 조회, RAG, 생성·검증 등)를 **실시간**으로 보여 준다.  
> **작성일**: 2026-04-08  
> **범위**: 백엔드 이벤트 스트림 설계 + 프론트 소비 패턴 + 단계별 구현 순서(실수 방지).  
> **전제**: 기존 `POST /ifrs-agent/reports/create`는 **완료 후 단일 JSON**을 유지하거나, 스트림 전용 엔드포인트를 **추가**하는 방식을 권장한다.

---

## 1. 현재 구조 요약 (검토 결과)

| 구성요소 | 역할 | 스트리밍 관련 |
|----------|------|----------------|
| `router.py` | `run_workflow()` 호출 → `WorkflowResponse` 반환 | 한 번의 HTTP 응답만 |
| `models/langgraph/workflow.py` | `build_workflow` → `orchestrator_run` → `orchestrator.orchestrate()` | `ainvoke` 완료까지 블로킹 |
| `hub/orchestrator/orchestrator.py` | Phase 0~4 로직 (`_create_new_report` 등) | `logger.info`만 있음, 클라이언트로 이벤트 없음 |

**Phase 경계** (`_create_new_report` 기준, 구현 시 이벤트 훅 후보):

1. **Phase 0**: `_interpret_user_prompt`
2. **Phase 1**: `_parallel_collect` (내부에서 `c_rag`, `dp_rag`, `aggregation_node` 병렬)
3. **Phase 1.5**: `_validate_dp_hierarchy` (조건부, 조기 반환 `needs_dp_selection` 가능)
4. **Phase 2**: `_merge_and_filter_data` (내부 `_select_data_for_gen` 등)
5. **Phase 3**: `_generation_validation_loop` (시도마다 gen → validator)
6. **Phase 4**: 최종 반환

**중요**: LangGraph `should_retry`로 `orchestrator_node`가 **재진입**할 수 있으므로, 스트림에는 **`attempt` / `workflow_id` / `run_id`**를 넣어 구분할 것.

---

## 2. 준비물 (구현 전 체크리스트)

### 2.1 의사결정

| 항목 | 권장 | 비고 |
|------|------|------|
| 전송 프로토콜 | **SSE** (`text/event-stream`) | FastAPI 네이티브, 단방향(서버→클라이언트)으로 충분. 양방향이 필요하면 WebSocket. |
| 기존 API | **유지 + 신규** | `POST .../create` 유지, `GET .../create/stream?...` 또는 `POST .../create/stream` 추가. |
| 인증 | **기존과 동일** | `fetchWithAuthJson`과 동일한 쿠키/헤더를 SSE에도 전달(EventSource는 커스텀 헤더 제약 → **쿼리 토큰** 또는 **POST + ReadableStream** 검토). |
| 민감 정보 | **스트림에 원문 금지 또는 축약** | `prompt` 전문, API 키, 개인정보 컬럼은 길이 제한·해시·omit. |

### 2.2 의존성

- 별도 패키지 필수는 아님(FastAPI `StreamingResponse`).
- 프론트: `EventSource` 또는 `fetch` + `ReadableStream` (POST 바디 필요 시).

### 2.3 이벤트 수신기(콜백) 주입 방식

다음 중 하나를 **일관되게** 선택한다.

| 방안 | 장점 | 단점 |
|------|------|------|
| **A. `Orchestrator` 생성자에 `event_sink: Optional[WorkflowEventSink]`** | 명시적, 테스트에서 Mock 용이 | 시그니처 변경 |
| B. `contextvars`에 전역 sink | 호출부 변경 적음 | 디버깅·테스트 어려움 |
| C. `infra`에 `emit_workflow_event` 추가 | 에이전트 내부에서도 emit 가능 | Infra API 확장 필요 |

**권장**: **A + 필요 시 C** — 오케스트레이터 Phase에서 대부분 emit하고, 에이전트 단에서 세부 로그가 필요하면 `infra`에 얇은 래퍼를 추가.

---

## 3. 이벤트 스키마 (계약)

### 3.1 공통 봉투 (SSE `data:` JSON 한 줄)

```json
{
  "v": 1,
  "workflow_id": "uuid",
  "ts": "2026-04-08T12:00:00.000Z",
  "phase": "phase0|phase1|phase1_5|phase2|phase3|phase4|system",
  "step": "interpret_prompt_start|c_rag_done|...",
  "status": "started|progress|completed|failed|skipped",
  "attempt": 0,
  "detail": {
    "message_ko": "프롬프트 해석 중",
    "safe_summary": {}
  }
}
```

- **`step`**: 기계 판독용 고정 문자열(다국어 라벨은 프론트 매핑 테이블로 분리 가능).
- **`detail.safe_summary`**: 예 — `{"search_intent_preview": "…40자"}`, `{"years": [2024, 2023]}`, `{"dp_ids_count": 2}` 처럼 **짧고 비민감**한 것만.

### 3.2 종료 이벤트

스트림 마지막에 반드시 하나:

```json
{
  "v": 1,
  "workflow_id": "uuid",
  "phase": "system",
  "step": "stream_end",
  "status": "completed",
  "detail": { "message_ko": "워크플로 완료" }
}
```

에러 시:

```json
{
  "phase": "system",
  "step": "stream_error",
  "status": "failed",
  "detail": { "message_ko": "사용자에게 보여줄 짧은 메시지", "code": "ORCH_TIMEOUT" }
}
```

### 3.3 최종 페이로드와의 관계

- 스트림은 **진행 상황**만; **최종 `generated_text`, 전체 `references`**는 기존처럼:
  - **옵션 1**: 스트림 종료 직후 같은 연결에서 **마지막 이벤트에 `final_state_ref`만 주고**, 클라이언트가 별도 `GET`으로 결과 조회(결과 캐시 필요).
  - **옵션 2**(권장 단순): 스트림은 **로그 전용**, 완료 후 클라이언트가 **기존 `POST /reports/create`와 동일 로직을 백그라운드에서 한 번 더** 호출하지 않도록, **스트림 핸들러 내부에서 워크플로를 1회 실행**하고 **마지막 SSE에 `result` 요약 필드**를 포함(중복 실행 방지).

**실수 방지**: 워크플로를 **두 번 돌리지 않기** — 스트림 엔드포인트 하나에서 `run_workflow`를 **한 번만** 호출하고, 그 실행 경로에서만 `emit`한다.

---

## 4. 백엔드 구현 요지

### 4.1 `WorkflowEventSink` 프로토콜

```python
# 개념 예시 (실제 위치는 hub/orchestrator 또는 models/)
class WorkflowEventSink(Protocol):
    async def emit(self, event: dict) -> None: ...
```

- 동기 `logging`과 병행 가능.
- `Orchestrator.__init__(self, infra, event_sink=None)` → `_create_new_report` 각 Phase 전후에서 `await sink.emit(...)`.

### 4.2 삽입 지점 (최소 세트)

| 위치 | `step` 예시 |
|------|-------------|
| `_interpret_user_prompt` 직전/직후 | `phase0_start`, `phase0_done` + `search_intent` 프리뷰(길이 제한) |
| `_parallel_collect` 직전 | `phase1_start` |
| `asyncio.gather` 직후 | `phase1_done` + 각 에이전트 성공/실패 요약(에러 메시지는 짧게) |
| `_validate_dp_hierarchy` | `phase1_5_start` / `phase1_5_done` 또는 `needs_dp_selection` |
| `_merge_and_filter_data` | `phase2_start` / `phase2_done` + `data_selection` 요약 플래그만 |
| `_generation_validation_loop` 루프마다 | `phase3_attempt`, `gen_start`, `validator_start`, `validator_done` |
| 최종 return 직전 | `phase4_done` |

에이전트 **내부**까지 세분화하려면 `c_rag.collect` 등에 선택적 콜백을 넘기거나, infra 래핑으로 `call_agent` 시점에 `emit` (방안 C).

### 4.3 FastAPI SSE

- `StreamingResponse` + async generator.
- `yield f"data: {json.dumps(e, ensure_ascii=False)}\n\n"`.
- 헤더: `Cache-Control: no-cache`, `X-Accel-Buffering: no`(nginx).
- **타임아웃**: Uvicorn/Gunicorn worker timeout보다 길어질 수 있으므로 설정 검토.

### 4.4 인증 이슈 (프론트)

- 브라우저 `EventSource`는 **커스텀 Authorization 헤더를 붙이기 어렵다**.
- 대안: **POST + `fetch` 스트리밍**(`response.body.getReader()`)으로 동일 헤더 유지, 또는 **짧은 TTL 스트림 토큰**을 쿼리로 전달.

---

## 5. 프론트엔드 구현 요지 (`HoldingPageByPageEditor.tsx`)

1. **상태**: `steps: Array<{ step, status, message_ko, ts, detail? }>` 또는 누적 로그 문자열.
2. **UI**: 접이식 한 줄(이미지 참고) + 펼치면 타임라인; `generating === true`일 때 스트림 소비.
3. **완료**: 스트림 `stream_end` 수신 후 **같은 응답에 포함된 `generated_text` 등**으로 본문/레이아웃 갱신(서버 설계에 따름).
4. **폴백**: SSE 실패 시 기존 단일 `POST /create`로 **그대로** 동작하게 유지.

---

## 6. 단계별 구현 순서 (실수 방지)

아래 순서를 지키면 **이중 실행·인증 누락·민감정보 유출**을 줄일 수 있다.

| 단계 | 작업 | 완료 기준 |
|------|------|-----------|
| **1** | 이벤트 스키마 + `WorkflowEventSink` 프로토콜 문서화(본 문서) | 리뷰 합의 |
| **2** | `Orchestrator`에 **옵셔널** `event_sink` 주입, **no-op 기본값** | 기존 테스트 전부 통과 |
| **3** | `_create_new_report`에만 **Phase 0~4 네 개 경계** emit (내용은 짧은 한글 메시지) | 수동 호출 시 로그 이벤트 확인 |
| **4** | `run_workflow` 호출 시 `event_sink`를 orchestrator에 전달할 경로 확보 (`build_workflow`가 orchestrator를 클로저로 잡으므로 **팩토리 인자** 또는 **run 단계에서 sink 주입**) | 단일 코드 경로로만 워크플로 실행 |
| **5** | 새 API `.../reports/create/stream` (또는 동등)에서 **한 번의** `run_workflow` + SSE | curl로 이벤트 줄 단위 확인 |
| **6** | 민감 필드 audit: `detail`에 프롬프트/DB값 전면 금지, preview 길이 제한 | 체크리스트 서명 |
| **7** | 프론트: 스트림 소비 + 접이식 UI | 네트워크 탭에서 스트림 확인 |
| **8** | Phase 1/3 세부 스텝(에이전트별) — 필요 시에만 infra emit | 과도한 이벤트 폭주 주의(디바운스/샘플링) |

**함정**:

- `build_workflow()`가 매번 새 `Orchestrator`를 만들면, **sink를 orchestrator 생성 시 넘겨야** 한다 → `build_workflow(infra, event_sink=None)` 시그니처 확장이 깔끔하다.
- LangGraph **재시도** 시 Phase 3 이벤트가 **반복**되므로 UI는 `attempt`로 묶거나 “재시도 N회”로 표시.

---

## 7. 테스트

| 유형 | 내용 |
|------|------|
| 단위 | `event_sink` Mock에 emit 횟수·phase 순서 검증 |
| 통합 | 스트림 엔드포인트: 첫 이벤트~`stream_end`까지 파싱, 최종 상태와 불일치 없음 |
| 부하 | 동시 요청 2~3개 시 이벤트 섞임 없음(`workflow_id`로 필터) |

---

## 8. 문서·코드 참조

- 워크플로: `models/langgraph/workflow.py` — `run_workflow`, `build_workflow`
- 오케스트레이터: `hub/orchestrator/orchestrator.py` — `_create_new_report` Phase 순서
- API 응답 필드: `api/v1/ifrs_agent/router.py` — `WorkflowResponse` (`prompt_interpretation`, `gen_input` 등)
- 설계 배경: `docs/REVISED_WORKFLOW.md`, `docs/PHASE3_FLEXIBLE_INPUT_DESIGN.md`

---

## 9. 로직 구현 상세 (백엔드)

이 절은 **실제 코드에 옮길 때의 동작 순서**를 고정한다. 핵심은 **(1) 워크플로 1회 실행**, **(2) emit은 비동기 큐로 모아 SSE가 소비**, **(3) 완료 후 같은 스트림에 최종 JSON 1건**이다.

### 9.1 `WorkflowEventSink` 구체 타입

```python
# typing.Protocol 또는 ABC
from typing import Any, Dict, Optional, Protocol

class WorkflowEventSink(Protocol):
    async def emit(self, event: Dict[str, Any]) -> None: ...

class NoOpWorkflowEventSink:
    async def emit(self, event: Dict[str, Any]) -> None:
        return None
```

- 프로덕션 외 테스트에서는 `NoOpWorkflowEventSink`를 넣어 **기존 동작 유지**를 검증한다.

### 9.2 큐 기반 Sink → SSE 브리지 (권장 패턴)

오케스트레이터는 여러 `await` 지점에서 `emit`을 호출하고, **HTTP 응답 본문**은 **별도 코루틴**이 `Queue`에서 꺼내 `yield`한다.

```python
import asyncio
import json
from datetime import datetime, timezone

class QueueWorkflowEventSink:
    def __init__(self, q: asyncio.Queue, workflow_id: str):
        self._q = q
        self._workflow_id = workflow_id

    async def emit(self, event: dict) -> None:
        env = {
            "v": 1,
            "workflow_id": self._workflow_id,
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            **event,
        }
        await self._q.put(env)
```

**스트리밍 엔드포인트 의사코드**:

```python
async def sse_create_report(request: CreateReportRequest):
    workflow_id = str(uuid4())
    q: asyncio.Queue = asyncio.Queue()
    sink = QueueWorkflowEventSink(q, workflow_id)

    async def event_iter():
        # 워크플로를 백그라운드 태스크로 실행 — 메인 제너레이터는 큐만 소비
        async def run():
            try:
                infra = get_infra()
                final_state = await run_workflow(
                    user_input={...},
                    infra=infra,
                    workflow_id=workflow_id,
                    event_sink=sink,  # 신규 인자
                )
                await sink.emit({
                    "phase": "system",
                    "step": "workflow_finished",
                    "status": "completed",
                    "detail": {"message_ko": "생성 완료", "final_state": _public_slice(final_state)},
                })
            except Exception as e:
                await sink.emit({
                    "phase": "system",
                    "step": "stream_error",
                    "status": "failed",
                    "detail": {"message_ko": str(e)[:200], "code": "WORKFLOW_FAILED"},
                })
            finally:
                await q.put(None)  # 종료 센티넬

        task = asyncio.create_task(run())

        while True:
            item = await q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

        await task  # 예외 전파 확인

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

**주의**:

- `run()` 안에서 **`run_workflow`는 정확히 1회**만 호출한다.
- `finally`에서 **센티넬 `None`**을 넣어 제너레이터 루프를 끝낸다.
- 클라이언트 연결 끊김 시 `task.cancel()` 처리(선택) — 취소 시 워크플로 내부도 협력적 취소가 필요할 수 있음.

### 9.3 `run_workflow` / `build_workflow` 시그니처 (논리)

```python
def build_workflow(infra: InfraLayer, event_sink: Optional[WorkflowEventSink] = None):
    orchestrator = Orchestrator(infra, event_sink=event_sink)
    ...

async def run_workflow(
    user_input: dict,
    infra: InfraLayer,
    workflow_id: str | None = None,
    event_sink: Optional[WorkflowEventSink] = None,
) -> dict:
    app = build_workflow(infra, event_sink=event_sink)
    ...
```

- `event_sink`가 `None`이면 `Orchestrator` 내부는 `NoOpWorkflowEventSink`와 동일하게 동작하게 구현한다.

### 9.4 오케스트레이터 내부 `_emit` 헬퍼

중복을 줄이고 **민감정보 제거**를 한곳에서 한다.

```python
def _truncate(s: str | None, max_len: int = 80) -> str:
    if not s:
        return ""
    s = s.strip()
    return s if len(s) <= max_len else s[: max_len - 1] + "…"

async def _emit(
    self,
    sink: Optional[WorkflowEventSink],
    *,
    phase: str,
    step: str,
    status: str,
    attempt: int = 0,
    message_ko: str = "",
    safe_summary: Optional[dict] = None,
):
    if sink is None:
        return
    await sink.emit({
        "phase": phase,
        "step": step,
        "status": status,
        "attempt": attempt,
        "detail": {
            "message_ko": message_ko,
            "safe_summary": safe_summary or {},
        },
    })
```

- `user_input["prompt"]`는 **`_truncate`된 preview만** `safe_summary`에 넣는다.
- DB에서 온 수치·이름은 **정책에 따라** omit 또는 마스킹.

### 9.5 `_create_new_report` 삽입 순서 (의사코드)

```python
async def _create_new_report(self, user_input):
    sink = self._event_sink

    await self._emit(sink, phase="phase0", step="phase0_start", status="started", message_ko="프롬프트 해석 시작")
    phase0 = await self._interpret_user_prompt(user_input)
    user_input = {**user_input, **phase0}
    await self._emit(
        sink,
        phase="phase0",
        step="phase0_done",
        status="completed",
        message_ko="프롬프트 해석 완료",
        safe_summary={"search_intent_preview": _truncate(user_input.get("search_intent"))},
    )

    await self._emit(sink, phase="phase1", step="phase1_start", status="started", message_ko="참조·팩트·집계 데이터 수집")
    data = await self._parallel_collect(user_input)
    await self._emit(
        sink,
        phase="phase1",
        step="phase1_done",
        status="completed",
        message_ko="병렬 수집 완료",
        safe_summary={"years": [2024, 2023], "has_ref_2024": bool(data["ref_data"].get("2024"))},
    )

    # Phase 1.5 …
    # Phase 2 …
    # Phase 3: 루프 안에서 attempt 인덱스 전달
    #   await self._emit(..., phase="phase3", step="gen_start", attempt=attempt_idx, ...)
    # Phase 4 …
```

`_parallel_collect` **내부**에서 `c_rag`/`dp_rag`/`aggregation` 각각 완료 시점에 `emit`하고 싶다면, `asyncio.gather` 대신 **`gather` + 완료 콜백** 또는 **`asyncio.Task`에 이름 붙여 순서 무관 완료 이벤트**를 보낸다(이벤트 폭주 방지: “phase1_agent_done” 3줄만).

### 9.6 LangGraph 재시도와 `attempt`

- `workflow.py`의 `should_retry`로 `orchestrator_run`이 **재호출**되면, `Orchestrator` 인스턴스가 새로 만들어지거나 동일 인스턴스가 재사용될 수 있다.
- **권장**: `create_initial_state`의 `attempt`를 읽어 `emit`에 넣거나, Phase 3만 **로컬 변수 `loop_i`**로 별도 관리.
- UI 문구: `attempt=1`이면 “재시도 1회차”처럼 표시.

### 9.7 최종 결과를 스트림에 실을 때 (`workflow_finished`)

- `final_state` 전체를 보내면 **응답 크기·민감도** 문제가 생긴다.
- **권장**: `WorkflowResponse`를 만드는 것과 **동일한 필드**만 `_public_slice(final_state)`로 잘라서 `detail.final`에 넣거나, 마지막 이벤트만 **클라이언트가 `POST /create` 응답과 동일 스키마**로 파싱하게 맞춘다.
- 대안: 스트림은 이벤트만, 완료 후 클라이언트가 **`GET /ifrs-agent/reports/status/{workflow_id}`**로 결과 조회(서버에 `workflow_id`→state 캐시 필요).

---

## 10. 로직 구현 상세 (프론트엔드)

### 10.1 왜 `fetch` + 스트림인가

- 쿠키/Authorization 헤더를 그대로 쓰려면 **`EventSource`보다 `fetch(..., { headers })` + `response.body.getReader()`**가 안전하다.
- `POST` 바디(`CreateReportRequest`와 동일)를 유지할 수 있다.

### 10.2 SSE 프레임 파싱 루프

브라우저는 `data: ...\n\n` 단위로 끊어 읽지 않을 수 있어 **버퍼**가 필요하다.

```typescript
async function consumeWorkflowSse(
  url: string,
  init: RequestInit,
  onEvent: (ev: WorkflowSseEvent) => void,
): Promise<void> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Accept: 'text/event-stream' } });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const block of parts) {
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) {
          const json = line.slice(5).trim();
          if (!json) continue;
          const ev = JSON.parse(json) as WorkflowSseEvent;
          onEvent(ev);
          if (
            ev.step === 'stream_end' ||
            ev.step === 'workflow_finished' ||
            ev.step === 'stream_error'
          ) {
            return;
          }
        }
      }
    }
  }
}
```

- 프로덕션에서는 `JSON.parse` 실패 시 해당 줄 스킵 + 로깅.
- **중첩 `data:`** 규칙은 서버가 한 이벤트당 한 줄로 고정하면 단순해진다.

### 10.3 React 상태와 UI

- `useState<WorkflowSseEvent[]>([])` — `onEvent`에서 `setSteps((s) => [...s, ev])`.
- **현재 줄** 표시: 배열의 마지막 항목의 `detail.message_ko` 또는 `STEP_LABELS[ev.step]`.
- 펼침 패널: `steps.map`으로 타임라인.
- `generating`은 첫 바이트 수신 전 true, `workflow_finished` 또는 `stream_error` 후 false.

### 10.4 폴백

```typescript
try {
  await consumeWorkflowSse('/api/.../create/stream', { method: 'POST', body: JSON.stringify(payload), ... }, onEvent);
} catch {
  // 기존 fetchWithAuthJson POST /create
}
```

---

## 11. 시퀀스 (텍스트)

```
Client                Router                    run_workflow              Orchestrator
  |                      |                            |                          |
  |-- POST /stream ----->|                            |                          |
  |                      |-- create Task ---------->|                          |
  |                      |     + QueueSink          |-- build_workflow(sink)-->|
  |                      |                            |-- ainvoke ------------>|-- orchestrate
  |                      |                            |                          |-- emit phase0…
  |<-- SSE data ---------|<-- queue get ------------|                          |-- emit phase1…
  |                      |                            |                          |-- …
  |                      |                            |<-- final_state --------|
  |<-- data workflow_finished -----------------------|                          |
  |<-- stream end (sentinel) -------------------------|                          |
```

---

## 12. 요약

- **준비**: SSE vs WebSocket, 인증 방식, 민감정보 정책, `event_sink` 주입 방식 합의.
- **효율**: 오케스트레이터 **Phase 경계**에만 먼저 붙이고, 세부는 이후; 워크플로 **단일 실행**으로 스트림+결과 일치.
- **실수 방지**: 단계표 순서대로 구현, 기존 `POST /create` 회귀 테스트 유지, LangGraph **attempt** 표시.
- **로직 핵심**: `QueueWorkflowEventSink` + 백그라운드 `run_workflow` + 메인 루프에서 `yield` SSE; 오케스트레이터는 `_emit`으로만 큐에 넣는다.

이 문서는 구현 시 **체크리스트**로 사용하고, 스키마(`step` 목록)는 첫 PR에서 확정한 뒤 버전(`v`)을 올려 호환성을 관리한다.

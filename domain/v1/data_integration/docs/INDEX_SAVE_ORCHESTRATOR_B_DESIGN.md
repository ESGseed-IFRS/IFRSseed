# B안: 인덱스 저장 책임 오케스트레이터 이전 — 구현 요약

## 목표

- **sr_index_agent**: 파싱·검증·보정만 수행. **저장(save_sr_report_index_batch) 호출 안 함.**
- **오케스트레이터(API)**: 에이전트 반환값을 검사한 뒤 **저장 수행**.

## 적용 내용

### 1. MCP 툴 서버 (`spokes/infra/sr_index_tools_server.py`)

- `save_sr_report_index_batch` 툴 제거.
- 에이전트가 MCP로 이 서버만 쓸 경우 저장 툴이 노출되지 않음.

### 2. sr_index_agent (`spokes/agents/sr_index_agent.py`)

- 시스템 프롬프트: 저장 단계·규칙 문구 삭제. "파싱·보정 완료 후 보고"만 안내.
- 툴 인자 자동 주입: `save_sr_report_index_batch` 관련 블록 삭제.
- Fallback 저장: "LLM이 save를 안 불렀을 때 에이전트가 직접 저장" 블록 삭제.
- 반환: `saved_count=0`, `sr_report_index=list(last_sr_report_index)` 고정. 호출 측이 이 배열을 받아 저장.

### 3. API (`api/v1/data_integration/sr_agent_router.py`)

- `extract_and_save_index_agentic`:
  - `sr_index_agent` 호출 후 `result.success` 및 `result.sr_report_index` 확인.
  - `report_id`와 `sr_report_index`가 있으면 **오케스트레이터가** `save_sr_report_index_batch.invoke(...)` 호출.
  - 응답의 `saved_count`는 위 저장 결과의 `saved_count`로 설정.

## 계약

- **sr_index_agent 반환**: `success`, `message`, `report_id`, `sr_report_index`, `saved_count=0`, `errors`.
- **저장 책임**: 인덱스 저장은 오케스트레이터(또는 API)만 수행. 에이전트는 저장하지 않음.

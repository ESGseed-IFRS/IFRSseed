# MCP 서버 전용 폴더 통합 설계

backend 아래에 MCP 서버 전용 폴더를 두고, 각 서비스에서 쓰는 MCP 서버를 한곳에서 관리·실행하는 방안을 정리한 문서다.

---

## 1. 현재 구조

### 1.1 서버 위치

| 서버 | 경로 | 용도 | 사용 에이전트 |
|------|------|------|----------------|
| sr_tools_server | `spokes/infra/sr_tools_server.py` | PDF 링크 추출, 다운로드 | sr_agent |
| sr_index_tools_server | `spokes/infra/sr_index_tools_server.py` | 인덱스 파싱 (Docling, LlamaParse 등) | sr_index_agent |
| sr_body_tools_server | `spokes/infra/sr_body_tools_server.py` | 본문 파싱·매핑·저장 | sr_body_agent |

- **Streamable HTTP** 사용 시: 서버별로 **포트를 하나씩** 사용 (예: 8000, 8001, 8002).
- **stdio** 사용 시: API 요청마다 해당 서버를 **서브프로세스**로 기동.

### 1.2 클라이언트 연결

- `spokes/infra/mcp_client.py` 의 `MCPClient` 가 서버별 스크립트 경로를 계산.
- `_SR_SERVERS_IN_INFRA` 에 있는 서버는 `infra_dir` 기준 `{name}_server.py` 를 참조.
- `get_mcp_params(server_name)` 이 환경 변수 `MCP_*_URL` 이 있으면 Streamable HTTP, 없으면 stdio 파라미터 반환.

### 1.3 한계

- MCP 서버 코드가 **data_integration/spokes/infra** 에만 있어, “MCP 서버”라는 역할이 도메인 경로에 묶여 있음.
- 서버를 추가·이동할 때 **mcp_client** 의 경로/이름 규칙을 함께 수정해야 함.
- 서버 실행 방식(stdio vs HTTP, 포트)이 서버 스크립트마다 다르게 구현될 수 있음.

---

## 2. 제안 구조: backend/mcp 전용 폴더

### 2.1 목표

- **MCP 서버 코드**를 `backend/mcp/` (또는 `backend/mcp_servers/`) 아래로 모음.
- **실행 진입점**을 통일해, 서버 종류·전송 방식(stdio/HTTP)·포트를 한곳에서 관리.
- 기존 에이전트·오케스트레이터는 **서버 이름**(sr_tools, sr_index_tools, sr_body_tools)만 알면 되고, 실제 스크립트 경로는 mcp_client 가 새 위치를 참조하도록 변경.

### 2.2 디렉터리 구조 (안 A: 서버별 파일 유지)

```
backend/
  mcp/
    __init__.py
    config.py              # 포트/경로/환경 변수 정리 (선택)
    servers/
      __init__.py
      sr_tools.py          # 기존 sr_tools_server 로직 (FastMCP 인스턴스 + 툴)
      sr_index_tools.py    # 기존 sr_index_tools_server 로직
      sr_body_tools.py     # 기존 sr_body_tools_server 로직
    run.py                 # 진입점: --server {sr_tools|sr_index_tools|sr_body_tools} [--stdio|--http] [--port N]
```

- `run.py` 예: `python -m backend.mcp.run --server sr_index_tools --http --port 8000`
- 서버당 **프로세스 1개**, 기존처럼 **포트 3개** 사용 가능.
- **mcp_client** 는 서버 스크립트 경로를 `backend.mcp.run` 또는 `backend.mcp.servers.*` 를 가리키도록 변경 (아래 4장 참고).

### 2.3 디렉터리 구조 (안 B: 툴만 모듈화, 서버 1개로 통일)

```
backend/
  mcp/
    __init__.py
    tools/
      __init__.py
      sr.py                # fetch_page_links, download_pdf 등 (함수만 또는 FastMCP 서브 앱)
      index.py             # get_pdf_metadata, parse_index_with_docling 등
      body.py              # parse_body_pages, map_body_pages_to_sr_report_body 등
    server.py              # FastMCP 하나에 tools.* 툴 전부 등록
    run_unified.py         # python -m backend.mcp.run_unified --port 8000
```

- **프로세스 1개, 포트 1개**. 모든 에이전트가 같은 URL로 연결.
- 에이전트는 기존처럼 `list_tools` 로 받은 툴 중 자신이 쓰는 것만 호출하면 됨 (서버가 툴 이름으로 라우팅).

### 2.4 비교

| 항목 | 안 A (서버별 파일 + run.py) | 안 B (단일 서버) |
|------|-----------------------------|-------------------|
| 프로세스/포트 | 서버당 1개, 기본 3개 | 1개 |
| 스케일링 | 서버별로 인스턴스 증설 가능 | 한 서버만 증설 |
| 장애 격리 | 서버 단위 | 툴 단위 아님 |
| 배포/설정 | 서버별 포트/URL 필요 | URL 하나만 관리 |
| 기존 mcp_client 변경 | 경로/실행 방식만 변경 | URL 하나로 통일 가능, server_name 은 유지 가능 |

---

## 3. 구현 방법 (안 A 기준)

### 3.1 단계 1: backend/mcp 폴더 및 run.py 생성

1. **backend/mcp/**, **backend/mcp/servers/** 생성.
2. **backend/mcp/servers/** 아래에 기존 서버 로직 이전:
   - `spokes/infra/sr_tools_server.py` → `backend/mcp/servers/sr_tools.py` (FastMCP 인스턴스 + `@mcp.tool()` 정의 이전).
   - `spokes/infra/sr_index_tools_server.py` → `backend/mcp/servers/sr_index_tools.py`.
   - `spokes/infra/sr_body_tools_server.py` → `backend/mcp/servers/sr_body_tools.py`.
3. 각 모듈에서 **도메인/공유 툴 import** 는 기존처럼 `backend.domain.shared.tool.*` 등 절대 경로 유지.
4. **backend/mcp/run.py** 구현:
   - 인자: `--server {sr_tools|sr_index_tools|sr_body_tools}`, `--http`(선택), `--port`, `--host`, `--path`.
   - `--http` 없으면 `mcp.run()` (stdio), 있으면 `mcp.run(transport="streamable-http", host=..., port=..., path=...)`.
   - `--server` 값에 따라 `backend.mcp.servers.sr_tools` 등에서 FastMCP 인스턴스를 import 해서 해당 인스턴스에 대해 `run` 호출.

### 3.2 단계 2: mcp_client 가 새 경로 참조

- **서버 스크립트 경로**:
  - stdio 로 기동할 때: `python -m backend.mcp.run --server sr_index_tools` 처럼 **모듈 실행**으로 바꾸면, `_get_server_path` 대신 “실행할 모듈 이름 + 인자”를 반환하는 방식으로 변경 가능.
  - 또는 `_get_server_path(server_name)` 이 `backend/mcp/servers/{name}.py` 같은 **파일 경로**를 반환하고, `sys.executable` + `[str(server_path)]` 대신 `sys.executable + ["-m", "backend.mcp.run", "--server", server_name]` 를 사용하도록 수정.
- **Streamable HTTP** 는 이미 URL 기반이므로, **mcp_client** 변경 없이 환경 변수만 각 서버 포트에 맞게 설정하면 됨.

### 3.3 단계 3: 기존 infra 서버 파일 처리

- **옵션 1**: `spokes/infra/sr_*_tools_server.py` 를 **얇은 래퍼**로만 두고, 실제 로직은 `backend.mcp.servers.*` 를 import 해서 `mcp.run()` 호출. 기존 스크립트 경로를 그대로 쓸 수 있음.
- **옵션 2**: infra 쪽 서버 파일 삭제하고, 실행은 전부 `python -m backend.mcp.run` 으로 통일. **mcp_client** 만 새 실행 방식에 맞게 수정.

### 3.4 단계 4: Streamable HTTP용 환경 변수 유지

- `MCP_SR_INDEX_TOOLS_URL`, `MCP_SR_TOOLS_URL`, `MCP_SR_BODY_TOOLS_URL` 그대로 사용.
- 각 URL이 가리키는 포트에서 해당 서버만 띄우면 됨:
  - 예: `python -m backend.mcp.run --server sr_index_tools --http --port 8000`
  - 예: `python -m backend.mcp.run --server sr_tools --http --port 8001`
  - 예: `python -m backend.mcp.run --server sr_body_tools --http --port 8002`

---

## 4. 구현 방법 (안 B: 단일 서버)

### 4.1 단계 1: backend/mcp/tools 하위에 툴만 분리

- 각 기존 서버에서 **툴 함수**만 추출해 `backend/mcp/tools/sr.py`, `index.py`, `body.py` 에 정의.
- **FastMCP 인스턴스**는 `backend/mcp/server.py` 에서 하나만 생성하고, `tools.*` 의 툴을 전부 `@mcp.tool()` 로 등록 (또는 서브 앱을 include 하는 방식이 있다면 사용).

### 4.2 단계 2: 단일 진입점

- `backend/mcp/run_unified.py`: 위에서 만든 FastMCP 인스턴스를 import 해서 `run(transport="streamable-http", ...)` 또는 `run()` 호출.
- 환경 변수 하나만 사용: 예) `MCP_TOOLS_URL=http://127.0.0.1:8000/mcp`.
- **mcp_client** 에서는 `sr_tools`, `sr_index_tools`, `sr_body_tools` 모두 같은 URL을 쓰도록 하거나, 기존 변수 세 개를 같은 URL로 설정.

### 4.3 단계 3: 에이전트

- 에이전트는 **동일한 MCP URL**에 연결하고, `list_tools` 로 받은 툴 중 자신이 필요한 것만 호출. 기존 툴 이름이 유지되면 에이전트 코드 변경 최소화 가능.

---

## 5. 설정 요약 (안 A)

| 항목 | 내용 |
|------|------|
| 서버 실행 (stdio) | `python -m backend.mcp.run --server sr_index_tools` |
| 서버 실행 (HTTP) | `python -m backend.mcp.run --server sr_index_tools --http --port 8000` |
| 클라이언트 | 기존처럼 `get_mcp_params("sr_index_tools")` 등 호출. URL 설정 시 Streamable HTTP, 미설정 시 stdio (run 진입점 경로만 mcp_client 에서 참조). |
| 환경 변수 | 기존과 동일. `MCP_SR_INDEX_TOOLS_URL`, `MCP_SR_TOOLS_URL`, `MCP_SR_BODY_TOOLS_URL` (안 B는 하나로 통일 가능). |

---

## 6. 문서 간 관계

- **MCP_STREAMABLE_HTTP.md**: Streamable HTTP 사용법, 클라이언트/서버 연결 방식.
- **본 문서 (MCP_SERVER_FOLDER_UNIFICATION.md)**: MCP 서버 코드 배치·실행 진입점·통합/분리 옵션.

두 문서를 함께 두면, “어디에 서버 코드를 두고 어떻게 띄울지”와 “그 서버에 어떻게 연결할지”를 나눠서 참고할 수 있다.

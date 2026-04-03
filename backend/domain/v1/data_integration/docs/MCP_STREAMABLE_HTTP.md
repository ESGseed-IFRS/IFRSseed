# MCP Streamable HTTP 사용 가이드

stdio 대신 **Streamable HTTP**로 MCP 서버에 연결하면, 요청마다 subprocess로 서버를 새로 띄우지 않아 첫 호출 지연(예: 90초 타임아웃)을 피할 수 있다. 서버를 별도 프로세스/호스트에서 한 번 띄워 두고, 클라이언트는 HTTP로 접속한다.

---

## 1. FastMCP 기준 (서버 + 클라이언트)

현재 SR 툴 서버는 `mcp.server.fastmcp`(FastMCP)를 사용하므로, 서버만 바꾸면 된다.

### 1.1 서버: streamable-http로 기동

```python
# 예: sr_index_tools_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("SR Index Tools Server")
# ... @mcp.tool() 정의 ...

if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",   # 기본값
        port=8000,          # 기본값
        path="/mcp",        # 기본값
    )
```

- 실행 후 `http://127.0.0.1:8000/mcp` 에서 접속 가능.

### 1.2 클라이언트: FastMCP Client (URL만 주면 자동으로 Streamable HTTP)

```python
import asyncio
from fastmcp import Client

async def main():
    client = Client("http://127.0.0.1:8000/mcp")
    async with client:
        await client.ping()
        result = await client.call_tool("get_pdf_metadata_tool", {"report_id": "..."})
        print(result[0].text)

if __name__ == "__main__":
    asyncio.run(main())
```

- FastMCP 2.3+ 에서 URL이 `http(s)://...` 이면 Streamable HTTP로 자동 인식.
- **주의**: 현재 우리 에이전트는 `mcp.ClientSession` + `load_tools_from_session(session)` 을 쓰므로, FastMCP Client를 쓰려면 도구 로딩/호출 방식을 FastMCP Client API(`call_tool` 등)에 맞게 바꿔야 한다.

---

## 2. 공식 mcp 패키지 기준 (기존 ClientSession 유지)

에이전트에서 **ClientSession + load_tools_from_session** 을 그대로 쓰려면, 공식 `mcp` 패키지의 Streamable HTTP 클라이언트를 쓰면 된다. (python-sdk PR #573 병합, 2025-03-26 스펙)

### 2.1 서버

- 위와 동일하게 FastMCP 서버를 `mcp.run(transport="streamable-http", ...)` 로 기동.

### 2.2 클라이언트: streamablehttp_client + ClientSession

```python
import asyncio
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client(url="http://127.0.0.1:8000/mcp") as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            # 기존처럼 load_tools_from_session(session) 에 session 넘겨서 사용 가능
            # result = await session.call_tool("get_pdf_metadata_tool", {"report_id": "..."})
```

- `streamablehttp_client` 가 `(read_stream, write_stream, ...)` 을 주므로, 기존 `stdio_client(...)` 대신 여기서 나온 스트림으로 `ClientSession` 을 만들면 된다.
- **mcp_client.py 적용 시**: `get_mcp_params(server_name)` 이 `StdioServerParameters` 대신 “URL만 반환”하거나, 별도 함수로 “streamable HTTP일 때 streamablehttp_client 사용” 분기한 뒤, 에이전트에서는 `stdio_client(params)` vs `streamablehttp_client(url=...)` 만 바꾸고 그 다음은 기존과 동일하게 `ClientSession` + `load_tools_from_session(session)` 사용 가능.

### 2.3 인증(선택)

- 정적 헤더: `streamablehttp_client(url=..., headers={"Authorization": "Bearer ..."})` 등.
- 동적 인증: `AuthClientProvider` 서브클래스로 `get_headers()` 구현 후 `auth_client_provider=...` 로 전달 (python-sdk PR #700).

---

## 3. 참고 링크

| 대상 | 링크 |
|------|------|
| FastMCP 2.3 Streamable HTTP 소개 | https://jlowin.dev/blog/fastmcp-2-3-streamable-http |
| FastMCP Client HTTP 트랜스포트 | https://gofastmcp.com/python-sdk/fastmcp-client-transports-http |
| 공식 python-sdk Streamable HTTP 클라이언트 (PR #573) | https://github.com/modelcontextprotocol/python-sdk/pull/573 |
| MCP 스펙 (Streamable HTTP) | https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http |

---

## 4. 구현된 환경 변수 (이 코드베이스)

| 용도 | 환경 변수 | 예시 |
|------|-----------|------|
| 인덱스 툴 서버 URL | `MCP_SR_INDEX_TOOLS_URL` | `http://127.0.0.1:8000/mcp` |
| SR 툴 서버 URL | `MCP_SR_TOOLS_URL` | `http://127.0.0.1:8001/mcp` |
| 본문 툴 서버 URL | `MCP_SR_BODY_TOOLS_URL` | `http://127.0.0.1:8002/mcp` |
| 웹 검색 서버 URL | `MCP_WEB_SEARCH_URL` | (사용 시 설정) |
| 인덱스 서버 HTTP 모드 | `MCP_HTTP` 또는 `MCP_SR_INDEX_TOOLS_HTTP` | `1` |
| HTTP 포트/경로/호스트 | `MCP_HTTP_PORT`, `MCP_HTTP_PATH`, `MCP_HTTP_HOST` | `8000`, `/mcp`, `127.0.0.1` |

- 클라이언트: 위 URL이 설정되면 `mcp_client.connect()` 가 Streamable HTTP로 연결.
- 서버: `MCP_HTTP=1` 등으로 기동하면 `sr_index_tools_server.py` 가 `transport="streamable-http"` 로 listen.

### 4.1 MCP SR Index 서버 자동 기동 (main.py)

`backend/api/v1/data_integration/main.py` 를 실행할 때 **`MCP_SR_INDEX_TOOLS_URL`이 비어 있으면**, API 프로세스가 시작 시 **sr_index_tools_server.py 를 서브프로세스로 자동 기동**하고, 해당 URL을 설정한다. 별도 터미널에서 MCP 서버를 띄우지 않아도 된다.

| 환경 변수 | 설명 | 기본값 |
|-----------|------|--------|
| `MCP_SR_INDEX_TOOLS_HOST` | 자동 기동 서버 바인드 주소 | `127.0.0.1` |
| `MCP_SR_INDEX_TOOLS_PORT` | 자동 기동 서버 포트 | `8000` |
| `MCP_SR_INDEX_TOOLS_PATH` | 자동 기동 서버 경로 | `/mcp` |

- 이미 `MCP_SR_INDEX_TOOLS_URL` 이 설정되어 있으면 자동 기동하지 않고, 해당 URL로 연결한다.
- API 프로세스 종료 시 자동 기동한 서버 프로세스는 함께 종료된다.

## 5. 현재 코드에 적용 시 요약

1. **서버**  
   - `sr_index_tools_server.py` (및 필요 시 `sr_tools_server.py`, `sr_body_tools_server.py`) 에서 `mcp.run()` → `mcp.run(transport="streamable-http", host="127.0.0.1", port=8000, path="/mcp")` 로 변경.
   - 서버는 별도 터미널/프로세스에서 한 번 실행해 두고, API/에이전트는 그 URL로만 연결.

2. **클라이언트 (mcp_client.py)**  
   - 설정(환경 변수 등)으로 “stdio vs streamable-http” 구분.
   - streamable-http일 때: `streamablehttp_client(url=...)` 로 `(read_stream, write_stream, _)` 획득 → `ClientSession(read_stream, write_stream)` 생성 후 기존 `load_tools_from_session(session)` 그대로 사용.
   - stdio일 때: 기존처럼 `StdioServerParameters` + `stdio_client(params)` 유지.

3. **버전**  
   - `mcp`: 공식 SDK에서 Streamable HTTP 클라이언트가 포함된 버전 사용 (PR #573 머지 이후, 2025-03-26 스펙 대응).
   - FastMCP 서버용: `fastmcp` 2.3 이상 권장.

이렇게 하면 첫 요청에서 subprocess 기동이 없어져, `get_pdf_metadata_tool` 의 90초 타임아웃 현상을 피할 수 있다.

---

## 6. 관련 문서

- **MCP_SERVER_FOLDER_UNIFICATION.md**: backend 아래 MCP 서버 전용 폴더(`backend/mcp/`) 구성, 서버 통합·분리 옵션, 구현 단계.

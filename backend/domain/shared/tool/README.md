# ai/tool — MCP 도구 서버 (패턴 B)

이 디렉터리는 **패턴 B: MCP 서버로 도구 제공** 구조입니다.  
각 스크립트는 독립된 **MCP(Model Context Protocol) 서버**로 동작하며, 에이전트/클라이언트는 MCP 클라이언트로 연결해 도구를 호출합니다.

## 구조

| 서버 파일 | 설명 | 제공 도구 |
|-----------|------|------------|
| `web_search_server.py` | 웹 검색 | `duckduckgo_search`, `tavily_search` |
| `dart_server.py` | DART 공시 | `get_sustainability_report`, `search_disclosure` |
| `news_server.py` | 뉴스 검색 | `search_news` |
| `sr_tools_server.py` | SR 수집용 | `fetch_page_links`, `download_pdf` |

## 실행 방법

각 서버는 **stdio** 전송으로 동작합니다. 한 번에 하나의 서버만 실행합니다.

```bash
# ai/tool 디렉터리에서
cd ai/tool

# 의존성 설치
pip install -r requirement.txt

# 서버별 실행 (터미널 분리)
python web_search_server.py
python dart_server.py
python news_server.py
python sr_tools_server.py
```

또는 FastMCP CLI로:

```bash
fastmcp run web_search_server.py
fastmcp run sr_tools_server.py
```

## 환경 변수

| 변수 | 사용 서버 | 설명 |
|------|-----------|------|
| `DART_API_KEY` | dart_server | DART Open API 인증키 |
| `TAVILY_API_KEY` | web_search_server | Tavily 검색 API 키 (선택) |
| `MCP_TOOL_DATA_DIR` | sr_tools_server | PDF 저장 경로 (기본: `ai/data_integration/data`) |

## 클라이언트(에이전트) 연결

에이전트 서비스(data_integration 등)에서는 **MCP 클라이언트**로 위 서버에 연결한 뒤, 서버가 제공하는 도구 목록을 가져와 툴 콜링에 사용합니다.

- **stdio**: 같은 머신에서 서버 프로세스를 자식 프로세스로 띄우고 stdio로 통신
- **클라우드**: 필요 시 MCP 서버를 HTTP/SSE 등으로 노출하도록 구성

## 의존성

- `mcp`, `fastmcp`: MCP 서버
- `requests`, `beautifulsoup4`, `duckduckgo-search`: 웹 검색/크롤링

자세한 버전은 `requirement.txt` 참고.

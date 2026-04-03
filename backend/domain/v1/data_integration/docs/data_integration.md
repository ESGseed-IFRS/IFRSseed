# Data Integration 서비스

에이전트 기반으로 기업의 **지속가능경영보고서(SR/ESG) PDF**를 웹에서 검색·다운로드하는 서비스입니다.

---

## 1. 서비스 설명

### 1.1 역할

- **API**: `GET /sr-agent/download?company=회사명&year=연도`
- **동작**: 회사명·연도를 받아, 웹 검색 → 페이지 링크 추출 → PDF 다운로드까지 **LLM 에이전트**가 도구를 조합해 수행합니다.
- **결과**: 성공 시 `ai/data_integration/data/{회사명}_{연도}_sr.pdf` 경로에 저장하고, `success`, `path`, `message`를 JSON으로 반환합니다.

### 1.2 기술 스택

| 구분 | 기술 |
|------|------|
| API | FastAPI, Uvicorn (기본 포트 9005) |
| LLM | Groq ChatGroq, **Llama 3.3 70B Versatile** (tool calling) |
| 도구 | MCP(Model Context Protocol) — 도구는 **ai/tool**의 별도 MCP 서버에서만 로드 |
| 검색 | Tavily 우선, 없으면 DuckDuckGo |

### 1.3 디렉터리 구조

```
data_integration/ (domain)
├── main.py              # FastAPI 앱, uvicorn 진입점 (API의 sr_agent_router 포함)
├── service/                        # (SR Agent: API가 hub.orchestrator 직접 호출)
├── hub/                 # Hub-Spoke: orchestrator, routing (see HUB_SPOKE_ARCHITECTURE.md)
├── spokes/              # 에이전트·인프라 (agents, infra)
├── data/                # 다운로드된 PDF 저장 (예: 삼성에스디에스_2024_sr.pdf)
├── docs/
│   ├── data_integration.md    # 본 문서
│   └── PDF_PARSING_IN_MEMORY.md # PDF 저장 없이 bytes로 파싱 (개발 완료 후 전환 가이드)
└── requirement.txt

backend/api/v1/data_integration/
├── router.py            # Data Integration API (sr_agent_router 포함)
└── sr_agent_router.py   # /sr-agent/download 라우트 (HTTP 레이어)
```

ai/tool/                 # MCP 도구 서버 (data_integration이 stdio로 호출)
├── web_search_server.py # tavily_search, duckduckgo_search
└── sr_tools_server.py   # fetch_page_links, download_pdf
```

---

## 2. 구현 방법

### 2.1 실행

```bash
# 저장소 루트(ifrsseed/) .env 에 GROQ_API_KEY, (선택) TAVILY_API_KEY 설정
cd ai/data_integration
pip install -r requirement.txt
python main.py   # http://0.0.0.0:9005
```

### 2.2 API 호출 예시

```http
GET /sr-agent/download?company=삼성에스디에스&year=2024
```

**성공 예시:**

```json
{
  "success": true,
  "path": "C:\\...\\ai\\data_integration\\data\\삼성에스디에스_2024_sr.pdf",
  "message": "다운로드 완료: ..."
}
```

**실패 예시:**

```json
{
  "success": false,
  "path": null,
  "message": "보고서를 찾을 수 없습니다"
}
```

### 2.3 에이전트 흐름

1. **MCP 서버 기동**  
   - `web_search_server.py`, `sr_tools_server.py`를 각각 stdio 서브프로세스로 실행하고, MCP `ClientSession`으로 연결합니다.
2. **도구 로드**  
   - `list_tools()`로 도구 목록을 가져온 뒤, **MCP 인자를 그대로 넘기기 위한** `_MCPPassThroughTool`로 래핑합니다.  
   - `tavily_search`를 도구 목록 맨 앞에 두어 우선 사용하도록 합니다.
3. **LLM 루프**  
   - 시스템 프롬프트에 회사명·연도, “한 번에 도구 1개”, “tavily 우선”, “검색 쿼리에 영문명/도메인 보강” 등을 넣습니다.  
   - 매 턴: `llm.ainvoke(messages)` → `tool_calls`가 있으면 **첫 번째 도구만 실행** → 결과를 `ToolMessage`로 추가 후 다음 턴.  
   - 검색 도구 결과에는 `[사용 가능한 URL 목록]`을 붙여 LLM에 전달합니다.
4. **종료 조건**  
   - `download_pdf`가 성공하면 `result["success"]=True`, `path` 설정 후 종료.  
   - 또는 LLM이 도구 없이 최종 메시지를 주거나, 최대 반복 횟수(기본 10)에 도달하면 종료.

### 2.4 MCP 도구 정리

| 서버 | 도구 | 설명 |
|------|------|------|
| web_search | `tavily_search` | Tavily API 검색 (우선 사용) |
| web_search | `duckduckgo_search` | DuckDuckGo 검색 |
| sr_tools | `fetch_page_links` | URL 페이지에서 PDF/지속가능 관련 링크 추출 |
| sr_tools | `download_pdf` | PDF URL 다운로드 후 `data_integration/data/`에 저장 |

---

## 3. 구현 시 발생한 원인과 해결방법

아래는 서비스를 구현·운영하면서 겪은 문제와 적용한 해결 요약입니다.

### 3.1 MCP 도구 인자가 서버에 빈 dict로 전달됨

- **증상**: 에이전트 로그에는 `fetch_page_links({'url': 'https://...'})`처럼 인자가 있는데, MCP 서버(sr_tools) 쪽에서는 Pydantic이 `input_value={}`로 받아 "Field required (url)" 에러 발생.
- **원인**: LangChain `StructuredTool`이 `_parse_input`에서 `args_schema`(Pydantic 모델)로 검증한 뒤 `result.model_dump()`만 넘기는데, Pydantic v2에서는 `extra="allow"` 필드가 `model_dump()`에 포함되지 않아, LLM이 준 `url` 등이 빠져 빈 dict가 전달됨.
- **해결**: 스키마 검증을 거치지 않고 **원본 tool_input을 그대로** MCP `call_tool`에 넘기도록, **`_MCPPassThroughTool`** 커스텀 도구를 사용. `_parse_input`을 오버라이드해 dict 입력을 검증 없이 그대로 반환하고, `_arun`에서 그대로 `session.call_tool(tool_name, arguments)` 호출.

### 3.2 검색 결과를 기다리지 않고 잘못된 URL을 추측해 호출

- **증상**: 같은 턴에서 `duckduckgo_search`와 `fetch_page_links`를 동시에 호출해, 검색 결과가 나오기 전에 LLM이 추측한 URL(samsungsd.com 등)로 요청함.
- **원인**: 한 턴에 여러 도구를 병렬로 호출할 수 있어, 검색 결과가 컨텍스트에 없을 때 URL을 추측하게 됨.
- **해결**:  
  - **한 턴에 도구 1개만 실행**: `response.tool_calls` 중 **첫 번째만** 실제 실행하고, 나머지는 "한 번에 하나의 도구만 실행됩니다" 메시지로 스킵.  
  - **프롬프트**: "반드시 먼저 검색하고, 검색 결과에 나온 URL만 사용하라", "URL을 추측하지 마라" 명시.

### 3.3 검색만 반복하고 fetch_page_links/download_pdf를 호출하지 않음

- **증상**: 70B로 올린 뒤에도 검색만 여러 번 하고 곧바로 "찾을 수 없습니다"로 종료.
- **원인**: (1) 검색 결과 형식이 길어서 LLM이 URL을 잘 못 골라냄. (2) "검색 결과가 있으면 반드시 그 URL로 다음 도구를 호출하라"는 지시가 약함.
- **해결**:  
  - **검색 결과 후처리**: 검색 도구 반환값에서 URL 리스트를 추출해, `[사용 가능한 URL 목록]`으로 정리한 뒤 ToolMessage content에 붙여 LLM에 전달.  
  - **프롬프트**: "검색 결과(results 또는 [사용 가능한 URL 목록])에 url이 하나라도 있으면 **반드시** 그 중 하나의 URL로 fetch_page_links를 호출하라. 검색만 반복하지 마라" 추가.

### 3.4 DuckDuckGo 검색이 잘못된 회사 URL만 반환 (삼성에스디에스 vs 삼성전자)

- **증상**: "삼성에스디에스" 검색 시 samsungsds.com이 아니라 samsung.com, samsungsvc.co.kr 등만 나와, 삼성전자 쪽으로만 진행됨.
- **원인**: DuckDuckGo가 한글/비슷한 이름에서 삼성에스디에스(Samsung SDS)와 삼성전자를 구분하지 못함. 검색 결과에 samsungsds.com이 아예 없음.
- **해결**:  
  - **Tavily 우선 사용**: 프롬프트에 "tavily_search를 우선 사용하라" 명시하고, 도구 목록에서 tavily_search를 맨 앞에 배치.  
  - **검색 쿼리 보강**: "검색 쿼리에는 회사 영문명·공식 도메인 키워드를 넣어라. 예: 삼성에스디에스 → Samsung SDS, samsungsds 포함" 추가.  
  → Tavily + 영문/도메인 키워드로 Samsung SDS 2024 보고서 PDF URL이 상위에 나오고, 해당 PDF 직접 다운로드까지 성공함.

### 3.5 fetch_page_links에 PDF 직링크를 넣었을 때 에러

- **증상**: 검색 결과 첫 URL이 이미 PDF 직링크(`...Samsung%20SDS%20Sustainability%20Report%202024.pdf`)인데, 에이전트가 그 URL로 `fetch_page_links`를 호출해 `invalid literal for int() ...` 같은 파싱 에러 발생.
- **원인**: `fetch_page_links`는 HTML 페이지를 파싱해 `<a href>` 링크를 추출하는 도구인데, PDF 바이너리 응답을 HTML처럼 파싱하려다 실패함.
- **해결**: 에이전트(LLM)가 **이미 .pdf로 끝나는 URL은 fetch_page_links 없이 바로 download_pdf**를 호출하도록 동작함. 프롬프트에는 "검색 결과에서 나온 URL만 사용"만 있고, URL이 PDF 직링크인 경우는 LLM이 download_pdf를 선택하면 됨. (실제 로그에서도 fetch_page_links 실패 후 같은 PDF URL로 download_pdf 호출해 성공.)

### 3.6 anyio / MCP Connection closed

- **참고**: 과거 anyio 3.x와 `create_memory_object_stream[Type]()` 호환 문제, sync 라우터에서 `asyncio.run()` 사용으로 인한 이벤트 루프 충돌 등으로 MCP "Connection closed"가 나온 적 있음.  
- **해결**: anyio·starlette·fastapi 버전 정리, 라우터를 async로 변경하고 `await agent.run_async(...)` 사용, MCP 서버 실행 시 `cwd=ai/tool`, `sys.executable` 사용 등으로 정리됨.

---

## 4. 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GROQ_API_KEY` | 예 | Groq API 키 (Llama 70B) |
| `TAVILY_API_KEY` | 선택 | Tavily 검색 (없으면 duckduckgo_search 사용) |
| `MCP_TOOL_DATA_DIR` | 선택 | PDF 저장 디렉터리 (기본: ai/data_integration/data) |
| `PORT` | 선택 | 서버 포트 (기본 9005) |

---

이 문서는 data_integration 서비스의 설명, 구현 방법, 그리고 구현 과정에서의 원인·해결을 정리한 것입니다.

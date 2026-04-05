# SR 검색·다운로드 에이전트(`SRAgent`) — LLM 컨텍스트·프롬프트 팩

이 파일은 **[서비스·구현 서술 `data_integration.md`](./data_integration.md)** 및 같은 폴더의 **MCP·bytes 관련 메모**를 **대체하지 않습니다.**  
LLM에게 **“웹에서 SR PDF를 찾아 bytes(또는 파일)로 가져오는 에이전트”** 의 역할·도구·주의사항을 압축해 주고, **API 전체·라우터 필드·오케스트레이터 세부**는 **`data_integration.md` 본문**과 **`backend/api/v1/data_integration/sr_agent_router.py`** 등을 같은 대화에 붙여야 합니다.

> **구현 요약**: **`SRAgent`**(`spokes/agents/sr_agent.py`)는 **Groq(ChatGroq) LLM** + LangChain 툴 루프로 **`MCPClient.tool_runtime("web_search")`** 의 `tavily_search`와 **`tool_runtime("sr_tools")`** 의 `download_pdf_bytes`(및 로드 시 포함되는 `fetch_page_links`)를 조합한다. 시스템 프롬프트는 **한 턴에 도구 1개**, 검색 후 PDF 직링크면 **fetch 생략 가능** 등을 유도한다. **본문·인덱스·이미지 파싱·DB 저장**은 이 에이전트 범위 밖이며, 각각 **[`../body/SR_BODY_PARSING_LLM_BRIEF.md`](../body/SR_BODY_PARSING_LLM_BRIEF.md)**, **[`../index/SR_INDEX_PARSING_LLM_BRIEF.md`](../index/SR_INDEX_PARSING_LLM_BRIEF.md)**, **[`../images/SR_IMAGES_PARSING_LLM_BRIEF.md`](../images/SR_IMAGES_PARSING_LLM_BRIEF.md)** 가 담당한다.

---

## LLM에게 줄 때 권장 패키지 (중요)

| 구성 요소 | 파일 | 역할 |
|-----------|------|------|
| **1) 서비스·에이전트 루프·트러블슈팅** | [`data_integration.md`](./data_integration.md) | MCP 기동, 도구 표, `_MCPPassThroughTool`, 검색/다운로드 이슈 §3 |
| **2) MCP 서버 배치·이름** | [`MCP_SERVER_FOLDER_UNIFICATION.md`](./MCP_SERVER_FOLDER_UNIFICATION.md) | `sr_tools_server` ↔ **sr_agent**, 클라이언트 경로 |
| **3) Streamable HTTP** | [`MCP_STREAMABLE_HTTP.md`](./MCP_STREAMABLE_HTTP.md) | stdio vs URL, 지연·운영 |
| **4) bytes·파싱 연계** | [`PDF_PARSING_IN_MEMORY.md`](./PDF_PARSING_IN_MEMORY.md) | 다운로드 bytes → 파서 입력(다음 단계) |
| **5) 이 브리프** | `SR_AGENT_LLM_BRIEF.md` | 경계·용어·**부록 프롬프트** |
| **6) (선택) 소스** | `sr_agent.py`, `mcp_client.py`, `sr_tools_server.py` | 호출 그래프 |

**주의**

- **`data_integration.md`** 는 과거 **`ai/data_integration` + 포트 9005** 등 **레거시 트리**를 포함한다. **통합 Backend**에서는 `backend/api/v1/main.py` 의 **`prefix="/data-integration"`** 아래 **`sr_agent_router`** (`prefix="/sr-agent"`) 를 쓴다 — **정확한 URL·deprecation** 은 OpenAPI·라우터 소스를 본다.  
- 상대 경로만 있으면 LLM은 파일을 열 수 없다. 필요한 절은 **붙여 넣기**.  
- 소스 미첨부 시 **함수명·필드 추측 금지**.

---

## 이 문서를 쓰는 방법 (요약)

| 목적 | 무엇을 붙이나 | 프롬프트 |
|------|----------------|----------|
| **비개발자·온보딩** | 브리프 + `data_integration.md` §1~2 | **부록 A** 또는 **부록 B** |
| **개발자 — MCP·에이전트** | `data_integration.md` §2~3 + MCP 문서 | **부록 C** 또는 **부록 D** |
| **개발자 — API·통합 백엔드** | `sr_agent_router.py` 일부 + 브리프 | **부록 E** 또는 **부록 F** |

---

## 아키텍처·플로우 (개발자용 요약)

### 한 줄 플로우

**HTTP (`/data-integration/sr-agent/...`)** → **`SROrchestrator.execute`** (등) → **`SRAgent.execute`** → **MCP `web_search` + `sr_tools`** → **LLM이 `tavily_search` → `download_pdf_bytes`(또는 중간 `fetch_page_links`)** → **PDF bytes 또는(레거시 경로) 디스크 저장**.

### 레이어별 역할

| 레이어 | 역할 |
|--------|------|
| **FastAPI `sr_agent_router`** | `GET /download`(**deprecated**), `GET /extract` 등 — 응답 스키마·쿼리 파라미터 |
| **`SROrchestrator`** | 에이전트 호출·파싱/DB 옵션 조합(라우트별 상이 — 첨부 소스 확인) |
| **`SRAgent`** | Groq + 툴 루프, 시스템 프롬프트(검색 쿼리 한국어·도메인 가드 등) |
| **`MCPClient`** | `tool_runtime("web_search")`, `tool_runtime("sr_tools")` — stdio / Streamable HTTP / in-process |
| **`sr_tools_server`** | `download_pdf_bytes`, 링크 추출 도구 등 — **인덱스/본문 MCP와 별도** |

### 기술 스택 (요지)

| 영역 | 기술 |
|------|------|
| LLM | **Groq** `ChatGroq`, tool calling |
| 검색 | **Tavily**(`tavily_search`), 폴백 **DuckDuckGo** — `data_integration.md` 표 |
| MCP | **`web_search`**, **`sr_tools`** 서버 이름 — `mcp_client` 설정 |
| PDF | **bytes 모드**(`download_pdf_bytes`) — [`PDF_PARSING_IN_MEMORY.md`](./PDF_PARSING_IN_MEMORY.md) 와 연계 |

### 시퀀스(에이전트 내부 단계 — 개념)

1. MCP에서 도구 로드 (`tavily_search` 우선 순서 권장 — 문서 §2.3).  
2. LLM: 웹 검색 1회 → 결과에서 URL 목록 확보.  
3. LLM: PDF 직링크면 바로 다운로드 도구, HTML 랜딩이면 링크 추출 도구(정책은 프롬프트·구현 준수).  
4. 성공 시 bytes/경로 반환 후 종료.

---

## 한 줄로 (파이프라인 요약)

**회사명·연도만 주면**, 에이전트가 **웹을 검색해 SR/ESG 보고서 PDF를 찾아** **메모리 bytes(또는 예전처럼 파일)** 로 가져온다 — **표 파싱·RAG 테이블 적재는 다음 단계**다.

---

## 비유 (초보자용)

- 에이전트는 **사서관**에게 “이 회사 작년 지속가능보고서 책 좀 찾아줘”라고 부탁하는 손님과 비슷하다.  
- **검색 도구**는 도서관 **검색대**, **다운로드 도구**는 **책을 스캔해 PDF 파일로 받는 창구**다.  
- **본문/목차/그림을 읽어 DB에 정리**하는 일은 **다른 전문가(본문·인덱스·이미지 파이프라인)** 가 한다.

---

## 꼭 알아 둘 용어

| 용어 | 한눈에 보는 뜻 |
|------|----------------|
| **`SRAgent`** | SR PDF **검색·다운로드** 전담 LLM 에이전트 |
| **`web_search` MCP** | `tavily_search`, `duckduckgo_search` |
| **`sr_tools` MCP** | `download_pdf_bytes`, `fetch_page_links` 등 — **sr_tools_server** |
| **`_MCPPassThroughTool`** | LangChain→MCP 인자 유실 방지 — `data_integration.md` §3.1 |
| **`/sr-agent/download`** | 라우터상 **deprecated** — 파일 저장 레거시 경로 안내 가능 |
| **`/sr-agent/extract`** | bytes 기반 추출·옵션 DB 저장 등 — **라우터 docstring·소스** 우선 |

---

## 하지 않는 것 (브리프 범위 밖)

- **인덱스 표 파싱·저장(B안)** → `../index/` 설계·`SR_INDEX_PARSING_LLM_BRIEF.md`.  
- **본문 페이지 파싱** → `../body/`.  
- **이미지 추출·VLM** → `../images/`.  
- **스테이징 CSV 수집** → `../STAGING_INGESTION_IMPROVEMENTS.md` (루트 `docs/`).

---

## 부록 A — 다른 LLM에게 붙이는 지시문 (비개발자 설명)

```text
역할: 첨부 Markdown만 근거로 비개발자에게 "SR 검색 에이전트"를 설명하는 가이드다.

규칙: 추측 금지. 없으면 "문서에 없음". 상대경로 링크는 열 수 없다는 전제.

출력 (한국어, 완전한 문장):
1) 지속가능경영보고서 PDF를 왜 웹에서 찾아야 하는지 2~4문장.
2) 검색 → 다운로드 두 단계 비유 4~6문장.
3) 이 에이전트가 표·본문·그림 DB까지 한다고 말하면 안 되는 이유 — 다른 문서(본문/인덱스/이미지 브리프)로 넘긴다.
4) Tavily·도메인 필터·한국어 쿼리 등 문서에 나온 운영 팁만 언급.
5) 구버전(파일 저장) vs bytes 경로가 문서에 이원화돼 있으면 "확인은 API 문서·코드"라고 안내.

마지막: 더 필요하면 무엇을 붙이면 좋은지(브리프 표) 한 문장.
```

---

## 부록 B — 짧은 한 줄 (비개발자)

```text
첨부 SR_AGENT_LLM_BRIEF + data_integration.md §1~2만 근거로, SRAgent가 웹 검색과 MCP로 PDF를 가져오는 역할을 비개발자에게 한국어로 설명해 줘. 파싱 파이프라인과 혼동하지 말 것. 추측 금지.
```

---

## 부록 C — 다른 LLM에게 붙이는 지시문 (개발자·MCP)

```text
역할: 동료 개발자에게 SRAgent·MCP 연결을 설명하는 시니어다.

입력: 첨부 Markdown(data_integration.md, 이 브리프, 선택 MCP_STREAMABLE_HTTP, MCP_SERVER_FOLDER_UNIFICATION)만 근거.

과제 (한국어):
1) tool_runtime("web_search") vs ("sr_tools") 도구 이름.
2) 한 턴 한 도구·URL 추측 금지 등 운영 이슈(data_integration.md §3).
3) _MCPPassThroughTool 요지(§3.1).
4) sr_tools_server가 sr_index/body 서버와 다른 점(MCP_SERVER_FOLDER_UNIFICATION 표).
5) Streamable HTTP가 stdio 대비 주는 이점(요지만).

출력: 목차 본문 + 확인 불릿 5~8개.
```

---

## 부록 D — 짧은 한 줄 (개발자·MCP)

```text
첨부 data_integration.md §2~3 + SR_AGENT_LLM_BRIEF만 근거로 SRAgent의 MCP 도구 체인과 알려진 장애·해결(§3)을 한국어로 요약해 줘. 추측 금지.
```

---

## 부록 E — 다른 LLM에게 붙이는 지시문 (API·통합 백엔드)

```text
역할: 백엔드 온보딩 문서를 작성한다.

입력: 이 브리프 + (필수) sr_agent_router.py 또는 OpenAPI 일부 + data_integration.md.

과제:
1) 실제 베이스 경로: /data-integration/sr-agent (main.py prefix와 결합).
2) GET /download deprecated, GET /extract 권장 여부를 라우터 주석 근거로만 서술.
3) SRAgent와 SROrchestrator의 관계를 첨부에 있는 만큼만.
4) PDF bytes가 이후 extract-and-save 워크플로와 어떻게 이어질 수 있는지 문서·코드에 있으면 한 단락.

금지: 레포에 없는 포트·경로 창작.

출력: 한국어, 소제목 4개.
```

---

## 부록 F — 짧은 한 줄 (API)

```text
첨부 sr_agent_router.py 상단~download/extract 부분 + SR_AGENT_LLM_BRIEF만 근거로 /data-integration/sr-agent 엔드포인트와 deprecated 여부를 한국어로 정리해 줘. 추측 금지.
```

---

## 파싱 파이프라인 브리프 (같은 패턴·다른 단계)

| 단계 | 브리프 |
|------|--------|
| 본문 | [`../body/SR_BODY_PARSING_LLM_BRIEF.md`](../body/SR_BODY_PARSING_LLM_BRIEF.md) |
| 이미지 | [`../images/SR_IMAGES_PARSING_LLM_BRIEF.md`](../images/SR_IMAGES_PARSING_LLM_BRIEF.md) |
| 인덱스 | [`../index/SR_INDEX_PARSING_LLM_BRIEF.md`](../index/SR_INDEX_PARSING_LLM_BRIEF.md) |

---

## 더 깊게 (사람용 링크)

- [`data_integration.md`](./data_integration.md)  
- [`MCP_SERVER_FOLDER_UNIFICATION.md`](./MCP_SERVER_FOLDER_UNIFICATION.md)  
- [`MCP_STREAMABLE_HTTP.md`](./MCP_STREAMABLE_HTTP.md)  
- [`PDF_PARSING_IN_MEMORY.md`](./PDF_PARSING_IN_MEMORY.md)

---

**작성**: `docs/sr` — SR 검색·다운로드 에이전트 LLM 브리프  
**상태**: 통합 `backend` 배치·라우터 변경 시 §API·경로를 갱신할 것  

# SR 본문(`sr_report_body`) 파싱·저장 — LLM 컨텍스트·프롬프트 팩

이 파일은 **[전체 설계 `SR_BODY_PARSING_DESIGN.md`](./SR_BODY_PARSING_DESIGN.md)** 및 **[퀵스타트 `SR_BODY_PARSING_QUICKSTART.md`](./SR_BODY_PARSING_QUICKSTART.md)** 를 **대체하지 않습니다.**  
LLM에게 **짧은 사실·역할·출력 형식(프롬프트)** 을 주고, **API 필드·파이프라인 단계·DB 제약**은 **반드시 설계·퀵스타트 본문**을 같은 대화에 붙여 넣어야 합니다.

> **구현 요약**: **`SRBodyAgent`는 LLM을 쓰지 않는다.** `get_pdf_metadata` → **`parse_body_pages`**(전 페이지 `1..total_pages`, `body_parser` 폴백 체인) → **`map_body_pages_to_sr_report_body`** → **`save_sr_report_body_batch`** 를 `asyncio.to_thread`로 호출한다. 설계 **§5**는 가설적 LLM 에이전트용 초안이다. 인덱스 파이프라인은 **B안**(에이전트 파싱 → 오케스트레이터 `save_sr_report_index_batch`).

---

## LLM에게 줄 때 권장 패키지 (중요)

| 구성 요소 | 파일 | 역할 |
|-----------|------|------|
| **1) 스펙 본문** | `SR_BODY_PARSING_DESIGN.md` | 플로우·툴·스키마·에이전트·API 근거 |
| **2) 실행 요약** | `SR_BODY_PARSING_QUICKSTART.md` | curl 예시·응답 필드·환경변수·체크리스트 |
| **3) 이 브리프** | `SR_BODY_PARSING_LLM_BRIEF.md` | 용어·레이어·숫자 요약 + **아래 부록 프롬프트** |
| **4) (선택) 소스** | 설계 문서에 인용된 `body_parser.py`, `sr_body_agent.py`, `sr_body_tools_server.py` 일부 | 클래스·함수 단위 설명이 필요할 때만 |

**붙이는 순서 (권장)**

- **비개발자 요약**: 부록 A 또는 B → 브리프 → (선택) 퀵스타트 §개요.
- **개발자 + 스펙만**: 부록 C 또는 D → **설계 전문** (+ 퀵스타트).
- **개발자 + 레이어·스택**: 부록 E 또는 F → 설계 전문 → **이 브리프 「아키텍처·플로우」** (+ 선택 소스).

**주의**

- 상대 경로만 있는 외부 문서는 LLM이 열 수 없다. 필요한 본문은 **같이 붙인다.**
- 소스를 첨부하지 않았으면 **파일명·시그니처 추측 금지**. 스펙·브리프·첨부 코드에 있는 것만 말한다.
- **`body-agentic`** 호출 시 `pdf_bytes_b64`가 없으면 **400**인 점(퀵스타트 명시)을 사용자에게 분명히 전달한다.

---

## 이 문서를 쓰는 방법 (요약)

| 목적 | 무엇을 붙이나 | 프롬프트 |
|------|----------------|----------|
| **비개발자·초보 설명** | 브리프 + (선택) 퀵스타트 | **부록 A** 또는 **부록 B** |
| **개발자 — 설계 심층** | 설계 전문 필수 | **부록 C** 또는 **부록 D** |
| **개발자 — 레이어·MCP·API** | 설계 + 퀵스타트 + 브리프 아키텍처 절 | **부록 E** 또는 **부록 F** |

---

## 아키텍처·플로우 (개발자용 요약)

설계 문서 **§3**과 정합되게 요약한다.

### 한 줄 플로우 (요청 → DB)

**HTTP API** → (워크플로 시 **`SRBodyAgent`**) → **`get_pdf_metadata`** → **`parse_body_pages`**(`body_parser`: Docling → LlamaParse → PyMuPDF) → **`map_body_pages_to_sr_report_body`** → **`save_sr_report_body_batch`** → **PostgreSQL `sr_report_body`**.  
에이전트 내부에는 **LangChain 툴 루프·LLM 호출이 없고**, MCP와 **동일 로직**을 Python에서 직접 호출한다.

### 레이어별 역할

| 레이어 | 역할 | 본문 파이프라인에서 하는 일 |
|--------|------|------------------------------|
| **API 라우터** | HTTP 경계 | `POST .../extract-and-save/body`, `.../body-agentic` 등 — 요청 검증·응답 스키마(퀵스타트 표 참고). |
| **워크플로** | LangGraph `save_body` 노드 | `AgentRouter` → **`sr_body_agent`** (퀵스타트·`sr_workflow`). |
| **에이전트 `SRBodyAgent`** | **결정적 오케스트레이션** | 위 네 함수를 **순서대로** `asyncio.to_thread`로 실행(설계 §3.2). |
| **MCP `sr_body_tools`** | (별도 프로세스/HTTP) | `parse_body_pages_tool` 등 — **에이전트와 동일 파서**를 노출할 뿐, `execute()` 경로는 MCP를 필수로 쓰지 않음. |
| **공유 파서 `body_parser`** | PDF bytes → 페이지 텍스트 | Docling 우선, 폴백 체인(`SR_BODY_SKIP_DOCLING` 등). |
| **저장** | DB INSERT | `save_sr_report_body_batch` — `(report_id, page_number)` 유일성(설계 §2). |
| **ORM / 테이블** | 영속성 | `sr_report_body`: `content_text`, `is_index_page`, `embedding_*` 등. |

### 기술 스택 (구현 관점)

| 영역 | 기술 |
|------|------|
| API | **FastAPI**, **Pydantic** |
| 파싱 | **Docling**, **LlamaParse**, **PyMuPDF**(설계 폴백 순서) |
| 워크플로 | **LangGraph** (`sr_workflow`) — 본문 노드에서 에이전트 호출 |
| MCP | **`sr_body_tools`** — 선택·원격 디버깅·재사용 |
| DB | **PostgreSQL**, **SQLAlchemy**(코드베이스 관례) |

### 시퀀스(개발자용 단계 번호)

1. **`get_pdf_metadata`**: 전체 페이지 수·인덱스 페이지 번호 목록 확보.  
2. **`parse_body_pages`**: PDF(base64 또는 워크플로가 넘긴 bytes)에서 페이지별 문자열 추출.  
3. **`map_body_pages_to_sr_report_body`**: `index_page_numbers`로 `is_index_page` 등 도메인 행 생성.  
4. **`save_sr_report_body_batch`**: 배치 저장, `saved_count`·`errors` 반환.

---

## 한 줄로 (파이프라인 요약)

지속가능경영보고서 PDF에서 **페이지마다 글자를 뽑아** `sr_report_body`에 넣고, 나중에 **인덱스(`sr_report_index`)의 페이지 번호**와 JOIN해 **데이터포인트별 본문 검색·RAG**에 쓴다.

---

## 비유 (초보자용)

- PDF는 **두꺼운 책**, 파서는 **페이지를 한 장씩 스캔해 글만 적어 두는 과정**이다.  
- **인덱스 페이지**는 목차·표가 많은 쪽이라, 글은 저장하되 **`is_index_page`로 표시**해 검색 시 구분할 수 있다(설계 기준).  
- **`SRBodyAgent`**는 LLM 없이 **정해진 네 단계를 한 번에 실행하는 실행기**이고, 실제 글 추출 알고리즘은 **`body_parser`**에 있다.

---

## 꼭 알아 둘 용어

| 용어 | 한눈에 보는 뜻 | 조금 더 설명 |
|------|----------------|--------------|
| **`sr_report_body`** | 보고서 **본문 텍스트가 페이지 단위로 쌓이는 테이블**. | `(report_id, page_number)` 유일. `content_text`가 핵심. |
| **`is_index_page`** | 그 페이지가 **지표 인덱스/목차 표** 쪽이면 참. | RAG에서 본문과 구분할 때 사용(설계 §2). |
| **`body-agentic`** | **에이전트만** 타는 API. | `report_id` + **`pdf_bytes_b64` 필수**(없으면 400). |
| **`extract-and-save/body`** | 회사·연도 등으로 **PDF 확보 + 본문 저장**까지 가는 통합 경로(워크플로). | `pdf_bytes_b64` 없이도 될 수 있음(퀵스타트). |
| **Docling / LlamaParse / PyMuPDF** | 텍스트 추출 **파이프라인 단계**. | 실패 시 다음 단계로 넘어가는 **폴백** 구조(설계). |
| **MCP `sr_body_tools`** | 본문 파싱 툴을 **프로세스 또는 HTTP**로 노출. | `SRBodyAgent.execute()`는 **직접 파서 호출**이 기본; MCP는 동일 로직의 **대체 진입점**. |

---

## 운영·환경변수 (빠른 참고)

| 환경변수 | 요지 |
|----------|------|
| `SR_BODY_SKIP_DOCLING` | `1`이면 Docling 생략(퀵스타트). |
| `SR_BODY_DOCLING_MAX_WORKERS` | Docling 워커 수(기본 2). |
| `SR_BODY_TOC_DEBUG` | 목차·페이지 상단 제목 진단 로그. |

**API·응답 필드 전체**는 퀵스타트 표를 따른다.

---

## 하지 않는 것 (브리프 범위 밖)

- **이미지 바이너리 추출·저장**은 [`SR_IMAGES_PARSING_DESIGN.md`](../images/SR_IMAGES_PARSING_DESIGN.md) 영역.  
- **인덱스 표 파싱**은 [`AGENTIC_INDEX_DESIGN.md`](../index/AGENTIC_INDEX_DESIGN.md) 영역(B안 저장 분리).

---

## 부록 A — 다른 LLM에게 붙이는 지시문 (초보자·비개발자 설명)

**사용법**: 아래 블록을 유저 메시지 **앞**에 두고, 이어서 **이 브리프 + (선택) 퀵스타트 개요** 를 붙인다.

```text
역할: 너는 기술 문서를 바탕으로 비개발자·초보자에게 설명하는 튜터다.

규칙:
- 아래에 이어 붙인 Markdown만 근거로 답한다. 추측·외부 지식으로 내용을 채우지 않는다.
- 문서에 없으면 "문서에 없음"이라고 한다.
- 문서 안의 상대경로 링크는 열 수 없다. 링크를 전제로 한 추론은 하지 않는다.

출력 구조 (한국어, 완전한 문장):
1) 비유(책·페이지 스캔)로 전체를 5~8문장.
2) 메타데이터 → 파싱 → 매핑 → 저장 네 단계를 각 2~4문장 (**LLM 없이 고정 순서**임을 명시).
3) 인덱스 테이블과 본문 테이블이 **페이지 번호로 어떻게 이어지는지** 비전문가용으로 설명.
4) `body-agentic`이 왜 PDF bytes를 요구할 수 있는지, 통합 `body` 경로와 **무엇이 다른지** 문서에 있는 대로만.
5) Docling·LlamaParse·PyMuPDF가 "폴백"이라는 말로 무엇을 뜻하는지 2~4문장.
6) `sr_report_body`에 어떤 종류의 정보가 들어가는지 짧은 목록.
7) 환경변수 이름만 나열하고 기본 의미를 한 줄씩(문서에 있는 것만).

마지막에 한 문장: 빠진 주제가 있으면 질문해 달라고 안내한다.
```

---

## 부록 B — 짧은 한 줄 (초보자)

```text
첨부 Markdown만 근거로, 비개발자에게 SR 본문 파이프라인을 비유·단계·DB·인덱스와의 관계·API 차이 순으로 한국어로 설명해 줘. **SRBodyAgent는 LLM 없이 결정적**이라는 점을 빼먹지 마. 추측 금지.
```

---

## 부록 C — 다른 LLM에게 붙이는 지시문 (개발자용·설계 심층)

**사용법**: 아래 블록을 **시스템 또는 유저 메시지 맨 앞**에 둔 뒤, **반드시 `SR_BODY_PARSING_DESIGN.md` 전체**를 이어서 붙인다. 퀵스타트는 API·curl 검증에 권장. **모순 시 설계 문서가 우선**이다.

```text
역할: 너는 백엔드/데이터 파이프라인을 동료 개발자에게 설명하는 시니어 엔지니어다.

입력: 이어 붙인 Markdown은 저장소 문서 SR_BODY_PARSING_DESIGN.md (및 선택적으로 SR_BODY_PARSING_QUICKSTART.md, 이 브리프)다. 레포 소스는 첨부되지 않았을 수 있다. 첨부 Markdown에만 근거해 답한다. 없는 내용은 추측하지 말고 "문서에 없음"이라고 한다.

과제: 첨부 설계의 구현·운영 로직을 개발자 관점에서 한국어로 설명한다. 다음을 빠짐없이 다룬다(해당 절이 없으면 "문서에 없음").

1) 목적·범위: 본문 vs 인덱스 vs 이미지 경계.
2) 데이터 스키마: sr_report_body 컬럼, 유일성, 인덱스와 JOIN 예시.
3) Phase 1~4 플로우: 툴 이름·입력·출력(설계 §3).
4) SRBodyAgent: **LLM 없음**·결정적 4단계(§3.2). 설계 §5 프롬프트는 **가설적 LLM 경로**임을 구분.
5) MCP·엔드포인트: body-agentic vs 통합 body — pdf_bytes_b64 요구사항 차이(퀵스타트와 설계 §6 정합).
6) 파서 체인: Docling, LlamaParse, PyMuPDF 역할과 환경변수.
7) 오류·진단: 응답 필드 saved_count, errors, db_sr_report_body_row_count(퀵스타트).
8) 체크리스트·미구현 항목이 있으면 문서 원문 그대로 구분해 전달.

출력: 한 단락 요약 후 번호 목차 본문. 마지막에 확인 체크리스트 불릿 5~10개.

코드 경로·함수명은 문서에 명시된 경우에만 인용한다.
```

---

## 부록 D — 짧은 한 줄 (개발자·설계 심층)

```text
첨부한 SR_BODY_PARSING_DESIGN.md 전문만 근거로, 개발자에게 본문 파이프라인을 설계 목차 순으로 세세히 설명해 줘. 툴 체인·스키마·에이전트·API 차이·환경변수를 빠짐없이 다루고 추측하지 마.
```

---

## 부록 E — 플로우·레이어·기술 스택 (개발자 / 제미나이 등)

**사용법**: 아래 블록 → **설계 전문** → **이 브리프 「아키텍처·플로우」~「용어」** → (선택) 관련 `.py` 첨부.

```text
역할: 너는 백엔드 아키텍처를 동료 개발자에게 설명하는 시니어 엔지니어다. 비유·마케팅 톤은 쓰지 말고, 기술 용어와 플로우 중심으로 쓴다.

입력: 첨부 Markdown과 선택 소스만 근거로 한다. 첨부에 없는 파일·클래스·함수는 추측하지 말고 "첨부에 없음"이라고 한다.

과제: 한국어로 다음을 순서대로 설명한다.

1) 엔드투엔드 플로우: HTTP → (LangGraph) → **SRBodyAgent** → **body_parser·매핑·save**(직접 호출) → DB. MCP는 병행 경로.
2) 레이어 다이어그램(텍스트): Router, `sr_workflow`, SRBodyAgent, body_parser, `save_sr_report_body_batch`, ORM; (선택) MCP `sr_body_tools`.
3) 역할 표: **LLM 없음** 명시.
4) 기술 스택 매핑: FastAPI, LangGraph, Docling, LlamaParse, PyMuPDF, MCP(선택), PostgreSQL.
5) API 두 갈래(body vs body-agentic)의 입력 차이와 실패 모드(400 등).
6) 운영: 환경변수 표, 로그 플래그.

금지: 첨부에 없는 구현 세부를 지어내지 말 것.

출력: 소제목 6개 + 마지막에 온보딩 문서 순서(설계 → 퀵스타트) 한 문단.
```

---

## 부록 F — 짧은 한 줄 (플로우·레이어·개발자)

```text
첨부 설계 전문 + 이 브리프의 아키텍처·플로우 절을 근거로, 비유 없이 개발자에게 SR 본문 파이프라인을 설명해 줘. Router→워크플로→**SRBodyAgent(결정적, LLM 없음)**→body_parser→저장→DB, MCP는 선택 경로, API 차이, 스택 표로 정리하고 첨부에 없는 코드는 추측하지 마.
```

---

## 더 깊게 (사람용 링크)

- **전체 설계**: [SR_BODY_PARSING_DESIGN.md](./SR_BODY_PARSING_DESIGN.md)  
- **퀵스타트**: [SR_BODY_PARSING_QUICKSTART.md](./SR_BODY_PARSING_QUICKSTART.md)  
- **삭제·이동 체크리스트**: [SR_BODY_DELETE_MOVE_RENAME_CHECKLIST.md](./SR_BODY_DELETE_MOVE_RENAME_CHECKLIST.md)

# SR 인덱스(`sr_report_index`) 파싱·저장 — LLM 컨텍스트·프롬프트 팩

이 파일은 아래 **스펙 문서들을 대체하지 않습니다.** LLM에게 **B안(에이전트는 파싱·검증·보정만, DB 저장은 오케스트레이터)**, **MCP 툴 단계**, **용어**를 압축해 주고, **툴 시그니처·API JSON·검증 규칙 전부**는 **본문 스펙**을 같은 대화에 붙여야 합니다.

| 스펙 | 파일 | 쓰임 |
|------|------|------|
| **에이전틱 인덱스** | [`AGENTIC_INDEX_DESIGN.md`](./AGENTIC_INDEX_DESIGN.md) | SRIndexAgent, 툴 목록, 프롬프트, 자율 전략(Docling vs LlamaParse) |
| **B안 오케스트레이터** | [`INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md`](./INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md) | 저장 분리·오케스트레이션 관점(문서 목차 기준) |
| **파서 대안** | [`SR_INDEX_PARSER_ALTERNATIVES.md`](./SR_INDEX_PARSER_ALTERNATIVES.md) | Docling/LlamaParse/기타 비교 |
| **파일 정리 계획** | [`SR_INDEX_FILE_REORGANIZATION_PLAN.md`](./SR_INDEX_FILE_REORGANIZATION_PLAN.md) | 코드·문서 배치 리팩터링(운영 설명보다 구조) |

**핵심**: 사용자에게 “인덱스”가 무엇인지 설명할 때는 **`sr_report_index` = 지속가능 공시 데이터포인트(DP) ID와 보고서 페이지 번호의 매핑 표**라는 점을 먼저 밝힌다.

---

## LLM에게 줄 때 권장 패키지 (중요)

| 구성 요소 | 역할 |
|-----------|------|
| **1) `AGENTIC_INDEX_DESIGN.md` 전문** | 에이전트·툴·제약·API — **대부분의 질문의 근거** |
| **2) 이 브리프** | 용어·플로우 요약 + **부록 프롬프트** |
| **3) (선택) `INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md`** | 저장 책임 분리·B안 논의가 질문에 포함될 때 |
| **4) (선택) `SR_INDEX_PARSER_ALTERNATIVES.md`** | “왜 Docling과 LlamaParse를 나누나” 심화 |
| **5) (선택) 소스** | 스펙에 인용된 `sr_index_agent.py`, 툴 모듈 — 호출 그래프 설명용 |

**주의**

- 에이전틱 설계는 **“파싱된 값만 사용, 임의 생성 금지”** 같은 **강한 제약**을 포함한다. 사용자에게 **왜 그런지**를 설명할 때는 **원문 문구**를 왜곡하지 말 것.  
- **툴 호출**: 설계상 **권장**은 한 턴에 하나이나, 구현(`SRIndexAgent`)은 **파싱 턴**에서 Docling/LlamaParse 등 **복수 `tool_call`**을 처리할 수 있다 — `AGENTIC_INDEX_DESIGN.md` 상단 메모·본문을 함께 본다.  
- 상대 경로만 있는 다른 파일은 LLM이 열 수 없다 — 필요한 절은 **붙여 넣기**.

---

## 이 문서를 쓰는 방법 (요약)

| 목적 | 무엇을 붙이나 | 프롬프트 |
|------|----------------|----------|
| **비개발자** | 브리프 + (선택) AGENTIC §1 | **부록 A** 또는 **부록 B** |
| **개발자 — 에이전트·툴** | `AGENTIC_INDEX_DESIGN.md` 전문 | **부록 C** 또는 **부록 D** |
| **개발자 — 아키텍처·저장 분리(B안)** | `AGENTIC_INDEX_DESIGN.md`(상단 구현 메모 포함) + (선택) INDEX_SAVE + 브리프 | **부록 E** 또는 **부록 F** |

---

## 아키텍처·플로우 (개발자용 요약)

`AGENTIC_INDEX_DESIGN.md` 기준.

### 한 줄 플로우

**PDF + `report_id`** → **메타데이터·인덱스 페이지 파악** → **Docling 또는 LlamaParse로 표 파싱** → **검증·이상치 탐지** → (필요 시) **MD 기반 보정** → **행 목록 확정** → **(오케스트레이터가) `save_sr_report_index_batch`로 DB 저장** → 결과 메시지.

### 에이전트가 쓰는 툴 범주 (이름은 스펙 원문과 일치시킬 것)

| 범주 | 예시(스펙 §2.2) |
|------|-----------------|
| 정보 수집 | `get_pdf_metadata_tool`, `inspect_index_pages_tool` (MCP 실제 이름 `_tool` 접미) |
| 파싱 | `parse_index_with_docling_tool`, `parse_index_with_llamaparse_tool` |
| 검증 | `validate_index_rows_tool`, `detect_anomalies_tool` |
| 보정 | `correct_anomalous_rows_with_md_tool` |
| 저장 | **MCP 툴 아님** — `save_sr_report_index_batch` (`sr_save_tools`, 오케스트레이터 호출) |

### API·워크플로 (한 줄)

`POST .../extract-and-save/index`와 `.../index-agentic` 모두 **워크플로의 `save_index` 노드**를 경유한다. 노드 안에서 **`SRIndexAgent`**(MCP `sr_index_tools`)로 행 목록을 만든 뒤, **`save_sr_report_index_batch`**로 DB에 반영한다. 진입 래퍼만 LangGraph 직접 vs `SROrchestrator` 등으로 다를 수 있다(`AGENTIC_INDEX_DESIGN.md` §6).

### 기술 스택 (요지)

| 영역 | 기술 |
|------|------|
| LLM | 기본 **`gpt-5-mini`** (`SRIndexAgent`); 필요 시 모델명 변경 |
| 파싱 | **Docling**(표), **LlamaParse**(복잡 표·MD) |
| API | **FastAPI** — `sr_agent_router.py`: `/extract-and-save/index`, `/extract-and-save/index-agentic` |
| DB | **PostgreSQL** — `sr_report_index` 행 적재 |

---

## 한 줄로 (파이프라인 요약)

보고서 뒤쪽 **GRI/IFRS/ESRS 같은 지표 표**를 읽어 **“어떤 DP가 몇 페이지에 나오는지”** 를 DB에 넣어, 이후 **본문·이미지와 페이지로 조인**해 RAG·검색을 한다.

---

## 비유 (초보자용)

- 인덱스 표는 **책 맨 끝의 “용어·주제 색인”**과 비슷하다. **주제 코드(DP)** 가 **페이지 번호**로 이어진다.  
- **Docling**은 **인쇄된 표를 스캔해 칸을 잘 나누는 도구**, **LlamaParse**는 **복잡한 표**에서 더 공을 들이는 도구에 가깝다(문서 비유 수준).  
- **에이전트**는 “이 페이지는 A도구, 저 페이지는 B도구”를 **스스로 고르는 편집자**다 — 단, **지어낸 숫자는 넣으면 안 된다**는 규칙이 있다.

---

## 꼭 알아 둘 용어

| 용어 | 한눈에 보는 뜻 |
|------|----------------|
| **`sr_report_index`** | DP ID(`dp_id` 등)와 **페이지 번호 목록**, 표/섹션 메타가 쌓이는 테이블(스펙·DB 문서). |
| **`dp_id`** | 공시 지표 식별자 — 정규화 규칙이 파서·검증에 등장(설계 본문). |
| **인덱스 페이지** | 보고서에서 **표가 여러 개 있는 구간** — `index_page_numbers`로 지정(메타데이터 툴). |
| **이상치** | 페이지 범위 초과·빈 배열·비정상 dp 등 — `detect_anomalies` 논리(스펙). |
| **보정** | LlamaParse MD를 이용해 **문서에 실제로 보이는 값만** 고친다 — **할루시네이션 금지**(스펙 강조). |
| **B안 (현재 구현)** | 에이전트는 **`sr_report_index` 행 목록만 반환**; **`_save_index_node`** 등이 **`save_sr_report_index_batch`** 호출 — `AGENTIC_INDEX_DESIGN.md` 상단 메모, `INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md`. |

---

## 운영 숫자 (빠른 참고)

- 에이전트 **최대 반복**(기본 50) — **`AGENTIC_INDEX_DESIGN.md`**·`SRIndexAgent(max_iterations)`.  
- **툴 호출**: 권장은 1턴 1툴, 파싱 턴은 구현상 복수 처리 가능 — 원문 확인.  
- 정확한 **URL·요청 JSON**은 **`AGENTIC_INDEX_DESIGN.md` §6** 및 `sr_agent_router.py`를 붙여서만 인용한다.

---

## 하지 않는 것 (브리프 범위 밖)

- **본문 전체 텍스트 추출** — [`SR_BODY_PARSING_DESIGN.md`](../body/SR_BODY_PARSING_DESIGN.md).  
- **이미지 추출** — [`SR_IMAGES_PARSING_DESIGN.md`](../images/SR_IMAGES_PARSING_DESIGN.md).

---

## 부록 A — 다른 LLM에게 붙이는 지시문 (초보자·비개발자 설명)

```text
역할: 비개발자에게 설명하는 튜터. 첨부 Markdown만 근거. 추측 금지.

출력 (한국어, 완전한 문장):
1) 색인 표 비유로 왜 인덱스가 필요한지 5~8문장.
2) 정보 수집 → 파싱 → 검증 → (필요 시) 보정 → **행 목록 확정** → **오케스트레이터가 DB 저장(`save_sr_report_index_batch`)** 순을 각 2~3문장.
3) Docling vs LlamaParse를 “언제 어떤 표에 쓰나” 수준으로만(셀 구조 나열 금지).
4) “파싱된 값만 쓴다/임의 생성 금지”가 사용자에게 왜 중요한지 윤리·품질 관점에서 짧게.
5) 본문·이미지 파이프라인과 **페이지 번호로 만나는 지점**을 한 단락.

마지막: 더 필요한 주제를 질문하라고 한 문장.
```

---

## 부록 B — 짧은 한 줄 (초보자)

```text
첨부 Markdown만 근거로, 비개발자에게 SR 인덱스(지표→페이지) 파이프라인을 비유와 단계로 한국어 설명해 줘. **DB 저장은 에이전트가 아니라 오케스트레이터**라는 점과 에이전트 규칙(임의 생성 금지)을 빼먹지 마. 추측 금지.
```

---

## 부록 C — 다른 LLM에게 붙이는 지시문 (개발자용·에이전틱 스펙 심층)

**사용법**: 부록 블록 → **`AGENTIC_INDEX_DESIGN.md` 전문** 필수. (선택) `INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md`.

```text
역할: 동료 개발자용 시니어 엔지니어. 첨부 스펙만 근거.

과제 (한국어):
1) 문서 §1·상단 **구현 메모(B안, gpt-5-mini, MCP에 저장 없음)** 요약.
2) 진입점 API·워크플로 `save_index`·`SRIndexAgent`·`save_sr_report_index_batch` 호출 체인(§6).
3) 시스템 프롬프트 요지 — 파싱~보정 단계; **저장은 호출자** 문구 반영.
4) 툴 설계 §3: MCP 노출 툴 vs 저장(`sr_save_tools`) 구분.
5) 검증·이상치·보정 — MD 사용 규칙.
6) 오케스트레이터 쪽 `saved_count`·에이전트 `success`/행 목록(문서·라우터에 있으면).
7) `INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md`를 첨부했으면 B안 논의를 한 절로 보강.

출력: 요약 단락 + 번호 목차 + 체크리스트 5~10개.

코드 경로는 문서에 적힌 경우에만.
```

---

## 부록 D — 짧은 한 줄 (개발자·스펙 심층)

```text
첨부한 AGENTIC_INDEX_DESIGN.md 전문만 근거로 SR 인덱스 파이프라인을 개발자에게 설명해 줘. **MCP 툴(저장 제외)·에이전트·오케스트레이터 `save_sr_report_index_batch`** 순서를 빠짐없이 다루고 추측하지 마.
```

---

## 부록 E — 플로우·레이어 (개발자 / 제미나이 등)

```text
역할: 아키텍처 설명. 비유 최소.

입력: AGENTIC_INDEX_DESIGN.md (+선택 INDEX_SAVE B안).

과제 (한국어):
1) 엔드투엔드: HTTP → (LangGraph/`SROrchestrator`) → **`save_index` 노드** → SRIndexAgent → MCP `sr_index_tools` → **행 반환** → **`save_sr_report_index_batch`** → DB.
2) 텍스트 다이어그램: 라우터, 워크플로, 에이전트, `sr_index_tools_server`, Docling/LlamaParse, `sr_save_tools`, DB.
3) 레이어별 책임 표 — **저장은 에이전트 밖**.
4) LLM vs 결정적 파서 경계.
5) 운영: max iteration, 툴 호출(권장 1개/턴·파싱 예외), 실패 시나리오(문서에 있으면).
6) B안: 오케스트레이터 vs 에이전트 역할 표(브리프 「용어」절과 정합).

마지막: 신규 온보딩 문서 순서(에이전틱 스펙 → 파서 대안 → 파일 정리 계획).
```

---

## 부록 F — 짧은 한 줄 (플로우·레이어)

```text
첨부 AGENTIC 스펙 + 브리프 아키텍처 절을 근거로, 비유 없이 인덱스 파이프라인을 레이어·**저장 분리(B안)**·DB 목표로 설명해 줘. 첨부에 없는 API 필드는 쓰지 마.
```

---

## 더 깊게 (사람용 링크)

- [AGENTIC_INDEX_DESIGN.md](./AGENTIC_INDEX_DESIGN.md)  
- [INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md](./INDEX_SAVE_ORCHESTRATOR_B_DESIGN.md)  
- [SR_INDEX_PARSER_ALTERNATIVES.md](./SR_INDEX_PARSER_ALTERNATIVES.md)  
- [SR_INDEX_FILE_REORGANIZATION_PLAN.md](./SR_INDEX_FILE_REORGANIZATION_PLAN.md)

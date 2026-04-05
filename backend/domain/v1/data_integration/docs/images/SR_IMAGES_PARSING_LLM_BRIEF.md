# SR 이미지(`sr_report_images`) 파싱·저장·VLM — LLM 컨텍스트·프롬프트 팩

이 파일은 **[전체 설계 `SR_IMAGES_PARSING_DESIGN.md`](./SR_IMAGES_PARSING_DESIGN.md)**, **[VLM 보강 `SR_IMAGES_VLM_ENRICHMENT.md`](./SR_IMAGES_VLM_ENRICHMENT.md)**, **[스토리지 모드 `SR_IMAGES_MEMORY_BLOB_OBJECT_STORAGE.md`](./SR_IMAGES_MEMORY_BLOB_OBJECT_STORAGE.md)** 를 **대체하지 않습니다.**  
LLM에게 **역할 분리(결정적 추출·매핑·`save_sr_report_images_batch` vs VLM 보강)** 와 **프롬프트**를 주고, **컬럼·환경변수·API 경로**는 **위 설계 문서 본문**을 같은 대화에 붙여야 합니다.

> **구현 요약**: `SRImagesAgent`는 **LLM 없이** `get_pdf_metadata` → 추출(`extract_report_images` / `extract_report_images_to_memory`) → `map_extracted_images_to_sr_report_rows` → **`save_sr_report_images_batch`** 까지 수행한다. LangGraph **`sr_workflow._save_images_node`** 가 에이전트를 호출한다.

---

## LLM에게 줄 때 권장 패키지 (중요)

| 구성 요소 | 파일 | 역할 |
|-----------|------|------|
| **1) 스펙 본문** | `SR_IMAGES_PARSING_DESIGN.md` | 추출·매핑·저장·MCP·스키마 |
| **2) VLM** | `SR_IMAGES_VLM_ENRICHMENT.md` | `image_type`·캡션·신뢰도·자동 보강 플래그 |
| **3) 스토리지** | `SR_IMAGES_MEMORY_BLOB_OBJECT_STORAGE.md` | disk / memory / S3, BYTEA, `SR_IMAGE_STORAGE` |
| **4) PDF bytes** | [`PDF_PARSING_IN_MEMORY.md`](../PDF_PARSING_IN_MEMORY.md) | 디스크 없이 PDF 다루는 맥락(이미지 경로와 연관) |
| **5) 이 브리프** | `SR_IMAGES_PARSING_LLM_BRIEF.md` | 용어·레이어 + **부록 프롬프트** |
| **6) (선택) 소스** | 설계에 나온 `image_extractor.py`, `sr_images_agent.py`, `sr_images_tools_server.py` | 호출 관계 설명용 |

**주의**

- **핵심 추출 파이프라인은 LLM 없이 결정적**(PyMuPDF xref 등)이라는 점을 사용자에게 혼동 없이 전달한다.  
- **VLM**은 별도 API/배치로 **메타 보강**하는 층이다(`SR_IMAGES_VLM_ENRICHMENT.md`).  
- 상대 경로 링크만 있으면 LLM은 열 수 없다. 필요한 절은 **본문을 붙인다.**

---

## 이 문서를 쓰는 방법 (요약)

| 목적 | 무엇을 붙이나 | 프롬프트 |
|------|----------------|----------|
| **비개발자** | 브리프 + (선택) 설계 §1 | **부록 A** 또는 **부록 B** |
| **개발자 — 스펙 심층** | `SR_IMAGES_PARSING_DESIGN.md` 전문 + (선택) 스토리지/VLM | **부록 C** 또는 **부록 D** |
| **개발자 — 레이어·운영** | 설계 + 스토리지 + VLM + 브리프 아키텍처 | **부록 E** 또는 **부록 F** |

---

## 아키텍처·플로우 (개발자용 요약)

### 한 줄 플로우 (추출 → DB)

**메타데이터** → **PDF에서 임베디드 이미지 추출**(`extract_report_images` 또는 memory/S3 경로) → **`map_extracted_images_to_sr_report_rows`** → **`save_sr_report_images_batch`** → **`sr_report_images`**.

### (선택) VLM 한 줄

DB에 올라간 행을 대상으로 **이미지 바이트**를 읽어 **`image_type` / `caption_text` / `caption_confidence`** 를 채운다 — **추출 파이프라인과 별도**(`SR_IMAGES_VLM_ENRICHMENT.md`).

### 레이어별 역할

| 레이어 | 역할 |
|--------|------|
| **`SRImagesAgent`** | `get_pdf_metadata` → 추출(disk/memory/s3) → 매핑 → **`save_sr_report_images_batch`** (결정적, LLM 없음). |
| **공유 `image_extractor`** | PDF bytes + 페이지 집합 → 파일 또는 메모리/S3 모드. |
| **MCP `sr_images_tools`** | 툴 서버로 동일 기능 노출(원격 시 URL 설정). |
| **저장 툴** | `save_sr_report_images_batch` 등 — `sr_report_images` 스키마 준수. |
| **VLM 서비스** | OpenAI 등 — 캡션·타입 보강, 자동 트리거는 환경변수로 제어(VLM 문서). |

### 기술 스택 (요지)

| 영역 | 기술 |
|------|------|
| 추출 | **PyMuPDF** 기반(설계·코드 주석) |
| 저장 | **PostgreSQL**, JSONB·BYTEA·S3 키 등(스토리지 문서) |
| API | **FastAPI** — `sr_agent_router.py`: `extract-and-save/images`, `images-agentic`, VLM 엔드포인트(설계·VLM 문서) |
| VLM | 비전 LLM — 모델명·키는 VLM 문서·설정 따름 |

---

## 한 줄로 (파이프라인 요약)

보고서 PDF 안에 박혀 있는 **그림·차트 조각을 빼서** DB **`sr_report_images`**에 **페이지·순서·크기** 등 메타와 함께 저장하고, 필요하면 **VLM으로 캡션·유형**을 나중에 채운다.

---

## 비유 (초보자용)

- PDF는 **스티커가 붙어 있는 앨범**이고, 추출기는 **각 페이지에서 스티커(이미지)만 떼 모으는 도구**다.  
- **디스크 / 메모리 / S3**는 떼 낸 스티커를 **어디에 잠깐/오래 두느냐**의 선택이다.  
- **VLM**은 스티커를 보고 **“이건 막대그래프 같아요”**라고 **라벨을 달아 주는 별도 단계**다.

---

## 꼭 알아 둘 용어

| 용어 | 한눈에 보는 뜻 |
|------|----------------|
| **`sr_report_images`** | 보고서별 **페이지·이미지 순서** 단위로 쌓이는 이미지 메타(및 선택적 blob/S3). |
| **`report_id` + `page_number` + `image_index`** | 한 장의 그림을 특정하는 키(설계·DB 문서). |
| **`SR_IMAGE_STORAGE`** | `disk` / `memory` / `s3` — 추출물을 어디에 둘지(스토리지 가이드). |
| **`SR_IMAGE_OUTPUT_DIR`** | 디스크 모드에서 파일을 쓸 폴더(에이전트·API에서 요구될 수 있음, 설계). |
| **인덱스 페이지 이미지** | 목차·네비 캡처 등 **노이즈**가 될 수 있어 **제외 정책**을 검토한다는 설계 논점. |
| **VLM 보강** | `caption_text`, `image_type` 등 **의미 메타** — 추출과 분리. |

---

## 운영·환경변수 (빠른 참고 — 문서 원문 우선)

설계·스토리지·VLM 문서에 다음 유형이 등장한다: **`SR_IMAGE_OUTPUT_DIR`**, **`SR_IMAGE_STORAGE`**, **`SR_IMAGE_MAX_EDGE`**, **`SR_IMAGE_SKIP_INDEX_PAGES`**, **`SR_IMAGE_DEBUG`**, **`SR_IMAGE_PERSIST_BLOB`**, **`SR_IMAGE_VLM_*`**, **`OPENAI_API_KEY`**.  
**정확한 기본값·의미**는 첨부한 설계 Markdown 표를 따른다.

---

## 하지 않는 것 (범위 밖)

- **본문 텍스트 추출 전체**는 [`SR_BODY_PARSING_DESIGN.md`](../body/SR_BODY_PARSING_DESIGN.md).  
- **인덱스 표(DP→페이지)** 는 [`AGENTIC_INDEX_DESIGN.md`](../index/AGENTIC_INDEX_DESIGN.md) (B안: DB 저장은 오케스트레이터).

---

## 부록 A — 다른 LLM에게 붙이는 지시문 (초보자·비개발자 설명)

```text
역할: 너는 기술 문서를 바탕으로 비개발자·초보자에게 설명하는 튜터다.

규칙:
- 아래에 이어 붙인 Markdown만 근거로 답한다. 추측·외부 지식으로 내용을 채우지 않는다.
- 문서에 없으면 "문서에 없음"이라고 한다.

출력 구조 (한국어, 완전한 문장):
1) 비유(앨범·스티커)로 이미지 파이프라인 5~8문장.
2) 추출 → 매핑 → DB 저장을 단계별 2~4문장.
3) "왜 LLM 없이도 추출이 된다"는지와, VLM이 **나중에 무엇을 채우는지** 구분해서 설명.
4) disk/memory/S3가 사용자 입장에서 무엇을 바꾸는지 문서에 있는 만큼만.
5) 인덱스 페이지 이미지를 왜 빼거나 조심하는지 설계 논점 수준으로(셀렉터 나열 금지).
6) RAG 관점: 본문·인덱스와 **같은 report_id·페이지**로 엮일 수 있다는 점(문서에 있으면).

마지막: 더 알고 싶은 주제를 질문하라고 한 문장.
```

---

## 부록 B — 짧은 한 줄 (초보자)

```text
첨부 Markdown만 근거로, 비개발자에게 SR 이미지 파이프라인을 비유·단계·VLM 차이·저장 모드 순으로 한국어로 설명해 줘. 추측 금지.
```

---

## 부록 C — 다른 LLM에게 붙이는 지시문 (개발자용·스펙 심층)

**사용법**: 부록 블록 → **`SR_IMAGES_PARSING_DESIGN.md` 전문** → (선택) 스토리지·VLM 문서. **모순 시 설계가 우선.**

```text
역할: 동료 개발자에게 설명하는 시니어 엔지니어. 첨부 Markdown에만 근거. 없으면 "문서에 없음".

과제 (한국어):
1) 목표: RAG 보강·차트 검색·운영 패턴(설계 §1).
2) 스키마: sr_report_images 컬럼 요지, 유일성·중복 이슈 논의.
3) 아키텍처 Phase: 메타 → 추출 → 매핑 → **`save_sr_report_images_batch`** — 스텁 아님, 문서 상단 구현 표와 정합.
4) MCP sr_images_tools, 환경변수, output_dir 정책.
5) 메모리/BYTEA/S3 문서와 설계의 접점.
6) VLM 문서: 엔드포인트·필드·자동 보강 조건·키.
7) PDF_PARSING_IN_MEMORY와의 관계가 문서에 있으면 한 절로.

출력: 요약 단락 + 번호 목차 + 확인 체크리스트 5~10개.
```

---

## 부록 D — 짧은 한 줄 (개발자·스펙 심층)

```text
첨부한 SR_IMAGES_PARSING_DESIGN.md 전문(+선택 스토리지/VLM)만 근거로 이미지 파이프라인을 개발자에게 세세히 설명해 줘. 추출·매핑·저장·MCP·스키마·운영 변수를 다루고 추측하지 마.
```

---

## 부록 E — 플로우·레이어·기술 스택 (개발자)

```text
역할: 백엔드 아키텍처 설명. 비유 최소화. 첨부에 없는 코드 경로는 추측 금지.

과제 (한국어):
1) 엔드투엔드: API/워크플로 → **SRImagesAgent** → image_extractor → 매핑 → **`save_sr_report_images_batch`** → DB.
2) 텍스트 다이어그램: Router, `sr_workflow._save_images_node`, SRImagesAgent, image_extractor, MCP `sr_images_tools`, storage mode, DB.
3) 결정적 추출 vs VLM 보강 — 데이터가 각각 어디서 오는지.
4) 스택 표: PyMuPDF, FastAPI, PostgreSQL, (문서에 나온) S3/BYTEA, OpenAI VLM.
5) 실패·진단: 로그 플래그, 디렉터리 미설정 시 동작(문서 기준).

마지막: 읽을 문서 순서(설계 → 스토리지 → VLM).
```

---

## 부록 F — 짧은 한 줄 (플로우·레이어)

```text
첨부 설계+브리프 아키텍처 절만 근거로, 비유 없이 이미지 파이프라인을 레이어·스택·추출vsVLM 구분으로 설명해 줘. 첨부에 없는 심볼은 쓰지 마.
```

---

## 더 깊게 (사람용 링크)

- [SR_IMAGES_PARSING_DESIGN.md](./SR_IMAGES_PARSING_DESIGN.md)  
- [SR_IMAGES_VLM_ENRICHMENT.md](./SR_IMAGES_VLM_ENRICHMENT.md)  
- [SR_IMAGES_MEMORY_BLOB_OBJECT_STORAGE.md](./SR_IMAGES_MEMORY_BLOB_OBJECT_STORAGE.md)  
- [PDF_PARSING_IN_MEMORY.md](../PDF_PARSING_IN_MEMORY.md)

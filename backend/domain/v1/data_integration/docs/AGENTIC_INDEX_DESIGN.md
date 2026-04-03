# SR 인덱스 저장 에이전틱 AI 설계

## 1. 개요

현재: 고정된 LangGraph 파이프라인 (Docling → 이상치 검사 → LlamaParse/LLM 보정 → 저장)  
목표: **에이전트가 툴 구조를 파악하고, 인덱스 저장 전략을 스스로 설계·실행**

### 핵심 요구사항
1. PDF bytes만 주면, 에이전트가 인덱스 페이지를 찾고 → 파싱하고 → 검증하고 → 저장까지 자율 수행
2. Docling/LlamaParse 선택, 이상치 재파싱 여부를 에이전트가 판단
3. 파싱된 값만으로 추론 (임의 생성/수정 금지)

---

## 2. 에이전틱 아키텍처

### 2.1 진입점

```
POST /data-integration/sr-agent/extract-and-save/index
  ↓
SRIndexAgent.execute(company, year, report_id) 호출
```

### 2.2 에이전트 구조

**SRIndexAgent** (새로 구현)
- LLM: GPT-4o / Claude-3.5-Sonnet (추론 능력 필요)
- 역할: 인덱스 파싱·저장 전략 수립 및 툴 호출
- 최대 반복: 50회
- 툴 바인딩:
  - **정보 수집**: `get_pdf_metadata`, `inspect_index_pages`
  - **파싱**: `parse_index_with_docling`, `parse_index_with_llamaparse`
  - **검증**: `validate_index_rows`, `detect_anomalies`
  - **보정**: `correct_anomalous_rows_with_md`
  - **저장**: `save_index_batch`

### 2.3 에이전트 시스템 프롬프트

```
당신은 SR 보고서 인덱스를 파싱하고 DB에 저장하는 전문 에이전트입니다.

## 목표
주어진 PDF의 인덱스 페이지(GRI/IFRS/ESRS/SASB 매핑표)를 파싱하고 
sr_report_index 테이블에 저장합니다.

## 전략 수립 (자율 판단)

### 1단계: 정보 수집
- get_pdf_metadata(report_id) → total_pages, index_page_numbers 확인
- inspect_index_pages(pdf_bytes, index_page_numbers) → 페이지당 표 개수/복잡도 파악

### 2단계: 파싱 전략 결정
**판단 기준**:
- 표가 단순하고 정형화 → parse_index_with_docling (빠름, LLM 비용 없음)
- 표가 복잡하거나 병합 셀 많음 → parse_index_with_llamaparse (느림, 비용 있지만 정확)
- 혼용 가능: 일부는 Docling, 나머지는 LlamaParse

**선택 예시**:
```
페이지 138-140: 5컬럼 정형 표 → Docling
페이지 141-143: 병합 셀 많음 → LlamaParse
```

### 3단계: 파싱 실행
- 각 전략별로 툴 호출
- 반환값: [{ dp_id, page_numbers, dp_name, section_title, ... }, ...]

### 4단계: 검증
- validate_index_rows(rows) → 스키마 검증 (dp_id 필수, page_numbers 배열 등)
- detect_anomalies(rows, total_pages) → 이상치 탐지
  - dp_id 비어있음/과도하게 긴 경우
  - page_numbers가 total_pages 초과
  - page_numbers 빈 배열

### 5단계: 보정 (이상치 있을 때만)
- 이상 행의 index_page_number를 모아 pages_to_reparse 생성
- parse_index_with_llamaparse(pdf_bytes, pages_to_reparse) → MD 추출
- correct_anomalous_rows_with_md(anomalous_rows, page_markdown)
  - **규칙**: 마크다운에 실제로 나온 값만 사용, 임의 생성 금지
  - 보정 불가 시 해당 필드는 null 유지

### 6단계: 저장
- save_index_batch(report_id, indices=[...]) → 한 번에 배치 저장
- 저장 후 saved_count 확인

### 7단계: 보고
"인덱스 {saved_count}건 저장 완료" 메시지 반환

## 제약
- 한 번에 하나의 툴만 호출
- 파싱된 값만으로 추론 (임의 생성/수정 금지)
- 최대 50회 툴 호출
```

---

## 3. 툴 설계

### 3.1 정보 수집 툴

#### `get_pdf_metadata(report_id: str) -> dict`
```python
"""
DB에서 report 메타데이터 조회

Returns:
  {
    "total_pages": int,
    "index_page_numbers": [138, 139, ...],
    "report_name": str,
    "report_year": int
  }
"""
```

#### `inspect_index_pages(pdf_bytes_b64: str, index_page_numbers: list) -> list`
```python
"""
인덱스 페이지들의 복잡도 파악 (Docling 가능 여부 판단용)

Returns:
  [
    {
      "page": 138,
      "table_count": 2,
      "complexity": "simple",  # simple | medium | complex
      "has_merged_cells": false,
      "column_count": 5,
      "row_count": 31
    },
    ...
  ]
"""
```

### 3.2 파싱 툴

#### `parse_index_with_docling(pdf_bytes_b64: str, report_id: str, pages: list) -> dict`
```python
"""
Docling으로 지정 페이지 파싱

Returns:
  {
    "sr_report_index": [
      {
        "dp_id": "GRI-2-1",
        "page_numbers": [10, 11],
        "dp_name": "조직 세부 정보",
        "section_title": "일반 공시",
        "index_page_number": 138,
        ...
      },
      ...
    ],
    "parsing_method": "docling"
  }
"""
```

#### `parse_index_with_llamaparse(pdf_bytes_b64: str, pages: list) -> dict`
```python
"""
LlamaParse로 지정 페이지 파싱 (마크다운 반환)

Returns:
  {
    "page_markdown": {
      138: "# GRI Index\\n\\n| Disclosure | Page |\\n|---|---|\\n| GRI 2-1 | 10-11 |\\n...",
      139: "...",
      ...
    }
  }
"""
```

### 3.3 검증 툴

#### `validate_index_rows(rows: list) -> dict`
```python
"""
스키마 검증

Returns:
  {
    "valid": true/false,
    "errors": [
      {"row_index": 0, "field": "dp_id", "error": "required field missing"},
      ...
    ]
  }
"""
```

#### `detect_anomalies(rows: list, total_pages: int) -> list`
```python
"""
이상치 탐지

Returns:
  [
    {
      "row_index": 5,
      "row": {...},
      "anomalous_columns": ["dp_id", "page_numbers"],
      "index_page_number": 138
    },
    ...
  ]
"""
```

### 3.4 보정 툴

#### `correct_anomalous_rows_with_md(anomalous_items: list, page_markdown: dict, report_id: str) -> list`
```python
"""
마크다운 기반 이상치 보정 (LLM 호출, 파싱된 값만 사용)

Args:
  anomalous_items: detect_anomalies 반환값
  page_markdown: { page_num: markdown_text, ... }

Returns:
  [
    {
      "row_index": 5,
      "corrections": {
        "dp_id": "GRI-2-1",
        "page_numbers": [10, 11]
      }
    },
    ...
  ]
"""
```

### 3.5 저장 툴

#### `save_index_batch(report_id: str, indices: list) -> dict`
```python
"""
배치 저장

Returns:
  {
    "success": true,
    "saved_count": 120,
    "errors": []
  }
"""
```

---

## 4. 실행 흐름 예시

### Case 1: 정형 표만 있는 경우

```
[에이전트]
1. get_pdf_metadata("abc-123") 
   → total_pages=150, index_page_numbers=[138,139,140]

2. inspect_index_pages(pdf_bytes, [138,139,140])
   → 모두 complexity="simple", has_merged_cells=false

3. 판단: "정형 표 → Docling 사용"

4. parse_index_with_docling(pdf_bytes, "abc-123", [138,139,140])
   → sr_report_index=[...] 120건

5. validate_index_rows(sr_report_index)
   → valid=true

6. detect_anomalies(sr_report_index, 150)
   → [] (이상 없음)

7. save_index_batch("abc-123", sr_report_index)
   → saved_count=120

8. "인덱스 120건 저장 완료"
```

### Case 2: 복잡한 표 + 이상치 발생

```
[에이전트]
1. get_pdf_metadata("xyz-456")
   → total_pages=200, index_page_numbers=[141,142,143]

2. inspect_index_pages(pdf_bytes, [141,142,143])
   → 페이지 141: complexity="complex", has_merged_cells=true
   → 페이지 142-143: complexity="simple"

3. 판단: "141은 LlamaParse, 142-143은 Docling"

4. parse_index_with_docling(pdf_bytes, "xyz-456", [142,143])
   → sr_report_index=[...] 80건

5. parse_index_with_llamaparse(pdf_bytes, [141])
   → page_markdown={141: "..."}

6. [141번 마크다운을 보고 LLM이 추출] (에이전트가 직접 해석 또는 별도 툴)
   → 추가 40건

7. 전체 120건 병합

8. validate_index_rows(전체)
   → valid=true

9. detect_anomalies(전체, 200)
   → anomalous_items=[{row_index:5, columns:["page_numbers"], page:141}, ...]

10. 판단: "이상치 있음 → 보정 필요"

11. parse_index_with_llamaparse(pdf_bytes, [141]) (이미 있으면 재사용)

12. correct_anomalous_rows_with_md(anomalous_items, {141:"..."}, "xyz-456")
    → corrections=[...]

13. 보정 반영 (merge_corrected_index_rows)

14. save_index_batch("xyz-456", 보정된_indices)
    → saved_count=120

15. "인덱스 120건 저장 완료 (3건 보정)"
```

---

## 5. 기술 스택

### 5.1 에이전트 프레임워크
- **LangChain + ReAct 패턴**
  - `ChatOpenAI(...).bind_tools(tools)`
  - 메시지 루프: System → User → AI(tool_calls) → Tool Results → AI → ...
  - 최대 50 iterations

### 5.2 상태 관리
```python
class IndexAgentState(TypedDict):
    report_id: str
    pdf_bytes: bytes
    total_pages: Optional[int]
    index_page_numbers: Optional[List[int]]
    
    # 중간 결과
    page_complexity: Optional[List[dict]]
    docling_rows: Optional[List[dict]]
    llamaparse_md: Optional[Dict[int, str]]
    
    # 최종 결과
    sr_report_index: Optional[List[dict]]
    saved_count: int
    message: str
```

### 5.3 구현 위치
```
backend/domain/v1/data_integration/
  spokes/agents/
    sr_index_agent.py           # SRIndexAgent 클래스
  hub/
    sr_index_tools.py            # 툴 함수들
  docs/
    AGENTIC_INDEX_DESIGN.md      # 본 문서
```

---

## 6. API 변경

### 6.1 엔드포인트

```python
@sr_agent_router.post("/extract-and-save/index-agentic")
async def extract_and_save_index_agentic(req: ExtractAndSaveIndexRequest):
    """
    에이전틱 인덱스 저장 (에이전트가 전략 수립·실행)
    """
    from backend.domain.v1.data_integration.spokes.agents.sr_index_agent import SRIndexAgent
    
    # 1. 메타데이터 확보 (report_id, pdf_bytes)
    # 2. SRIndexAgent 초기화
    agent = SRIndexAgent(model_name="gpt-4o", max_iterations=50)
    
    # 3. 에이전트 실행
    result = await agent.execute(
        company=req.company,
        year=req.year,
        report_id=req.report_id,
    )
    
    return ExtractAndSaveIndexResponse(
        success=result["success"],
        message=result["message"],
        saved_count=result["saved_count"],
        errors=result.get("errors", []),
    )
```

### 6.2 기존 엔드포인트와 병행

- **기존**: `/extract-and-save/index` → LangGraph 고정 파이프라인 (빠름, 비용 적음)
- **신규**: `/extract-and-save/index-agentic` → 에이전트 자율 결정 (유연, 비용 높음)

---

## 7. 장단점 비교

### 고정 파이프라인 (현재)
**장점**:
- 예측 가능한 성능·비용
- 디버깅 용이
- LLM 호출 최소화 (이상치 보정 시만)

**단점**:
- 항상 Docling 우선 → 복잡한 표에는 비효율
- 새로운 표 형식 대응 시 코드 수정 필요

### 에이전틱 접근 (제안)
**장점**:
- 페이지별 복잡도에 따라 최적 파서 선택
- 새로운 표 형식에 적응력 높음
- 툴 추가만으로 기능 확장 가능

**단점**:
- LLM 추론 비용 증가 (전략 수립·툴 선택)
- 실행 시간 불확실 (최대 50회 반복)
- 에이전트 판단 오류 가능성

---

## 8. 단계별 구현 계획

### Phase 0 (선택): 파싱 툴의 라이브러리 단위 분리
- [ ] `docling_tools`: Docling 전용 (parse_index_with_docling, parse_pdf_to_tables 등)
- [ ] `llamaparse_tools`: LlamaParse 전용 (parse_pages_to_markdown)
- [ ] `pymupdf_tools`: PyMuPDF 전용 (get_metadata, get_page_text, extract_pages_to_pdf, extract_images)
- [ ] `pypdf_tools`: pypdf 폴백 (extract_pages_to_pdf)
- [ ] 기존 sr_report_tools_*.py는 유지, 에이전트는 위 툴만 바인딩하거나 기존 툴 래핑

### Phase 1: 툴 구현
- [x] `get_pdf_metadata` — `backend.domain.shared.tool.sr_index_agent_tools`
- [x] `inspect_index_pages` (Docling 사전 스캔) — `parse_pdf_to_tables` 결과 페이지별 집계
- [x] `parse_index_with_docling` (기존 로직 래핑) — `sr_report_tools_docling.parse_sr_report_index_with_docling` + b64
- [x] `parse_index_with_llamaparse` (기존 로직 래핑) — `parsing.llamaparse.extract_index_pages_as_markdown_from_bytes` + b64
- [x] `validate_index_rows`, `detect_anomalies` — 구현/`sr_llm_review.detect_sr_index_anomalies` 래핑
- [x] `correct_anomalous_rows_with_md` (기존 로직 래핑) — `sr_llm_review.correct_anomalous_index_rows_with_md` 동기 래퍼
- [x] `save_index_batch` (기존 로직 래핑) — `sr_save_tools.save_sr_report_index_batch`

### Phase 2: 에이전트 구현
- [ ] `SRIndexAgent` 클래스
- [ ] 시스템 프롬프트 작성
- [ ] ReAct 루프 구현
- [ ] 상태 관리 (`IndexAgentState`)

### Phase 3: API 통합
- [ ] `/extract-and-save/index-agentic` 엔드포인트
- [ ] 요청/응답 모델
- [ ] 에러 핸들링

### Phase 4: 테스트
- [ ] 정형 표만 있는 PDF
- [ ] 복잡한 표 혼재 PDF
- [ ] 이상치 발생 시나리오
- [ ] 툴 호출 횟수·비용 측정

---

## 9. 제약 및 고려사항

### 9.1 LLM 비용
- GPT-4o 50회 호출 시 비용 추정: 페이지당 ~$0.05-0.10
- 배치 처리 시 비용 최적화 필요

### 9.2 실행 시간
- Docling: 페이지당 ~2초
- LlamaParse: 페이지당 ~10초
- LLM 추론: 호출당 ~2-5초
- 총 예상: 1-3분 (인덱스 페이지 5개 기준)

### 9.3 오류 처리
- 에이전트가 50회 내에 저장 못하면?
  - 부분 저장 + "미완료" 메시지 반환
  - 재시도 API 제공
- 툴 호출 실패 시?
  - 에이전트에 에러 메시지 전달 → 대안 전략 시도

### 9.4 보안
- pdf_bytes를 base64로 LLM에 전달하지 않음 (파일 시스템 경로만)
- 민감 정보 필터링 (company_id 등)

---

## 10. 파싱 툴의 라이브러리 단위 분리 및 순수 파싱/매핑 분리

에이전트가 **임무에 맞춰 어떤 파서를 쓸지 선택**하려면, 툴을 **도메인(메타/인덱스/본문/이미지)** 이 아니라 **파싱 라이브러리(Docling, LlamaParse, PyMuPDF, pypdf)** 단위로 나누고, **파싱(raw 반환)** 과 **도메인 매핑(sr_report_index 등)** 을 분리하는 구성이 적용되어 있다.

### 10.1 순수 파싱 툴 (같은 시그니처·raw만 반환)

`backend/domain/shared/tool/parsing` 에서 제공. **항상 동일한 형태만 반환**하며, `report_id`·`sr_report_index` 등 도메인 필드는 포함하지 않는다.

| 툴 | 시그니처 | 반환 형태 |
|----|----------|-----------|
| **parse_pdf_to_tables** | `(pdf_path_or_bytes, pages)` | `{"tables": [{"page", "header", "rows"}, ...], "table_count": N}` 또는 에러 시 `{"error", "docling_failed", "fallback_pages", "table_count": 0}` |
| **parse_pages_to_markdown** | `(pdf_path, pages)` | `{ page_num: markdown_str, ... }` (페이지별 raw 마크다운) |
| **parse_pages_to_markdown_from_bytes** | `(pdf_bytes, pages)` | 위와 동일 |
| **extract_pages_to_pdf** | `(pdf_path_or_bytes, pages)` | 임시 PDF 파일 경로 (`Path`) |

- 다른 임무(메타/본문/이미지)도 같은 파싱 툴을 다른 후속 툴·프롬프트와 조합해 사용할 수 있다.
- LLM/에이전트는 툴 코드를 **수정하지 않고**, **어떤 툴을 어떤 순서·목적으로 쓸지**만 결정한다.

### 10.2 매핑 툴 (raw → 도메인 구조)

`backend/domain/shared/tool/mapping` 에서 제공. 파싱 결과를 DB 스키마(sr_report_index 등) 형태로 변환한다.

| 툴 | 시그니처 | 설명 |
|----|----------|------|
| **map_tables_to_sr_report_index** | `(tables, report_id)` | `parse_pdf_to_tables` 의 `tables` 를 sr_report_index 행 리스트로 변환 (헤더 키워드 매칭, index_type/dp_id 규칙 적용) |

- 마크다운 → sr_report_index 변환은 별도 툴 또는 LLM 단계로 수행 가능 (에이전트가 `parse_pages_to_markdown` 결과를 보정 툴/프롬프트에 넘기는 방식).

### 10.3 에이전트 역할: 툴 선택·조합

- 에이전트는 **툴을 수정하지 않고**, **선택·순서·목적**만 정한다.
- 필요 시 **파싱 툴 → 매핑 툴(또는 LLM) → 저장 툴** 순으로 조합한다.

**인덱스 저장 흐름 예시**

1. `parse_pdf_to_tables(pdf_path_or_bytes, pages)` → raw 표 획득  
2. `map_tables_to_sr_report_index(tables, report_id)` → sr_report_index 행 리스트  
3. (선택) `validate_index_rows` / `detect_anomalies` / 보정 툴  
4. `save_index_batch(report_id, indices)` → DB 저장  

Docling 실패 시 에이전트가 `extract_pages_to_pdf` + `parse_pages_to_markdown`(LlamaParse) 조합 후, LLM 또는 보정 툴로 구조화하는 전략을 선택할 수 있다.

### 10.4 구현 구조 (현재)

| 모듈 | 역할 |
|------|------|
| **parsing/** | common, pdf_pages, docling(`parse_pdf_to_tables`), llamaparse(`parse_pages_to_markdown*`) — 순수 파싱만 |
| **mapping/** | `map_tables_to_sr_report_index` — 표 → sr_report_index |
| **sr_report_tools_docling.py** | 하위 호환 facade: `parse_sr_report_index_with_docling` = `parse_pdf_to_tables` + `map_tables_to_sr_report_index` |
| **sr_save_tools** | `save_index_batch` 등 DB 저장 |

공통 유틸(`_open_pdf` 등)은 `parsing.common` / `sr_report_tools_common`에 두고, Docling/LlamaParse 툴은 필요 시 `extract_pages_to_pdf`를 내부에서 사용한다.

---

## 11. 결론

**에이전틱 접근의 핵심**:
1. 에이전트가 **페이지 복잡도를 판단**하고
2. **최적 파서(Docling/LlamaParse)를 선택**하고
3. **검증·보정·저장 순서를 스스로 결정**

**파싱된 값만 사용** 원칙:
- 모든 보정 툴 프롬프트에 "마크다운에 실제로 나온 값만 사용" 명시
- 임의 생성 시 에이전트가 "보정 불가" 판단하도록 유도

**구현 우선순위**:
1. 툴 구현 (기존 로직 재사용)
2. 에이전트 프롬프트·루프
3. 테스트 및 비용 최적화

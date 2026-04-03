# SR 보고서 인덱스 파싱 현재 이슈 정리

SR 보고서 PDF에서 인덱스 표를 추출하는 파이프라인(Docling + LlamaParse 폴백)에서 발생하는 알려진 문제와 제한 사항을 정리한 문서입니다.

---

## 1. MuPDF 스택 오버플로우 (페이지 추출 실패) — **현재 최대 장애**

### 현상
- **대상**: 삼성 SDS 지속가능경영보고서 2025, 인덱스 페이지 146–153
- **에러**: `MuPDF error: exception stack overflow!` / `limit error: exception stack overflow!`
- **결과**: `_extract_pages_to_pdf()`가 모든 페이지에서 실패 → LlamaParse 폴백이 동작하지 않음 → `sr_report_index` 0건

### 원인
- **페이지 추출**은 `backend/domain/shared/tool/sr_report_tools_docling.py`의 `_extract_pages_to_pdf()`에서 **PyMuPDF(fitz)**로 수행됨.
- 해당 PDF의 146–153페이지 영역에서 fitz 내부(MuPDF)가 **스택 오버플로우(code=5)**를 발생시킴.
- PDF 내부 구조(순환 참조, 깊은 중첩, 손상된 객체 등)로 인한 것으로 추정.

### 영향
- **페이지별 LlamaParse** 방식은 **페이지마다 1장짜리 임시 PDF**가 필요함.
- 추출이 전부 실패하면 LlamaParse에 넘길 파일이 없어 **폴백 전체가 무력화**됨.
- Docling이 인코딩 등으로 실패해 `docling_failed_pages`에 146–153이 들어가도, LlamaParse 단계에서 동일한 추출 실패로 0건 반환.

### 해결 방향
- **옵션 A**: 페이지 추출 실패 시 **원본 PDF 전체**를 LlamaParse에 넘기고, 응답에서 페이지 범위(146–153)만 필터링. (LlamaParse API가 페이지 범위/메타 지원하는지 확인 필요.)
- **옵션 B**: `_extract_pages_to_pdf()`에 **대체 라이브러리 폴백** 추가 (예: pypdf/pdfplumber로 페이지 추출). MuPDF 실패 시에만 사용.
- **옵션 C**: 외부 도구(pdftk, qpdf 등)로 문제 페이지만 추출한 PDF를 미리 만들어 두고, 그 파일을 LlamaParse에 전달.

---

## 2. LlamaParse 폴백이 페이지 추출에만 의존

### 현상
- 페이지별 파싱 시, **각 페이지에 대해** `_extract_pages_to_pdf(pdf_path, [page_num])`로 1페이지 PDF 생성 후 LlamaParse 호출.
- 위 1번처럼 **모든 페이지에서 추출이 실패하면** “페이지 N 추출 실패, 스킵”만 반복되고, **전체 PDF를 LlamaParse에 넘기는 경로는 없음**.

### 해결 방향
- `_extract_pages_to_pdf()`가 실패한 경우(특히 `pages_to_parse` 전체가 실패한 경우) **원본 PDF 전체**를 LlamaParse에 넘기는 fallback 분기 추가.
- 이때 반환된 마크다운에서 **어느 페이지에 해당하는지** 구분이 어려우면, `index_page_number`는 `min(pages_to_parse)` 등으로 두거나, LlamaParse 메타데이터로 페이지 정보가 오는지 확인 후 반영.

---

## 3. Docling 변환 실패 (UTF-8 인코딩 등)

### 현상
- 2025 보고서 같은 일부 PDF에서 Docling `converter.convert()` 중 **`'utf-8' codec can't decode byte ...`** 등 인코딩 예외 발생.
- Docling 내부에서 PyMuPDF/다른 엔진 사용 시 비 UTF-8 바이트로 인한 오류로 추정.

### 현재 대응
- `docling_failed_pages`에 실패한 페이지를 넣고, 해당 페이지들을 **LlamaParse 폴백 대상**에 포함시킴.
- 따라서 **페이지 추출(1번)이 성공하는 PDF**에서는 Docling 실패 구간이 LlamaParse로 보완됨.

### 남은 이슈
- **동일 PDF에서 1번(MuPDF 스택 오버플로우)까지 발생**하면, Docling 실패 페이지를 LlamaParse에 넘기려 해도 페이지 추출 실패로 폴백이 0건이 됨.

---

## 4. 마크다운 표 파싱 제한 (LlamaParse 결과)

### 현상
- LlamaParse 결과 마크다운에서 표를 읽는 쪽은 `_parse_markdown_tables()`.
- **파이프(`|`) 구분 표만** 인식함.  
  `| Col1 | Col2 |` 형태가 아니면 표로 인식되지 않음.

### 영향
- LlamaParse가 표를 다른 형식(예: 들여쓰기, HTML, 일반 텍스트 테이블)으로 내보내면 **해당 표는 누락**됨.
- 인덱스 페이지가 여러 표 형식으로 되어 있으면 **일부만 추출**될 수 있음(예: 8페이지에서 46건만 나오는 등).

### 해결 방향
- LlamaParse 출력 샘플을 저장해 두고, 실제로 어떤 표 형식이 나오는지 확인.
- 필요 시 **다른 형식(HTML 테이블, 들여쓰기 등)**을 처리하는 파서 추가 또는 정규식 보완.

---

## 5. 기타 참고 사항

### 이미 보완된 항목 (참고)
- **dp_id**: IFRS S2 한글 표(문단 숫자만) → `S2-{숫자}`, GRI 패턴은 구분자 필수로 조정해 단일 숫자 오인식 방지.
- **index_type**: ESRS/IFRS 등 접두사별로 `esrs` / `ifrs` 구분.
- **Docling 실패 시**: `ConversionStatus.FAILURE` 및 예외 처리 후 `docling_failed_pages` → LlamaParse 폴백 연동.
- **페이지별 LlamaParse**: 각 페이지를 개별 호출해 `index_page_number`에 실제 페이지 번호 반영 (단, 1번 이슈로 현재 해당 PDF에서는 추출 자체가 안 됨).

### 관련 파일
- `backend/domain/shared/tool/sr_report_tools_docling.py`  
  - `parse_sr_report_index_with_docling`, `_extract_pages_to_pdf`, `_llamaparse_fallback`, `_parse_markdown_tables`
- `backend/domain/shared/tool/sr_report_tools_common.py`  
  - `_open_pdf` (PyMuPDF 사용)

---

*문서 작성일: 2026-03 기준. 파이프라인 변경 시 이 문서를 갱신하는 것을 권장합니다.*

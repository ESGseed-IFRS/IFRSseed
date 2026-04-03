# SR 파싱 라이브러리 (parsing)

AGENTIC_INDEX_DESIGN 기준으로 인덱스·PDF 파싱 로직을 라이브러리 단위로 분리한 패키지입니다.

## 구조

| 모듈 | 역할 |
|------|------|
| **common** | PyMuPDF 가용성, `open_pdf`, stderr 억제 (`_suppress_mupdf_stderr` / `_restore_stderr`) |
| **pdf_pages** | 지정 페이지만 임시 PDF로 추출 (`extract_pages_to_pdf`) — PyMuPDF 우선, pypdf 폴백 |
| **docling** | Docling 표 파싱 **raw만** (`parse_pdf_to_tables` → `{ tables, table_count }`) |
| **llamaparse** | LlamaParse 페이지별 마크다운 (`parse_pages_to_markdown` / `parse_pages_to_markdown_from_bytes`, 별칭 `extract_index_pages_as_markdown*`) |

도메인 매핑(표 → sr_report_index)은 `backend.domain.shared.tool.mapping` 에서 제공. `parse_sr_report_index_with_docling` 은 `sr_report_tools_docling` 에서 파싱+매핑 조합으로 제공.

## 사용

- **기존 툴 경로**: `sr_report_tools_common`, `sr_report_tools_docling` 은 이 패키지·매핑을 재내보내므로 기존 import 경로 유지.
- **순수 파싱만**: `from backend.domain.shared.tool.parsing import parse_pdf_to_tables, parse_pages_to_markdown_from_bytes, open_pdf, extract_pages_to_pdf` 등.

## 의존 관계

- `pdf_pages` → `common`
- `docling` → `common`
- `llamaparse` → `pdf_pages`

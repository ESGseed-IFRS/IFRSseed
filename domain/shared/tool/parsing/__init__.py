"""SR 보고서 파싱 라이브러리 (순수 파싱만).

AGENTIC_INDEX_DESIGN: 파싱은 raw만 반환. 도메인 매핑(sr_report_index 등)은 mapping/에이전트 툴.
- common: PDF 열기, PyMuPDF 가용성, stderr 억제
- pdf_pages: 지정 페이지만 임시 PDF로 추출 (PyMuPDF / pypdf)
- docling: parse_pdf_to_tables → raw 표만
- llamaparse: parse_pages_to_markdown / parse_pages_to_markdown_from_bytes → 페이지별 MD
- body_parser: parse_body_pages → Docling→LlamaParse→PyMuPDF 폴백
- image_extractor: extract_report_images → PyMuPDF 임베디드 이미지 파일 추출 (sr_report_images)
- pymupdf: parse_body_pages (저수준, body_parser가 내부 사용)
"""
from __future__ import annotations

from .common import (
    PYMUPDF_AVAILABLE,
    _open_pdf,
    _restore_stderr,
    _suppress_mupdf_stderr,
    open_pdf,
)
from .docling import DOCLING_AVAILABLE, parse_pdf_to_tables
from .llamaparse import (
    extract_index_pages_as_markdown,
    extract_index_pages_as_markdown_from_bytes,
    parse_pages_to_markdown,
    parse_pages_to_markdown_from_bytes,
)
from .pdf_pages import extract_pages_to_pdf
from .pdf_metadata import PDFParser, parse_sr_report_metadata
from .body_parser import parse_body_pages
from .image_extractor import extract_report_images
from .pymupdf import parse_body_pages as parse_body_pages_pymupdf

__all__ = [
    # common
    "PYMUPDF_AVAILABLE",
    "open_pdf",
    "_open_pdf",
    "_suppress_mupdf_stderr",
    "_restore_stderr",
    # pdf_pages
    "extract_pages_to_pdf",
    # docling (순수 파싱)
    "DOCLING_AVAILABLE",
    "parse_pdf_to_tables",
    # llamaparse
    "extract_index_pages_as_markdown",
    "extract_index_pages_as_markdown_from_bytes",
    "parse_pages_to_markdown",
    "parse_pages_to_markdown_from_bytes",
    # 메타 (parsing 레이어)
    "PDFParser",
    "parse_sr_report_metadata",
    # 본문 (통합 폴백)
    "parse_body_pages",
    "parse_body_pages_pymupdf",
    # 이미지 (임베디드 추출)
    "extract_report_images",
]

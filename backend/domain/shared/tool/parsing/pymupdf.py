"""PyMuPDF 기반 PDF 본문 텍스트 추출 (순수 파싱).

페이지별 get_text()만 수행. 도메인 매핑은 shared/tool/mapping/sr_body_mapping, 에이전트 바인딩은 spokes/infra에서 처리.
"""
from __future__ import annotations

import base64
from typing import Dict, List

from loguru import logger

from .common import PYMUPDF_AVAILABLE, open_pdf


def parse_body_pages(
    pdf_bytes_b64: str,
    pages: List[int],
) -> Dict[str, object]:
    """
    PDF bytes(base64)에서 지정 페이지의 본문 텍스트를 PyMuPDF로 추출합니다.

    Args:
        pdf_bytes_b64: PDF 바이너리 base64 문자열
        pages: 파싱할 페이지 번호 목록 (1-based)

    Returns:
        {
            "body_by_page": { page_number: content_text, ... },
            "parsing_method": "pymupdf",
            "error": optional 에러 메시지
        }
    """
    if not PYMUPDF_AVAILABLE:
        return {"body_by_page": {}, "parsing_method": "pymupdf", "error": "PyMuPDF가 설치되지 않았습니다."}
    if not pages:
        return {"body_by_page": {}, "parsing_method": "pymupdf"}

    try:
        raw = base64.b64decode(pdf_bytes_b64)
        doc = open_pdf(raw)
        body_by_page: Dict[int, str] = {}
        try:
            for page_no in pages:
                if page_no < 1 or page_no > len(doc):
                    continue
                page = doc[page_no - 1]
                text = page.get_text() or ""
                body_by_page[page_no] = text
        finally:
            doc.close()

        logger.info("[pymupdf] parse_body_pages %s페이지 추출 완료", len(body_by_page))
        return {"body_by_page": body_by_page, "parsing_method": "pymupdf"}
    except Exception as e:
        logger.error("[pymupdf] parse_body_pages 오류: %s", e)
        return {"body_by_page": {}, "parsing_method": "pymupdf", "error": str(e)}

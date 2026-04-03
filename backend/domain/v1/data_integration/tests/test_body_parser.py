"""body_parser: Docling→LlamaParse→PyMuPDF 폴백 단위 테스트."""
from __future__ import annotations

import base64
import os
from unittest.mock import patch

import pytest

from backend.domain.shared.tool.parsing.body_parser import parse_body_pages
from backend.domain.shared.tool.parsing.common import PYMUPDF_AVAILABLE


@pytest.fixture
def one_page_pdf_b64() -> str:
    """PyMuPDF로 1페이지 PDF 생성."""
    if not PYMUPDF_AVAILABLE:
        pytest.skip("PyMuPDF 미설치")
    import fitz

    doc = fitz.open()
    doc.new_page()
    doc[0].insert_text((72, 72), "SR body test")
    raw = doc.tobytes()
    doc.close()
    return base64.b64encode(raw).decode("utf-8")


def test_parse_body_pages_invalid_base64() -> None:
    out = parse_body_pages("@@@not-base64@@@", [1])
    assert "error" in out
    assert out.get("body_by_page") == {}


def test_parse_body_pages_empty_pages() -> None:
    out = parse_body_pages(base64.b64encode(b"x").decode(), [])
    assert out.get("body_by_page") == {}


@pytest.mark.skipif(not PYMUPDF_AVAILABLE, reason="PyMuPDF 필요")
def test_parse_body_pages_pymupdf_via_skip_docling(one_page_pdf_b64: str) -> None:
    """Docling/LlamaParse 생략·실패 시 PyMuPDF로 본문 확보."""
    with patch.dict(
        os.environ,
        {"SR_BODY_SKIP_DOCLING": "1"},
        clear=False,
    ):
        with patch(
            "backend.domain.shared.tool.parsing.body_parser.parse_body_pages_with_llamaparse",
            return_value={},
        ):
            out = parse_body_pages(one_page_pdf_b64, [1])
    assert out.get("parsing_method") in ("pymupdf", "mixed", "none")
    body = out.get("body_by_page") or {}
    assert 1 in body
    assert "SR body test" in body[1] or len(body[1]) > 0


def test_map_body_pages_to_sr_report_body_import() -> None:
    from backend.domain.shared.tool.sr_report.body import map_body_pages_to_sr_report_body

    bodies = map_body_pages_to_sr_report_body(
        body_by_page={1: "hello", 2: "idx"},
        report_id="00000000-0000-0000-0000-000000000001",
        index_page_numbers=[2],
    )
    assert len(bodies) == 2
    assert bodies[0]["is_index_page"] is False
    assert bodies[1]["is_index_page"] is True

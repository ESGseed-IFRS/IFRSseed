"""image_extractor: PyMuPDF 임베디드 이미지 추출 단위 테스트."""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from backend.domain.shared.tool.parsing.common import PYMUPDF_AVAILABLE
from backend.domain.shared.tool.parsing.image_extractor import extract_report_images


@pytest.mark.skipif(not PYMUPDF_AVAILABLE, reason="PyMuPDF 필요")
def test_extract_report_images_writes_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import fitz

    monkeypatch.setenv("SR_IMAGE_MIN_BYTES", "1")

    # 64x64 pixmap 삽입 (PyMuPDF 1.24+: Pixmap(cs, IRect, alpha))
    doc = fitz.open()
    page = doc.new_page(width=200, height=200)
    irect = fitz.IRect(0, 0, 64, 64)
    pix = fitz.Pixmap(fitz.csGRAY, irect, False)
    pix.clear_with(200)
    page.insert_image(fitz.Rect(20, 20, 180, 180), pixmap=pix)
    pix = None
    pdf_bytes = doc.tobytes()
    doc.close()

    rid = str(uuid.uuid4())
    out = extract_report_images(
        pdf_bytes,
        [1],
        str(tmp_path),
        rid,
        index_page_numbers=[],
        skip_index_pages=False,
    )
    assert out["success"] is True
    assert out.get("error") is None
    by_page = out.get("images_by_page") or {}
    assert 1 in by_page
    assert len(by_page[1]) >= 1
    entry = by_page[1][0]
    p = Path(entry["path"])
    assert p.is_file()
    assert p.stat().st_size > 0
    pb = entry.get("placement_bboxes")
    assert pb is not None and len(pb) >= 1
    assert len(pb[0]) == 4


@pytest.mark.skipif(not PYMUPDF_AVAILABLE, reason="PyMuPDF 필요")
def test_extract_skips_index_page_when_enabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import fitz

    monkeypatch.setenv("SR_IMAGE_MIN_BYTES", "1")

    doc = fitz.open()
    page = doc.new_page()
    irect = fitz.IRect(0, 0, 64, 64)
    pix = fitz.Pixmap(fitz.csGRAY, irect, False)
    pix.clear_with(100)
    page.insert_image(fitz.Rect(10, 10, 100, 100), pixmap=pix)
    pdf_bytes = doc.tobytes()
    doc.close()

    rid = str(uuid.uuid4())
    out = extract_report_images(
        pdf_bytes,
        [1],
        str(tmp_path),
        rid,
        index_page_numbers=[1],
        skip_index_pages=True,
    )
    assert out["success"] is True
    assert (out.get("images_by_page") or {}) == {}
    assert 1 in (out.get("skipped_pages") or [])

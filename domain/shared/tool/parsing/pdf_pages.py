"""PDF 페이지 추출 - 지정 페이지만 임시 PDF로 저장 (PyMuPDF / pypdf 폴백)."""
from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import List, Optional, Union

from loguru import logger

from .common import _open_pdf, _restore_stderr, _suppress_mupdf_stderr


def extract_pages_to_pdf_from_bytes(
    pdf_bytes: bytes,
    page_numbers: List[int],
    force_pypdf: bool = False,
) -> Optional[bytes]:
    """
    PDF bytes에서 지정한 페이지만 추출해 새 PDF bytes로 반환.
    1-based page_numbers. 인덱스 페이지만 도구에 넘길 때 사용.
    """
    if not pdf_bytes or not page_numbers:
        return None
    tmp_in = None
    tmp_out_path = None
    try:
        tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        tmp_in.write(pdf_bytes)
        tmp_in.close()
        tmp_out_path = extract_pages_to_pdf(tmp_in.name, page_numbers, force_pypdf=force_pypdf)
        if tmp_out_path is None:
            return None
        with open(tmp_out_path, "rb") as f:
            return f.read()
    except Exception as e:
        logger.warning("[PDF 추출] extract_pages_to_pdf_from_bytes 실패: %s", e)
        return None
    finally:
        if tmp_in is not None and os.path.exists(tmp_in.name):
            try:
                os.unlink(tmp_in.name)
            except Exception:
                pass
        if tmp_out_path is not None and os.path.exists(tmp_out_path):
            try:
                os.unlink(tmp_out_path)
            except Exception:
                pass


def extract_pages_to_pdf(
    pdf_path: Union[str, Path],
    page_numbers: List[int],
    force_pypdf: bool = False,
) -> Optional[Path]:
    """
    PDF에서 지정한 페이지만 추출해 임시 PDF로 저장.
    1-based page_numbers. 호출자가 임시 파일 삭제 책임.
    force_pypdf: True면 스레드 안전을 위해 PyMuPDF 건너뛰고 pypdf만 사용 (LlamaParse 워커 스레드용).
    """
    if force_pypdf:
        return _extract_pages_to_pdf_pypdf(pdf_path, page_numbers)

    try:
        import fitz
    except ImportError:
        logger.warning("[PDF 추출] PyMuPDF 미설치, pypdf로 시도")
        return _extract_pages_to_pdf_pypdf(pdf_path, page_numbers)

    # 워커 스레드에서는 PyMuPDF가 불안정(stack overflow / SWIG callback 오류). pypdf만 사용.
    if threading.current_thread() is not threading.main_thread():
        return _extract_pages_to_pdf_pypdf(pdf_path, page_numbers)

    stderr_dup, devnull_fd = _suppress_mupdf_stderr()
    try:
        doc = _open_pdf(str(pdf_path))
        try:
            if not page_numbers or any(p < 1 or p > len(doc) for p in page_numbers):
                return None
            indices = sorted(set(p - 1 for p in page_numbers))
            new_doc = fitz.open()
            for idx in indices:
                new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.close()
            new_doc.save(tmp.name)
            new_doc.close()
            return Path(tmp.name)
        finally:
            doc.close()
    except Exception as e:
        logger.warning(f"[PDF 추출] PyMuPDF 실패 ({e}), pypdf로 폴백")
        return _extract_pages_to_pdf_pypdf(pdf_path, page_numbers)
    finally:
        _restore_stderr(stderr_dup, devnull_fd)


def _extract_pages_to_pdf_pypdf(
    pdf_path: Union[str, Path],
    page_numbers: List[int],
) -> Optional[Path]:
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        logger.error("[PDF 추출] pypdf 미설치")
        return None

    try:
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()

        for p in page_numbers:
            idx = p - 1
            if 0 <= idx < len(reader.pages):
                writer.add_page(reader.pages[idx])

        if len(writer.pages) == 0:
            return None

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        temp_file.close()

        with open(temp_file.name, "wb") as f:
            writer.write(f)

        return Path(temp_file.name)

    except Exception as e:
        logger.error(f"[PDF 추출] pypdf 실패: {e}")
        return None

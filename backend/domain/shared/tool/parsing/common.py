"""PDF 파싱 공통 - PyMuPDF 열기, MuPDF 에러 메시지 억제 등."""
from __future__ import annotations

from typing import Union

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
    try:
        fitz.TOOLS.mupdf_display_errors(False)
    except Exception:
        pass
except ImportError:
    PYMUPDF_AVAILABLE = False
    fitz = None


def _suppress_mupdf_stderr():
    """(더 이상 사용 안 함 - fitz.TOOLS.mupdf_display_errors(False)로 대체)"""
    return None, None


def _restore_stderr(stderr_dup, devnull_fd):
    """(더 이상 사용 안 함 - fitz.TOOLS.mupdf_display_errors(False)로 대체)"""
    pass


def open_pdf(pdf_path_or_bytes: Union[str, bytes]):
    """파일 경로 또는 bytes로 PDF 문서를 연다. 저장 없이 메모리에서 파싱할 때 bytes 사용."""
    if not PYMUPDF_AVAILABLE or fitz is None:
        raise RuntimeError("PyMuPDF(pymupdf) 패키지가 설치되지 않았습니다.")

    if isinstance(pdf_path_or_bytes, bytes):
        return fitz.open(stream=pdf_path_or_bytes, filetype="pdf")
    return fitz.open(pdf_path_or_bytes)


# 기존 호출부 호환
_open_pdf = open_pdf

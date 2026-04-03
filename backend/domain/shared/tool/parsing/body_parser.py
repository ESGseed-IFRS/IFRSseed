"""SR 본문 페이지별 텍스트 추출 (Docling 우선 → LlamaParse → PyMuPDF).

AGENTIC 설계(SR_BODY_PARSING_DESIGN): 평문·마크다운 텍스트 위주, 표 구조보다 페이지 단위 문자열.
"""
from __future__ import annotations

import base64
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Set

from loguru import logger

from .pymupdf import parse_body_pages as parse_body_pages_pymupdf


def _pages_complete(body_by_page: Dict[int, str], pages: List[int]) -> bool:
    need: Set[int] = set(pages)
    have = set(body_by_page.keys())
    return need.issubset(have)


def _docling_single_page_to_markdown(pdf_bytes: bytes, page_no: int) -> Optional[str]:
    """한 페이지만 담은 PDF bytes에 대해 Docling으로 마크다운/텍스트 추출."""
    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.base_models import ConversionStatus
    except ImportError:
        return None

    from backend.domain.shared.tool.parsing.pdf_pages import extract_pages_to_pdf_from_bytes

    one_pdf = extract_pages_to_pdf_from_bytes(pdf_bytes, [page_no])
    if not one_pdf:
        return None

    tmp_path: Optional[str] = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        with open(tmp_path, "wb") as f:
            f.write(one_pdf)

        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        doc = getattr(result, "document", None)
        if doc is None:
            if hasattr(result, "status") and getattr(result, "status", None) == ConversionStatus.FAILURE:
                return None
            return None
        if hasattr(doc, "export_to_markdown"):
            md = doc.export_to_markdown()
            if isinstance(md, str) and md.strip():
                return md.strip()
        if hasattr(doc, "export_to_text"):
            tx = doc.export_to_text()
            if isinstance(tx, str) and tx.strip():
                return tx.strip()
    except Exception as e:
        logger.debug("[BodyParser] Docling 페이지 {} 실패: {}", page_no, e)
        return None
    finally:
        if tmp_path and os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    return None


def parse_body_pages_with_docling(pdf_bytes: bytes, pages: List[int]) -> Dict[int, str]:
    """
    Docling으로 페이지별 텍스트 추출 (페이지별 단일 PDF 슬라이스 후 변환).

    Returns:
        {page_number: content_text}
    """
    if not pages:
        return {}

    max_workers = min(
        int(os.getenv("SR_BODY_DOCLING_MAX_WORKERS", "2")),
        max(1, len(pages)),
    )

    body_by_page: Dict[int, str] = {}

    def _one(p: int) -> tuple[int, Optional[str]]:
        return (p, _docling_single_page_to_markdown(pdf_bytes, p))

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(_one, p): p for p in pages}
        for fut in as_completed(futures):
            page_no, text = fut.result()
            if text:
                body_by_page[page_no] = text

    if body_by_page and len(body_by_page) < len(set(pages)):
        logger.warning(
            "[BodyParser] Docling 부분 성공: {}/{} 페이지",
            len(body_by_page),
            len(set(pages)),
        )
    return body_by_page


def parse_body_pages_with_llamaparse(pdf_bytes: bytes, pages: List[int]) -> Dict[int, str]:
    """LlamaParse로 페이지별 마크다운 추출."""
    from backend.domain.shared.tool.parsing.llamaparse import (
        extract_index_pages_as_markdown_from_bytes,
    )

    page_md, err = extract_index_pages_as_markdown_from_bytes(pdf_bytes, pages)
    if err:
        logger.warning("[BodyParser] LlamaParse: {}", err)
    out: Dict[int, str] = {}
    for k, v in (page_md or {}).items():
        try:
            pn = int(k)
        except (TypeError, ValueError):
            continue
        if isinstance(v, str) and v.strip():
            out[pn] = v.strip()
    return out


def parse_body_pages(pdf_bytes_b64: str, pages: List[int]) -> Dict[str, Any]:
    """
    페이지별 본문 텍스트 추출 (Docling → LlamaParse → PyMuPDF).

    Args:
        pdf_bytes_b64: PDF 바이너리 base64
        pages: 1-based 페이지 번호 목록

    Returns:
        {
            "body_by_page": {1: "...", ...},
            "parsing_method": "docling" | "llamaparse" | "pymupdf" | "mixed",
            "error": optional str
        }
    """
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
    except Exception as e:
        return {
            "error": f"PDF base64 디코딩 실패: {e}",
            "body_by_page": {},
            "parsing_method": "none",
        }

    if not pages:
        return {"body_by_page": {}, "parsing_method": "none"}

    body_by_page: Dict[int, str] = {}
    method_flags = {"docling": False, "llamaparse": False, "pymupdf": False}

    skip_docling = os.getenv("SR_BODY_SKIP_DOCLING", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )

    if not skip_docling:
        logger.info("[BodyParser] Docling 시도 (pages={})", len(pages))
        body_by_page = parse_body_pages_with_docling(pdf_bytes, pages)
        if body_by_page:
            method_flags["docling"] = True
        if _pages_complete(body_by_page, pages):
            logger.info("[BodyParser] Docling만으로 완료: {}페이지", len(body_by_page))
            return {"body_by_page": body_by_page, "parsing_method": "docling"}
    else:
        logger.info("[BodyParser] SR_BODY_SKIP_DOCLING=1 → Docling 생략")

    missing = [p for p in pages if p not in body_by_page]
    if missing:
        logger.info("[BodyParser] LlamaParse 시도 (대상 {}페이지)", len(missing))
        lp_map = parse_body_pages_with_llamaparse(pdf_bytes, missing)
        if lp_map:
            method_flags["llamaparse"] = True
        for k, v in lp_map.items():
            body_by_page[k] = v

    if _pages_complete(body_by_page, pages):
        if method_flags["docling"] and method_flags["llamaparse"]:
            pm = "mixed"
        elif method_flags["llamaparse"]:
            pm = "llamaparse"
        else:
            pm = "docling"
        logger.info("[BodyParser] LlamaParse 단계 후 완료: parsing_method={}", pm)
        return {"body_by_page": body_by_page, "parsing_method": pm}

    missing2 = [p for p in pages if p not in body_by_page]
    if missing2:
        logger.warning("[BodyParser] PyMuPDF 폴백 ({}페이지)", len(missing2))
        pm_result = parse_body_pages_pymupdf(pdf_bytes_b64, missing2)
        inner = pm_result.get("body_by_page") if isinstance(pm_result, dict) else {}
        if isinstance(inner, dict):
            for k, v in inner.items():
                try:
                    pk = int(k)
                except (TypeError, ValueError):
                    continue
                if isinstance(v, str):
                    body_by_page[pk] = v
                    method_flags["pymupdf"] = True

    if _pages_complete(body_by_page, pages):
        pm = "pymupdf"
        if method_flags["llamaparse"] or method_flags["docling"]:
            pm = "mixed"
        return {"body_by_page": body_by_page, "parsing_method": pm}

    logger.info("[BodyParser] PyMuPDF 전체 폴백 시도")
    pm_all = parse_body_pages_pymupdf(pdf_bytes_b64, pages)
    inner_all = pm_all.get("body_by_page") if isinstance(pm_all, dict) else {}
    if isinstance(inner_all, dict) and inner_all:
        method_flags["pymupdf"] = True
        for k, v in inner_all.items():
            try:
                pk = int(k)
            except (TypeError, ValueError):
                continue
            if isinstance(v, str):
                body_by_page[pk] = v

    if body_by_page and _pages_complete(body_by_page, pages):
        return {"body_by_page": body_by_page, "parsing_method": "pymupdf"}

    missing_final = [p for p in pages if p not in body_by_page]
    if body_by_page:
        logger.warning(
            "[BodyParser] 일부 페이지만 추출됨 (누락 {}): {}",
            len(missing_final),
            missing_final[:20],
        )
        return {
            "body_by_page": body_by_page,
            "parsing_method": "mixed",
            "incomplete_pages": missing_final,
        }

    return {
        "error": "Docling, LlamaParse, PyMuPDF 모두 실패 또는 빈 결과",
        "body_by_page": {},
        "parsing_method": "none",
    }

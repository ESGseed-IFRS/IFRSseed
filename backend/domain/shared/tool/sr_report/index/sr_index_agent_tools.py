"""AGENTIC_INDEX_DESIGN Phase 1: 인덱스 에이전트용 툴 모음.

get_pdf_metadata, inspect_index_pages, parse_index_with_docling, parse_index_with_llamaparse,
validate_index_rows, detect_anomalies, correct_anomalous_rows_with_md, save_index_batch.
"""
from __future__ import annotations

import asyncio
import base64
import uuid
from typing import Any, Dict, List, Optional

from loguru import logger

# DB
from backend.core.db import get_session

from sqlalchemy import select

from backend.domain.v1.data_integration.models.bases import HistoricalSRReport

# 파싱/매핑/저장 (실제 패키지 경로: shared/tool/parsing, sr_report/mapping, sr_report/save)
from backend.domain.shared.tool.parsing.docling import parse_pdf_to_tables
from backend.domain.shared.tool.parsing.llamaparse import extract_index_pages_as_markdown_from_bytes
from backend.domain.shared.tool.sr_report.index.mapping.sr_index_mapping import (
    map_tables_to_sr_report_index,
)
from backend.domain.shared.tool.sr_report.save.sr_save_tools import save_sr_report_index_batch


def get_pdf_metadata(report_id: str) -> Dict[str, Any]:
    """
    DB에서 report 메타데이터 조회.

    Returns:
        {
            "total_pages": int,
            "index_page_numbers": [138, 139, ...],
            "report_name": str,
            "report_year": int
        }
        또는 report_id가 없으면 {"error": "..."}
    """
    session = get_session()
    try:
        try:
            rid = uuid.UUID(str(report_id))
        except (ValueError, TypeError):
            return {"error": f"invalid report_id: {report_id}"}
        stmt = select(HistoricalSRReport).where(HistoricalSRReport.id == rid)
        row = session.execute(stmt).scalars().one_or_none()
        if row is None:
            return {"error": f"report_id not found: {report_id}"}
        return {
            "total_pages": row.total_pages,
            "index_page_numbers": list(row.index_page_numbers or []),
            "report_name": row.report_name or "",
            "report_year": row.report_year,
        }
    except Exception as e:
        logger.error(f"[get_pdf_metadata] {e}")
        return {"error": str(e)}
    finally:
        session.close()


def inspect_index_pages(
    pdf_bytes_b64: str,
    index_page_numbers: List[int],
) -> List[Dict[str, Any]]:
    """
    인덱스 페이지들의 복잡도 파악 (Docling 가능 여부 판단용).
    parse_pdf_to_tables 결과를 페이지별로 집계.

    Returns:
        [
            {
                "page": 138,
                "table_count": 2,
                "complexity": "simple" | "medium" | "complex",
                "has_merged_cells": False,
                "column_count": 5,
                "row_count": 31
            },
            ...
        ]
    """
    if not index_page_numbers:
        return []
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
    except Exception as e:
        logger.warning(f"[inspect_index_pages] b64 decode failed: {e}")
        return [{"page": p, "table_count": 0, "complexity": "unknown", "has_merged_cells": False, "column_count": 0, "row_count": 0} for p in index_page_numbers]

    result = parse_pdf_to_tables(pdf_bytes, pages=index_page_numbers)
    if result.get("error") or not result.get("tables"):
        return [
            {
                "page": p,
                "table_count": 0,
                "complexity": "unknown",
                "has_merged_cells": False,
                "column_count": 0,
                "row_count": 0,
            }
            for p in index_page_numbers
        ]

    tables = result["tables"]
    by_page: Dict[int, List[Dict]] = {}
    for t in tables:
        p = t.get("page")
        if p is not None:
            by_page.setdefault(p, []).append(t)

    out = []
    for p in index_page_numbers:
        page_tables = by_page.get(p, [])
        table_count = len(page_tables)
        row_count = sum(len(t.get("rows") or []) for t in page_tables)
        column_count = max((len(t.get("header") or []) for t in page_tables), default=0)
        if table_count == 0 and row_count == 0:
            complexity = "unknown"
        elif table_count <= 2 and row_count < 50:
            complexity = "simple"
        elif table_count <= 4 and row_count < 100:
            complexity = "medium"
        else:
            complexity = "complex"
        out.append({
            "page": p,
            "table_count": table_count,
            "complexity": complexity,
            "has_merged_cells": False,
            "column_count": column_count,
            "row_count": row_count,
        })
    return out


def parse_index_with_docling(
    pdf_bytes_b64: str,
    report_id: str,
    pages: List[int],
) -> Dict[str, Any]:
    """
    Docling으로 지정 페이지 파싱 (parsing.docling + mapping만 사용, sr_report_tools_docling 미의존).

    Returns:
        {
            "sr_report_index": [...],
            "parsing_method": "docling",
            "tables": [...],
            "table_count": int
        } 또는 {"error": "...", "docling_failed": True, "fallback_pages": [...], "sr_report_index": []}
    """
    import sys
    # Docling에 넘기는 파싱 페이지를 로그에 명시
    logger.info("[parse_index_with_docling] Docling에 넘기는 파싱 페이지: %s (report_id=%s)", pages, report_id)
    print(f"[parse_index_with_docling] Docling 파싱 페이지: {pages}", file=sys.stderr, flush=True)
    print(f"[MCP:DEBUG] parse_index_with_docling 진입 report_id={report_id} pages={pages} b64_len={len(pdf_bytes_b64 or '')}", file=sys.stderr, flush=True)
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
        print(f"[MCP:DEBUG] parse_index_with_docling base64 디코딩 완료 pdf_bytes={len(pdf_bytes)} bytes", file=sys.stderr, flush=True)
    except Exception as e:
        return {
            "error": f"base64 디코딩 실패: {e}",
            "docling_failed": True,
            "fallback_pages": list(pages),
            "sr_report_index": [],
            "table_count": 0,
        }

    print(f"[MCP:DEBUG] parse_index_with_docling parse_pdf_to_tables 호출 직전", file=sys.stderr, flush=True)
    result = parse_pdf_to_tables(pdf_bytes, pages=pages)
    print(f"[MCP:DEBUG] parse_index_with_docling parse_pdf_to_tables 반환 table_count={result.get('table_count', 0)} error={result.get('error', '') or '없음'}", file=sys.stderr, flush=True)
    if result.get("error") or result.get("docling_failed"):
        return {
            "error": result.get("error", "Docling 변환 실패"),
            "docling_failed": True,
            "fallback_pages": result.get("fallback_pages", list(pages)),
            "sr_report_index": [],
            "table_count": result.get("table_count", 0),
        }

    tables = result.get("tables") or []
    print(f"[MCP:DEBUG] parse_index_with_docling map_tables_to_sr_report_index 호출 직전 tables={len(tables)}", file=sys.stderr, flush=True)
    sr_report_index = map_tables_to_sr_report_index(tables, report_id)
    print(f"[MCP:DEBUG] parse_index_with_docling 완료 sr_report_index={len(sr_report_index)}건", file=sys.stderr, flush=True)
    return {
        "sr_report_index": sr_report_index,
        "parsing_method": "docling",
        "tables": tables,
        "table_count": result.get("table_count", len(tables)),
    }


def parse_index_with_llamaparse(
    pdf_bytes_b64: str,
    pages: List[int],
) -> Dict[str, Any]:
    """
    LlamaParse로 지정 페이지 파싱 (마크다운 반환).

    Returns:
        {
            "page_markdown": { page_num: markdown_str, ... },
            "error": optional 오류 메시지 (비어 있거나 실패 시 확인 가능)
        }
    """
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
    except Exception as e:
        return {"error": f"base64 디코딩 실패: {e}", "page_markdown": {}}
    md_by_page, err_msg = extract_index_pages_as_markdown_from_bytes(pdf_bytes, pages)
    out: Dict[str, Any] = {"page_markdown": md_by_page}
    if err_msg:
        out["error"] = err_msg
    elif not md_by_page:
        out["error"] = "page_markdown이 비어 있습니다. LLAMA_CLOUD_API_KEY, llama-parse 설치, API 할당량을 확인하세요."
    return out


def validate_index_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    스키마 검증.

    Returns:
        {
            "valid": True/False,
            "errors": [
                {"row_index": 0, "field": "dp_id", "error": "required field missing"},
                ...
            ]
        }
    """
    errors: List[Dict[str, Any]] = []
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            errors.append({"row_index": i, "field": None, "error": "row must be a dict"})
            continue
        dp_id = row.get("dp_id")
        if dp_id is None or (isinstance(dp_id, str) and not str(dp_id).strip()):
            errors.append({"row_index": i, "field": "dp_id", "error": "required field missing"})
        page_numbers = row.get("page_numbers")
        if not isinstance(page_numbers, list):
            errors.append({"row_index": i, "field": "page_numbers", "error": "must be a list"})
        elif len(page_numbers) == 0:
            errors.append({"row_index": i, "field": "page_numbers", "error": "required non-empty"})
        else:
            for j, p in enumerate(page_numbers):
                if not isinstance(p, int):
                    errors.append({"row_index": i, "field": "page_numbers", "error": f"element {j} must be int"})
    return {"valid": len(errors) == 0, "errors": errors}


def detect_anomalies(
    rows: List[Dict[str, Any]],
    total_pages: int,
) -> List[Dict[str, Any]]:
    """
    이상치 탐지.

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
    from backend.domain.shared.data_integration.index.review.sr_llm_review import detect_sr_index_anomalies
    from loguru import logger

    items = detect_sr_index_anomalies(rows, total_pages=total_pages)
    normalized: List[Dict[str, Any]] = []
    for it in items:
        # row가 없는 항목은 보정 단계에서 사용할 수 없으므로 스킵 (로그만 남김)
        if "row" not in it:
            logger.warning(
                "[detect_anomalies] detect_sr_index_anomalies 결과에 'row' 키가 없음: %s",
                str({k: it.get(k) for k in ('row_index', 'anomalous_columns', 'index_page_number')}),
            )
            continue
        row = it["row"]
        normalized.append(
            {
                "row_index": it.get("row_index"),
                "row": row,
                "anomalous_columns": it.get("anomalous_columns", []),
                "index_page_number": row.get("index_page_number"),
            }
        )
    return normalized


def _run_async_in_new_loop(coro):
    """이미 돌고 있는 이벤트 루프(FastAPI 등)와 충돌하지 않도록, 별도 스레드에서 새 루프로 코루틴 실행."""
    result = None
    exception = None

    def run():
        nonlocal result, exception
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(coro)
        except Exception as e:
            exception = e
        finally:
            loop.close()

    import threading
    t = threading.Thread(target=run)
    t.start()
    t.join()
    if exception is not None:
        raise exception
    return result


def correct_anomalous_rows_with_md(
    anomalous_items: List[Dict[str, Any]],
    page_markdown: Dict[int, str],
    report_id: str,
) -> List[Dict[str, Any]]:
    """
    마크다운 기반 이상치 보정 (LLM 호출, 파싱된 값만 사용).

    Args:
        anomalous_items: detect_anomalies 반환값
        page_markdown: { page_num: markdown_text, ... } (키는 int 또는 str)
        report_id: 보고서 ID

    Returns:
        [ {"row_index": int, "row": {...} }, ... ] (보정된 전체 row)
    """
    from backend.domain.shared.data_integration.index.review.sr_llm_review import correct_anomalous_index_rows_with_md
    # JSON/에이전트에서 키가 문자열로 올 수 있음
    md_int_key: Dict[int, str] = {}
    for k, v in (page_markdown or {}).items():
        try:
            md_int_key[int(k)] = str(v) if v is not None else ""
        except (TypeError, ValueError):
            continue
    coro = correct_anomalous_index_rows_with_md(anomalous_items, md_int_key, report_id)
    return _run_async_in_new_loop(coro)


def save_index_batch(report_id: str, indices: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    배치 저장.

    Returns:
        {"success": True, "saved_count": 120, "errors": []}
    """
    return save_sr_report_index_batch.invoke({"report_id": report_id, "indices": indices})


__all__ = [
    "get_pdf_metadata",
    "inspect_index_pages",
    "parse_index_with_docling",
    "parse_index_with_llamaparse",
    "validate_index_rows",
    "detect_anomalies",
    "correct_anomalous_rows_with_md",
]

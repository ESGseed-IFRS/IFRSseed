"""SR 보고서 파싱 - re-export (§10: 메타·인덱스만 툴, 본문/이미지는 에이전트 경로)

- PDFParser, parse_sr_report_metadata: parsing.pdf_metadata
- parse_sr_report_index: parsing.docling + mapping (sr_report_tools_docling 미의존)
- 본문/이미지: sr_body_agent, sr_images_agent 경로 사용 (직접 호출·re-export 없음)
"""
from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional, Union

from langchain_core.tools import tool

from .parsing.pdf_metadata import PDFParser, parse_sr_report_metadata


def parse_sr_report_index(
    pdf_path_or_bytes: Union[str, bytes],
    report_id: str,
    index_page_numbers: List[int],
    index_page_number: Optional[int] = None,
    parsing_method: str = "docling",
) -> Dict[str, Any]:
    """
    인덱스 페이지 표를 Docling으로 파싱하여 표 구조와 sr_report_index 행을 반환합니다.
    (parsing.docling.parse_pdf_to_tables + sr_report.index.mapping.map_tables_to_sr_report_index)
    """
    from .parsing.docling import parse_pdf_to_tables
    from .sr_report.index.mapping import map_tables_to_sr_report_index

    result = parse_pdf_to_tables(pdf_path_or_bytes, pages=index_page_numbers or None)
    if result.get("error") or result.get("docling_failed"):
        return {
            "error": result.get("error", "Docling 변환 실패"),
            "docling_failed": True,
            "fallback_pages": result.get("fallback_pages", list(index_page_numbers or [])),
            "sr_report_index": [],
            "table_count": 0,
        }
    tables = result.get("tables") or []
    sr_report_index = map_tables_to_sr_report_index(tables, report_id)
    return {
        "tables": tables,
        "table_count": len(tables),
        "sr_report_index": sr_report_index,
    }


# LangChain Tool 래퍼 (메타·인덱스만; 본문/이미지는 에이전트로)
@tool
def parse_metadata_tool(pdf_bytes_b64: str, company: str, year: int, company_id: Optional[str] = None) -> Dict[str, Any]:
    """PDF bytes(base64)에서 메타데이터를 파싱합니다.

    Args:
        pdf_bytes_b64: base64 인코딩된 PDF bytes
        company: 회사명
        year: 연도
        company_id: 회사 ID (선택)

    Returns:
        {"historical_sr_reports": {...}} 또는 {"error": "..."}
    """
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
    except Exception as e:
        return {"error": f"base64 디코딩 실패: {e}"}

    return parse_sr_report_metadata(pdf_bytes, company, year, company_id)


@tool
def parse_index_tool(pdf_bytes_b64: str, report_id: str, index_page_numbers: List[int]) -> Dict[str, Any]:
    """PDF bytes(base64)에서 인덱스 테이블을 파싱합니다.

    Args:
        pdf_bytes_b64: base64 인코딩된 PDF bytes
        report_id: 보고서 ID
        index_page_numbers: 인덱스 페이지 번호 리스트

    Returns:
        {"sr_report_index": [...]} 또는 {"error": "..."}
    """
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
    except Exception as e:
        return {"error": f"base64 디코딩 실패: {e}"}

    return parse_sr_report_index(pdf_bytes, report_id, index_page_numbers)


# §10: 본문/이미지는 에이전트(sr_body_agent, sr_images_agent) 경로만 사용. 툴·re-export 없음.
SR_PARSE_TOOLS = [
    parse_metadata_tool,
    parse_index_tool,
]


__all__ = [
    "PDFParser",
    "parse_sr_report_metadata",
    "parse_sr_report_index",
    "SR_PARSE_TOOLS",
]

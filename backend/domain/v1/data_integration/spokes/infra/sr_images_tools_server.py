"""SR 이미지 에이전트용 FastMCP Tool Server.

get_pdf_metadata_tool, extract_report_images_tool, map_extracted_images_to_sr_report_rows_tool,
save_sr_report_images_batch_tool.
클라우드 배포 시 에이전트가 MCP로 연결해 툴 콜링합니다 (본문 sr_body_tools_server 와 대칭).
"""
from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from .path_resolver import find_repo_root
except ImportError:
    from path_resolver import find_repo_root

_repo_root = find_repo_root(Path(__file__))
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_repo_root / ".env")
except ImportError:
    pass

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("pip install mcp fastmcp 필요", file=sys.stderr)
    sys.exit(1)

mcp = FastMCP("SR Images Tools Server")


@mcp.tool()
async def get_pdf_metadata_tool(report_id: str) -> str:
    """DB에서 report 메타데이터(total_pages, index_page_numbers 등) 조회. 이미지 추출 페이지 범위 결정 시 사용."""
    from backend.domain.shared.tool.sr_report.index.sr_index_agent_tools import get_pdf_metadata

    result = await asyncio.to_thread(get_pdf_metadata, report_id)
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def extract_report_images_tool(
    pdf_bytes_b64: str,
    pages: list,
    output_dir: str,
    report_id: str,
    index_page_numbers: Optional[list] = None,
) -> str:
    """PDF(base64)에서 지정 페이지의 임베디드 이미지를 output_dir/{report_id}/ 에 저장. 반환 images_by_page를 map 도구에 전달."""
    from backend.domain.shared.tool.parsing.image_extractor import extract_report_images

    def _run() -> Dict[str, Any]:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
        idx = index_page_numbers if index_page_numbers is not None else []
        return extract_report_images(
            pdf_bytes,
            list(pages),
            output_dir,
            report_id,
            index_page_numbers=idx,
        )

    result = await asyncio.to_thread(_run)
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def map_extracted_images_to_sr_report_rows_tool(
    images_by_page: dict,
    report_id: str,
) -> str:
    """extract_report_images_tool 반환의 images_by_page(dict)를 sr_report_images 배치 저장용 행 리스트로 변환."""
    from backend.domain.shared.tool.sr_report.images import map_extracted_images_to_sr_report_rows

    def _norm_keys(d: Dict[Any, Any]) -> Dict[int, List[Dict[str, Any]]]:
        out: Dict[int, List[Dict[str, Any]]] = {}
        for k, v in d.items():
            try:
                pk = int(k)
            except (TypeError, ValueError):
                continue
            if isinstance(v, list):
                out[pk] = v
        return out

    def _run_map() -> List[Dict[str, Any]]:
        return map_extracted_images_to_sr_report_rows(report_id, _norm_keys(images_by_page))

    rows = await asyncio.to_thread(_run_map)
    return json.dumps(rows, ensure_ascii=False)


@mcp.tool()
async def save_sr_report_images_batch_tool(
    report_id: str,
    rows: list,
    replace_existing: bool = True,
) -> str:
    """sr_report_images 테이블에 이미지 메타 배치 저장. rows는 map_extracted_images_to_sr_report_rows_tool 반환 전체."""
    from backend.domain.shared.tool.sr_report.save.sr_save_tools import save_sr_report_images_batch

    def _run_save() -> Dict[str, Any]:
        return save_sr_report_images_batch(
            report_id,
            list(rows),
            replace_existing=replace_existing,
        )

    result = await asyncio.to_thread(_run_save)
    return json.dumps(result, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()

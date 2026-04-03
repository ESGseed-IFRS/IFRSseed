"""SR 본문 에이전트용 FastMCP Tool Server.

get_pdf_metadata_tool, parse_body_pages_tool, map_body_pages_to_sr_report_body_tool, save_sr_report_body_batch_tool.
클라우드 배포 시 에이전트가 MCP로 이 서버에 연결해 툴 콜링합니다.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Optional
try:
    from .path_resolver import find_repo_root
except ImportError:
    from path_resolver import find_repo_root

# 저장소 루트 (환경 변수/마커 파일 기반 탐색)
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

mcp = FastMCP("SR Body Tools Server")


@mcp.tool()
async def get_pdf_metadata_tool(report_id: str) -> str:
    """DB에서 report 메타데이터(total_pages, index_page_numbers, report_name, report_year) 조회. 본문 페이지 범위 결정 시 필수."""
    from backend.domain.shared.tool.sr_report.index.sr_index_agent_tools import get_pdf_metadata
    result = await asyncio.to_thread(get_pdf_metadata, report_id)
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def parse_body_pages_tool(pdf_bytes_b64: str, pages: list) -> str:
    """PDF에서 지정 페이지 본문 텍스트 추출(Docling→LlamaParse→PyMuPDF). 반환 body_by_page를 map_body_pages_to_sr_report_body_tool에 전달."""
    from backend.domain.shared.tool.parsing.body_parser import parse_body_pages
    result = await asyncio.to_thread(parse_body_pages, pdf_bytes_b64, pages)
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def map_body_pages_to_sr_report_body_tool(
    body_by_page: dict,
    report_id: str,
    index_page_numbers: Optional[list] = None,
    use_llm_toc_align: bool = False,
    openai_api_key: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> str:
    """페이지별 텍스트(body_by_page)를 sr_report_body 저장용 행 리스트로 변환. parse_body_pages_tool 반환값의 body_by_page를 그대로 전달.
    제목 기반 toc_path를 생성합니다. use_llm_toc_align/openai_api_key/llm_model 인자는 호환용으로만 유지됩니다."""
    from backend.domain.shared.tool.sr_report.body import map_body_pages_to_sr_report_body
    idx = index_page_numbers if index_page_numbers is not None else []

    def _run_map():
        return map_body_pages_to_sr_report_body(
            body_by_page,
            report_id,
            idx,
            use_llm_toc_align=use_llm_toc_align,
            openai_api_key=openai_api_key,
            llm_model=llm_model,
        )

    result = await asyncio.to_thread(_run_map)
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def save_sr_report_body_batch_tool(report_id: str, bodies: list) -> str:
    """sr_report_body 테이블에 본문 배치 저장. bodies는 map_body_pages_to_sr_report_body_tool 반환값 전체를 전달."""
    from backend.domain.shared.tool.sr_report.save.sr_save_tools import save_sr_report_body_batch
    result = await asyncio.to_thread(save_sr_report_body_batch, report_id, bodies)
    return json.dumps(result, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()

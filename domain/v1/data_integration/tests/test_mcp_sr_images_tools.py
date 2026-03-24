"""MCP 인프로세스 sr_images_tools 로드 스모크 테스트."""
from __future__ import annotations

import asyncio

from backend.domain.v1.data_integration.spokes.infra.mcp_client import MCPClient


def test_load_sr_images_tools_returns_four_tools() -> None:
    async def _load() -> list:
        client = MCPClient()
        return await client.load_inprocess_tools("sr_images_tools")

    tools = asyncio.run(_load())
    assert len(tools) == 4
    names = {getattr(t, "name", None) for t in tools}
    assert "get_pdf_metadata_tool" in names
    assert "extract_report_images_tool" in names
    assert "map_extracted_images_to_sr_report_rows_tool" in names
    assert "save_sr_report_images_batch_tool" in names

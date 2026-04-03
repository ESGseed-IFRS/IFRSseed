"""ESG UCM MCP 정책 — `esg_data_tools`는 원격(streamable HTTP) URL 없이 in-process·stdio만 사용."""

from __future__ import annotations

from backend.domain.v1.data_integration.spokes.infra.mcp_client import (
    MCPClient,
    mcp_remote_url_for_server,
)

ESG_DATA_TOOLS_SERVER_NAME = "esg_data_tools"


def esg_data_tools_remote_url() -> str:
    return mcp_remote_url_for_server(ESG_DATA_TOOLS_SERVER_NAME)


def esg_data_tools_use_inprocess() -> bool:
    return MCPClient().should_use_inprocess(ESG_DATA_TOOLS_SERVER_NAME)

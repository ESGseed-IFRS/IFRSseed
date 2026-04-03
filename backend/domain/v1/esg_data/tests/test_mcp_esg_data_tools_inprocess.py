"""MCPClient `esg_data_tools` in-process 툴 등록 스모크."""

from __future__ import annotations

import asyncio

from backend.domain.v1.data_integration.spokes.infra.mcp_client import MCPClient


def test_load_inprocess_esg_data_tools_returns_five_tools() -> None:
    tools = asyncio.run(MCPClient().load_inprocess_tools("esg_data_tools"))
    assert len(tools) == 5
    names = {getattr(t, "name", None) for t in tools}
    assert names == {
        "create_unified_column_mapping",
        "validate_ucm_mappings",
        "run_ucm_workflow",
        "run_ucm_mapping_pipeline",
        "run_ucm_nearest_pipeline",
    }


def test_esg_mcp_transport_matches_client_policy() -> None:
    from backend.domain.v1.esg_data.spokes.infra.esg_mcp_transport import (
        esg_data_tools_remote_url,
        esg_data_tools_use_inprocess,
    )

    c = MCPClient()
    assert esg_data_tools_use_inprocess() == c.should_use_inprocess("esg_data_tools")
    assert esg_data_tools_remote_url() == c.get_remote_url("esg_data_tools")

"""에이전트용 인프로세스 MCP 툴 런타임 — `call_tool` 계약으로 핸들러에 위임한다."""

from __future__ import annotations

from typing import Any

from backend.domain.v1.esg_data.hub.services.ucm_mapping_service import UCMMappingService


class DirectEsgToolRuntime:
    """오케스트레이터·에이전트 내부 전용: 툴 이름으로 `esg_ucm_tool_handlers`에 직접 위임."""

    def __init__(self, mapping_service: UCMMappingService | None = None) -> None:
        self._mapping_service = mapping_service

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        from backend.domain.v1.esg_data.spokes.infra import esg_ucm_tool_handlers as H

        args = dict(arguments or {})
        if name == "create_unified_column_mapping":
            return H.handle_create_unified_column_mapping(_mapping_service=self._mapping_service, **args)
        if name == "validate_ucm_mappings":
            return H.handle_validate_ucm_mappings(_mapping_service=self._mapping_service)
        if name == "run_ucm_workflow":
            return H.handle_run_ucm_workflow(_mapping_service=self._mapping_service, **args)
        if name == "run_ucm_mapping_pipeline":
            return H.handle_run_ucm_mapping_pipeline(**args)
        if name == "run_ucm_nearest_pipeline":
            return H.handle_run_ucm_nearest_pipeline(**args)
        raise ValueError(f"알 수 없는 ESG UCM 툴: {name}")

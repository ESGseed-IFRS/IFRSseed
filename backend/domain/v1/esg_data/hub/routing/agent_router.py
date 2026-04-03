"""ESG 데이터 에이전트 라우터(3단계)."""

from __future__ import annotations

from typing import Literal

from backend.domain.v1.esg_data.models.langgraph import UCMWorkflowState

AgentName = Literal["creation_agent", "validation_agent"]


class AgentRouter:
    """워크플로 상태에 따라 다음에 실행할 에이전트를 선택한다."""

    def route(self, state: UCMWorkflowState) -> AgentName:
        if state.get("force_validate_only"):
            return "validation_agent"
        if state.get("route") == "validation_agent":
            return "validation_agent"
        return "creation_agent"


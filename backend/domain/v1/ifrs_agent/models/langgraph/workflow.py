"""
LangGraph 워크플로우 빌더

오케스트레이터를 LangGraph 노드로 래핑하고 그래프 구성
"""
import logging
from typing import Dict, Any
from uuid import uuid4

from langgraph.graph import StateGraph

from backend.domain.v1.ifrs_agent.models.langgraph import (
    WorkflowState,
    create_initial_state,
    update_state
)
from backend.domain.v1.ifrs_agent.hub.orchestrator import Orchestrator
from backend.domain.v1.ifrs_agent.spokes.infra import InfraLayer

logger = logging.getLogger("ifrs_agent.workflow")


def build_workflow(infra: InfraLayer):
    """
    LangGraph 워크플로우 빌드
    
    Args:
        infra: InfraLayer 인스턴스 (에이전트·툴 레지스트리 포함)
    
    Returns:
        Compiled LangGraph workflow
    """
    workflow = StateGraph(WorkflowState)
    
    # 오케스트레이터 인스턴스 생성
    orchestrator = Orchestrator(infra)
    
    # 단일 노드: orchestrator_node (핵심)
    async def orchestrator_run(state: WorkflowState) -> WorkflowState:
        """
        LangGraph 노드 — 오케스트레이터 진입점
        
        Args:
            state: 현재 워크플로우 상태
        
        Returns:
            WorkflowState: 업데이트된 워크플로우 상태
        """
        logger.info(
            f"orchestrator_node started",
            extra={
                "workflow_id": state.get("workflow_id"),
                "action": state.get("user_input", {}).get("action"),
                "attempt": state.get("attempt", 0)
            }
        )
        
        try:
            # 오케스트레이터 실행
            result = await orchestrator.orchestrate(state["user_input"])
            
            # 상태 업데이트
            refs = result.get("references") or {}
            state = update_state(
                state,
                generated_text=result.get("generated_text", ""),
                validation=result.get("validation", {}),
                status=result.get("metadata", {}).get("status", "failed"),
                attempt=result.get("metadata", {}).get("attempts", 0) - 1,  # 0부터 시작하도록 조정
                ref_data=refs.get("sr_data", {}),
                fact_data=refs.get("fact_data", {}),
                fact_data_by_dp=refs.get("fact_data_by_dp", {}),
                agg_data=result.get("agg_data", refs.get("agg_data", {})),
                mode=result.get("metadata", {}).get("mode", "draft"),
                error=result.get("error"),
                gen_input=result.get("gen_input") or {},
                data_selection=result.get("data_selection") or {},
                prompt_interpretation=result.get("prompt_interpretation") or {},
            )
            
            logger.info(
                f"orchestrator_node completed",
                extra={
                    "workflow_id": state.get("workflow_id"),
                    "status": state.get("status"),
                    "attempt": state.get("attempt", 0)
                }
            )
        
        except Exception as e:
            logger.error(
                f"orchestrator_node failed: {e}",
                extra={
                    "workflow_id": state.get("workflow_id"),
                    "error": str(e)
                },
                exc_info=True
            )
            
            state = update_state(
                state,
                status="failed",
                error=str(e)
            )
        
        return state
    
    workflow.add_node("orchestrator_node", orchestrator_run)
    
    # 진입점
    workflow.set_entry_point("orchestrator_node")
    
    # 조건부 간선 (재시도 시 자기 자신 다시 호출)
    def should_retry(state: WorkflowState) -> str:
        """
        재시도 조건 판단
        
        Args:
            state: 현재 워크플로우 상태
        
        Returns:
            str: 다음 노드 이름 ("orchestrator_node" or "__end__")
        """
        status = state.get("status", "")
        attempt = state.get("attempt", 0)
        max_retries = state.get("max_retries", 3)
        
        # retry 상태이고 최대 재시도 횟수를 넘지 않았으면 재시도
        if status == "retry" and attempt < max_retries:
            logger.info(f"Retrying: attempt={attempt+1}/{max_retries}")
            return "orchestrator_node"
        
        return "__end__"
    
    workflow.add_conditional_edges(
        "orchestrator_node",
        should_retry,
        {
            "orchestrator_node": "orchestrator_node",
            "__end__": "__end__"
        }
    )
    
    # 그래프 컴파일
    return workflow.compile()


async def run_workflow(
    user_input: Dict[str, Any],
    infra: InfraLayer,
    workflow_id: str = None
) -> Dict[str, Any]:
    """
    워크플로우 실행 헬퍼
    
    Args:
        user_input: 사용자 요청
        infra: InfraLayer 인스턴스
        workflow_id: 워크플로우 ID (None이면 자동 생성)
    
    Returns:
        Dict[str, Any]: 최종 워크플로우 상태
    """
    workflow_id = workflow_id or str(uuid4())
    
    # 초기 상태 생성
    initial_state = create_initial_state(
        user_input=user_input,
        workflow_id=workflow_id,
        max_retries=user_input.get("max_retries", 3)
    )
    
    # 워크플로우 빌드
    app = build_workflow(infra)
    
    # 실행
    logger.info(f"Workflow started: workflow_id={workflow_id}")
    
    final_state = await app.ainvoke(initial_state)
    
    logger.info(
        f"Workflow completed",
        extra={
            "workflow_id": workflow_id,
            "status": final_state.get("status"),
            "attempt": final_state.get("attempt", 0)
        }
    )
    
    return final_state

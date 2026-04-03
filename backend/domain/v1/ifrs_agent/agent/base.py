"""Base Node 클래스

모든 노드의 기본 클래스입니다.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from loguru import logger

from ifrs_agent.orchestrator.state import IFRSAgentState


class BaseNode(ABC):
    """노드 기본 클래스
    
    모든 노드는 이 클래스를 상속받아 구현합니다.
    """
    
    def __init__(self, node_name: str, config: Optional[Dict[str, Any]] = None):
        """노드 초기화
        
        Args:
            node_name: 노드 이름
            config: 노드 설정 딕셔너리
        """
        self.node_name = node_name
        self.config = config or {}
        logger.info(f"{node_name} 노드 초기화 완료")
    
    @abstractmethod
    async def process(self, state: IFRSAgentState) -> IFRSAgentState:
        """노드 처리 메인 로직
        
        LangGraph 노드로 사용됩니다.
        상태를 받아서 수정 후 반환합니다.
        
        Args:
            state: IFRSAgentState
            
        Returns:
            수정된 IFRSAgentState
        """
        pass
    
    def _update_state(
        self,
        state: IFRSAgentState,
        status: str,
        current_node: str,
        errors: Optional[list] = None
    ) -> IFRSAgentState:
        """상태 업데이트 헬퍼 메서드"""
        state["status"] = status
        state["current_node"] = current_node
        
        if errors:
            state["errors"].extend(errors)
        
        return state


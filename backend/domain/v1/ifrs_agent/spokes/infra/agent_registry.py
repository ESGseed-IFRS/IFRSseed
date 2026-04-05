"""
에이전트 레지스트리

모든 에이전트를 등록·조회하는 단일 레지스트리
"""
import logging
from typing import Dict, Any, Callable, Awaitable, Optional

logger = logging.getLogger("ifrs_agent.infra.agent_registry")


class AgentRegistry:
    """
    에이전트 레지스트리
    
    에이전트 이름 → 핸들러 함수 매핑 관리
    """
    
    def __init__(self):
        self._registry: Dict[str, Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]] = {}
    
    def register(
        self,
        agent_name: str,
        handler: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ) -> None:
        """
        에이전트 등록
        
        Args:
            agent_name: 에이전트 이름 (예: "c_rag", "dp_rag")
            handler: 비동기 핸들러 함수 (payload → result)
        """
        if agent_name in self._registry:
            logger.warning(f"Agent {agent_name} already registered, overwriting")
        
        self._registry[agent_name] = handler
        logger.info(f"Agent registered: {agent_name}")
    
    def get(self, agent_name: str) -> Optional[Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]]:
        """
        에이전트 조회
        
        Args:
            agent_name: 에이전트 이름
        
        Returns:
            Optional[Callable]: 핸들러 함수 (없으면 None)
        """
        return self._registry.get(agent_name)
    
    def list_agents(self) -> list[str]:
        """
        등록된 모든 에이전트 이름 반환
        
        Returns:
            list[str]: 에이전트 이름 목록
        """
        return list(self._registry.keys())
    
    def unregister(self, agent_name: str) -> None:
        """
        에이전트 등록 해제
        
        Args:
            agent_name: 에이전트 이름
        """
        if agent_name in self._registry:
            del self._registry[agent_name]
            logger.info(f"Agent unregistered: {agent_name}")

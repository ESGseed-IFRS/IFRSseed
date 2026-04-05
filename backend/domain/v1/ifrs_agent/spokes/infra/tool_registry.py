"""
툴 레지스트리

모든 툴(DB 쿼리, 임베딩 등)을 등록·조회하는 단일 레지스트리
"""
import logging
from typing import Dict, Any, Callable, Awaitable, Optional

logger = logging.getLogger("ifrs_agent.infra.tool_registry")


class ToolRegistry:
    """
    툴 레지스트리
    
    툴 이름 → 핸들러 함수 매핑 관리
    """
    
    def __init__(self):
        self._registry: Dict[str, Callable[[Dict[str, Any]], Awaitable[Any]]] = {}
    
    def register(
        self,
        tool_name: str,
        handler: Callable[[Dict[str, Any]], Awaitable[Any]]
    ) -> None:
        """
        툴 등록
        
        Args:
            tool_name: 툴 이름 (예: "query_sr_body_exact", "embed_text")
            handler: 비동기 핸들러 함수 (params → result)
        """
        if tool_name in self._registry:
            logger.warning(f"Tool {tool_name} already registered, overwriting")
        
        self._registry[tool_name] = handler
        logger.info(f"Tool registered: {tool_name}")
    
    def get(self, tool_name: str) -> Optional[Callable[[Dict[str, Any]], Awaitable[Any]]]:
        """
        툴 조회
        
        Args:
            tool_name: 툴 이름
        
        Returns:
            Optional[Callable]: 핸들러 함수 (없으면 None)
        """
        return self._registry.get(tool_name)
    
    def list_tools(self) -> list[str]:
        """
        등록된 모든 툴 이름 반환
        
        Returns:
            list[str]: 툴 이름 목록
        """
        return list(self._registry.keys())
    
    def unregister(self, tool_name: str) -> None:
        """
        툴 등록 해제
        
        Args:
            tool_name: 툴 이름
        """
        if tool_name in self._registry:
            del self._registry[tool_name]
            logger.info(f"Tool unregistered: {tool_name}")

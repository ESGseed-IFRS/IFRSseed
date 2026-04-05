"""
Infra Layer - in-process MCP 추상

모든 에이전트·툴 호출의 단일 진입점
"""
import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from .agent_registry import AgentRegistry
from .tool_registry import ToolRegistry

logger = logging.getLogger("ifrs_agent.infra")


class InfraLayer:
    """
    인프라 레이어
    
    오케스트레이터와 에이전트 간 통신을 중재하는 in-process MCP 추상
    - 에이전트·툴 레지스트리 관리
    - 타임아웃·재시도·로깅·권한 통일
    """
    
    def __init__(
        self,
        agent_registry: Optional[AgentRegistry] = None,
        tool_registry: Optional[ToolRegistry] = None,
        default_timeout: int = 30,
        max_retries: int = 3
    ):
        """
        Args:
            agent_registry: 에이전트 레지스트리 (None이면 새로 생성)
            tool_registry: 툴 레지스트리 (None이면 새로 생성)
            default_timeout: 기본 타임아웃 (초)
            max_retries: 최대 재시도 횟수
        """
        self.agent_registry = agent_registry or AgentRegistry()
        self.tool_registry = tool_registry or ToolRegistry()
        self.default_timeout = default_timeout
        self.max_retries = max_retries
    
    async def call_agent(
        self,
        agent_name: str,
        action: str,
        payload: Dict[str, Any],
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        에이전트 호출 (타임아웃·로깅·에러 처리 포함)
        
        Args:
            agent_name: 에이전트 이름 (예: "c_rag")
            action: 액션 이름 (예: "collect") - 현재는 미사용, 향후 확장용
            payload: 에이전트 입력 페이로드
            timeout: 타임아웃 (초, None이면 default_timeout 사용)
        
        Returns:
            Dict[str, Any]: 에이전트 응답
        
        Raises:
            ValueError: 에이전트가 등록되지 않음
            asyncio.TimeoutError: 타임아웃 초과
        """
        start_time = datetime.utcnow()
        timeout = timeout or self.default_timeout
        
        logger.info(
            f"call_agent started",
            extra={
                "agent_name": agent_name,
                "action": action,
                "timeout": timeout
            }
        )
        
        # 에이전트 조회
        handler = self.agent_registry.get(agent_name)
        if not handler:
            raise ValueError(f"Agent not found: {agent_name}")
        
        try:
            # 타임아웃 적용
            result = await asyncio.wait_for(
                handler(payload),
                timeout=timeout
            )
            
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.info(
                f"call_agent success",
                extra={
                    "agent_name": agent_name,
                    "action": action,
                    "elapsed_ms": elapsed_ms
                }
            )
            
            return result
        
        except asyncio.TimeoutError:
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.error(
                f"call_agent timeout",
                extra={
                    "agent_name": agent_name,
                    "action": action,
                    "timeout": timeout,
                    "elapsed_ms": elapsed_ms
                }
            )
            raise
        
        except Exception as e:
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.error(
                f"call_agent failed: {e}",
                extra={
                    "agent_name": agent_name,
                    "action": action,
                    "elapsed_ms": elapsed_ms,
                    "error": str(e)
                },
                exc_info=True
            )
            raise
    
    async def call_tool(
        self,
        tool_name: str,
        params: Dict[str, Any],
        timeout: Optional[int] = None
    ) -> Any:
        """
        툴 호출 (타임아웃·로깅·에러 처리 포함)
        
        Args:
            tool_name: 툴 이름 (예: "query_sr_body_exact")
            params: 툴 입력 파라미터
            timeout: 타임아웃 (초, None이면 default_timeout 사용)
        
        Returns:
            Any: 툴 응답
        
        Raises:
            ValueError: 툴이 등록되지 않음
            asyncio.TimeoutError: 타임아웃 초과
        """
        start_time = datetime.utcnow()
        timeout = timeout or self.default_timeout
        
        logger.debug(
            f"call_tool started",
            extra={
                "tool_name": tool_name,
                "timeout": timeout
            }
        )
        
        # 툴 조회
        handler = self.tool_registry.get(tool_name)
        if not handler:
            raise ValueError(f"Tool not found: {tool_name}")
        
        try:
            # 타임아웃 적용
            result = await asyncio.wait_for(
                handler(params),
                timeout=timeout
            )
            
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.debug(
                f"call_tool success",
                extra={
                    "tool_name": tool_name,
                    "elapsed_ms": elapsed_ms
                }
            )
            
            return result
        
        except asyncio.TimeoutError:
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.error(
                f"call_tool timeout",
                extra={
                    "tool_name": tool_name,
                    "timeout": timeout,
                    "elapsed_ms": elapsed_ms
                }
            )
            raise
        
        except Exception as e:
            elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.error(
                f"call_tool failed: {e}",
                extra={
                    "tool_name": tool_name,
                    "elapsed_ms": elapsed_ms,
                    "error": str(e)
                },
                exc_info=True
            )
            raise

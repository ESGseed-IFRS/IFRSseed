"""MCP Client (루즈 커플링)

FastMCP를 사용한 Tool Calling을 위한 클라이언트 레이어입니다.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from loguru import logger
import asyncio

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    logger.warning("MCP가 설치되지 않았습니다. pip install mcp 필요")


class MCPClientInterface(ABC):
    """MCP 클라이언트 인터페이스 (루즈 커플링)"""
    
    @abstractmethod
    async def call_tool(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """도구 호출"""
        pass
    
    @abstractmethod
    async def list_tools(self) -> List[Dict[str, Any]]:
        """사용 가능한 도구 목록"""
        pass


class FastMCPClient(MCPClientInterface):
    """FastMCP 클라이언트 구현"""
    
    def __init__(self, server_config: Dict[str, Any]):
        """MCP 클라이언트 초기화
        
        Args:
            server_config: MCP 서버 설정
                {
                    "name": "dart_tool_server",
                    "command": "python",
                    "args": ["-m", "tools.dart_server"],
                    "env": {...}
                }
        """
        self.server_config = server_config
        self.session: Optional[ClientSession] = None
        self._available_tools: List[Dict[str, Any]] = []
        self._connected = False
    
    async def connect(self):
        """MCP 서버 연결"""
        if not MCP_AVAILABLE:
            raise ImportError("MCP가 설치되지 않았습니다. pip install mcp 필요")
        
        if self._connected and self.session:
            return
        
        try:
            server_params = StdioServerParameters(
                command=self.server_config["command"],
                args=self.server_config.get("args", []),
                env=self.server_config.get("env", {})
            )
            
            # 비동기 연결 (실제로는 stdio_client를 사용)
            # Note: 실제 구현은 MCP 라이브러리 버전에 따라 다를 수 있음
            # 여기서는 간단한 래퍼로 구현
            self._server_params = server_params
            self._connected = True
            
            # 도구 목록 조회는 실제 연결 시 수행
            logger.info(f"MCP 서버 설정 완료: {self.server_config.get('name', 'unknown')}")
            
        except Exception as e:
            logger.error(f"MCP 서버 연결 실패: {e}")
            raise
    
    async def _ensure_connected(self):
        """연결 확인 및 연결"""
        if not self._connected:
            await self.connect()
        
        # 실제 세션은 필요 시 생성 (지연 로딩)
        if self.session is None:
            # MCP 클라이언트는 실제로는 stdio를 통해 통신
            # 여기서는 간단한 구현으로 대체
            pass
    
    async def call_tool(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """도구 호출"""
        await self._ensure_connected()
        
        # 실제 MCP 호출은 서버 프로세스와 통신
        # 여기서는 HTTP 또는 stdio를 통해 통신
        # 간단한 구현: 서버 프로세스와 통신하는 로직
        
        try:
            # MCP 프로토콜에 따른 Tool 호출
            # 실제 구현은 MCP 라이브러리 API에 따라 다름
            result = await self._execute_tool_call(tool_name, params)
            return {
                "content": result,
                "is_error": False
            }
        except Exception as e:
            logger.error(f"MCP Tool '{tool_name}' 호출 실패: {e}")
            return {
                "content": f"Tool 호출 실패: {str(e)}",
                "is_error": True
            }
    
    async def _execute_tool_call(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Any:
        """실제 Tool 호출 실행
        
        Note: 실제 구현은 MCP 서버와의 통신 방식에 따라 달라집니다.
        여기서는 플레이스홀더로 구현합니다.
        """
        # 실제로는 MCP 서버 프로세스와 통신
        # 예: subprocess를 통한 stdio 통신 또는 HTTP 통신
        raise NotImplementedError("MCP Tool 호출은 서버 구현에 따라 달라집니다")
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """사용 가능한 도구 목록"""
        await self._ensure_connected()
        
        if self._available_tools:
            return self._available_tools
        
        try:
            # MCP 서버에서 도구 목록 조회
            # 실제 구현은 MCP 라이브러리 API에 따라 다름
            tools = await self._fetch_tools_from_server()
            self._available_tools = tools
            return tools
        except Exception as e:
            logger.error(f"MCP 도구 목록 조회 실패: {e}")
            return []
    
    async def _fetch_tools_from_server(self) -> List[Dict[str, Any]]:
        """서버에서 도구 목록 가져오기"""
        # 실제 구현은 MCP 서버와의 통신 방식에 따라 달라집니다
        raise NotImplementedError("MCP 도구 목록 조회는 서버 구현에 따라 달라집니다")


class MCPClientManager:
    """MCP 클라이언트 관리자 (싱글톤)"""
    
    _instance = None
    _clients: Dict[str, FastMCPClient] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def register_client(self, name: str, config: Dict[str, Any]):
        """MCP 클라이언트 등록"""
        if not MCP_AVAILABLE:
            logger.warning(f"MCP가 설치되지 않아 클라이언트 '{name}'를 등록할 수 없습니다")
            return
        
        self._clients[name] = FastMCPClient(config)
        logger.info(f"MCP 클라이언트 등록: {name}")
    
    async def get_client(self, name: str) -> FastMCPClient:
        """MCP 클라이언트 조회"""
        if name not in self._clients:
            raise ValueError(f"MCP 클라이언트 '{name}'가 등록되지 않았습니다")
        
        client = self._clients[name]
        await client.connect()
        return client
    
    async def call_tool(
        self,
        server_name: str,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """도구 호출 (편의 메서드)"""
        client = await self.get_client(server_name)
        return await client.call_tool(tool_name, params)
    
    def list_registered_clients(self) -> List[str]:
        """등록된 클라이언트 목록"""
        return list(self._clients.keys())


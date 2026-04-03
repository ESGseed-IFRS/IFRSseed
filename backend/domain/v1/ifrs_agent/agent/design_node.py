"""Design Recommendation Node (디자인 추천)

브랜드 디자이너 페르소나로 동작하며, 기업 BI/CI를 반영한 시각화 가이드를 제공합니다.
"""
from typing import Dict, List, Any, Optional
from loguru import logger

from ifrs_agent.agent.base import BaseNode
from ifrs_agent.orchestrator.state import IFRSAgentState


class DesignNode(BaseNode):
    """Design Node (디자인 추천)
    
    기업 BI 컬러/스타일 분석 및 IFRS 구조에 맞는 차트 타입 추천.
    
    TODO: 실제 구현 시
    - Llama 3.3 70B (Groq) 사용
    - 기업 BI 추출
    - 경쟁사 분석
    - 디자인 가이드 생성
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Design Node 초기화"""
        super().__init__("design_node", config)
        
        # TODO: 실제 구현 시
        # self.llm = ChatGroq(...)
        # self.competitor_analyzer = CompetitorAnalyzer()
        
        logger.info("Design Node 초기화 완료 (더미 모드)")
    
    async def process(self, state: IFRSAgentState) -> IFRSAgentState:
        """디자인 추천 생성"""
        logger.info("Design Node: 디자인 추천 시작")
        
        try:
            # TODO: 실제 구현 시
            # 1. 기업 BI 추출
            # 2. 경쟁사 분석
            # 3. 섹션별 디자인 추천 생성
            
            # 더미 디자인 추천
            design_recommendations = []
            for section in state.get("generated_sections", []):
                recommendation = self._create_dummy_recommendation(section)
                design_recommendations.append(recommendation)
            
            # 상태에 저장 (필요시)
            if "design_recommendations" not in state:
                state["design_recommendations"] = design_recommendations
            
            state["current_node"] = "designing"
            state["status"] = "designing"
            
            logger.info(f"Design Node: {len(design_recommendations)}개 디자인 추천 생성 완료")
            
        except Exception as e:
            logger.error(f"Design Node 처리 중 에러: {e}")
            state["errors"].append(f"Design Node 실패: {str(e)}")
            state["status"] = "error"
        
        return state
    
    def _create_dummy_recommendation(
        self,
        section: Dict[str, Any]
    ) -> Dict[str, Any]:
        """더미 디자인 추천 생성"""
        return {
            "section_id": section.get("section_id", "unknown"),
            "chart_type": "bar_chart",
            "color_scheme": {
                "primary": "#0066CC",
                "secondary": "#003366",
                "accent": "#FFD700"
            },
            "rationale": "더미 디자인 추천입니다. 실제 Design Node 구현이 필요합니다.",
            "brand_alignment": "기본 컬러 스킴 사용",
            "competitor_insight": "경쟁사 분석 미구현"
        }


# ============================================
# MCP Server 기능 (통합)
# ============================================

try:
    from mcp.server.fastmcp import FastMCP
    MCP_SERVER_AVAILABLE = True
except ImportError:
    MCP_SERVER_AVAILABLE = False

# MCP 서버 인스턴스 (선택적)
_mcp_server: Optional[FastMCP] = None
_design_node_instance: Optional[DesignNode] = None


def get_design_node_instance() -> Optional[DesignNode]:
    """Design Node 인스턴스 가져오기 (싱글톤, MCP 서버용)"""
    global _design_node_instance
    if _design_node_instance is None:
        try:
            _design_node_instance = DesignNode()
            logger.info("Design Node 인스턴스 생성 완료 (MCP 서버용)")
        except Exception as e:
            logger.warning(f"Design Node 초기화 실패: {e} (선택적 노드)")
            return None
    return _design_node_instance


def get_mcp_server() -> Optional[FastMCP]:
    """MCP 서버 인스턴스 가져오기"""
    global _mcp_server
    if not MCP_SERVER_AVAILABLE:
        return None
    
    if _mcp_server is None:
        _mcp_server = FastMCP("Design Node Server")
        
        @_mcp_server.tool()
        async def process(
            state: Dict[str, Any],
            instruction: Optional[str] = None
        ) -> Dict[str, Any]:
            """Design Node 처리 (MCP Tool)
            
            Supervisor로부터 받은 State를 처리하고 디자인 추천을 추가하여 반환합니다.
            
            Args:
                state: IFRSAgentState 딕셔너리
                instruction: Supervisor의 지시사항 (선택적)
            
            Returns:
                수정된 IFRSAgentState 딕셔너리
            """
            design_node = get_design_node_instance()
            if design_node is None:
                return {
                    "state": state,
                    "success": False,
                    "error": "Design Node 인스턴스를 생성할 수 없습니다"
                }
            
            try:
                # instruction이 있으면 state에 추가
                if instruction:
                    state["instruction"] = instruction
                
                # Design Node 처리
                result_state = await design_node.process(state)
                
                # Dict로 변환하여 반환
                return {
                    "state": result_state,
                    "success": True,
                    "status": result_state.get("status", "unknown")
                }
                
            except Exception as e:
                logger.error(f"Design Node 처리 실패: {e}")
                import traceback
                traceback.print_exc()
                
                # Design Node 실패는 치명적이지 않으므로 원본 state 반환
                return {
                    "state": state,
                    "success": False,
                    "error": str(e),
                    "warning": "Design Node 실패는 치명적이지 않으므로 계속 진행됩니다"
                }
        
        @_mcp_server.tool()
        async def get_status() -> Dict[str, Any]:
            """Design Node 상태 조회 (MCP Tool)
            
            Returns:
                Design Node의 현재 상태 정보
            """
            design_node = get_design_node_instance()
            if design_node is None:
                return {
                    "status": "unavailable",
                    "error": "Design Node 인스턴스를 생성할 수 없습니다"
                }
            
            try:
                return {
                    "status": "ready",
                    "model": design_node.llm.model_name if hasattr(design_node, 'llm') else "unknown"
                }
            except Exception as e:
                return {
                    "status": "error",
                    "error": str(e)
                }
        
        logger.info("Design Node MCP 서버 초기화 완료")
    
    return _mcp_server


# MCP 서버 실행 진입점
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--mcp":
        # MCP 서버 모드로 실행
        server = get_mcp_server()
        if server:
            logger.info("Design Node MCP 서버 시작...")
            server.run()
        else:
            print("⚠️ MCP가 설치되지 않았습니다. pip install mcp 필요")
            sys.exit(1)
    else:
        # 일반 모듈로 실행 (테스트 등)
        print("Design Node 모듈입니다.")
        print("MCP 서버로 실행하려면: python -m ifrs_agent.agent.design_node --mcp")

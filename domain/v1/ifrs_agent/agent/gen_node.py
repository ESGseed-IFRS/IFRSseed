"""Gen Node (문단 생성)

전문 작가 페르소나로 동작하며, IFRS 문체로 보고서 문단을 생성합니다.
"""
from typing import Dict, List, Any, Optional
from loguru import logger

from ifrs_agent.agent.base import BaseNode
from ifrs_agent.orchestrator.state import IFRSAgentState


class GenNode(BaseNode):
    """Gen Node (문단 생성)
    
    팩트 시트를 기반으로 IFRS 문체의 문단을 생성합니다.
    
    TODO: 실제 구현 시
    - EXAONE 3.0 7.8B LoRA 모델 로드
    - IFRS 문체 프롬프트 구성
    - 재무 연결성 강조
    - 시계열 분석 및 추세 설명
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Gen Node 초기화"""
        super().__init__("gen_node", config)
        
        # TODO: 실제 구현 시
        # self.model = self._load_lora_model(config.get("model_path"))
        # self.tokenizer = self._load_tokenizer(config.get("model_path"))
        
        logger.info("Gen Node 초기화 완료 (더미 모드)")
    
    async def process(self, state: IFRSAgentState) -> IFRSAgentState:
        """문단 생성 메인 로직"""
        logger.info("Gen Node: 문단 생성 시작")
        
        try:
            generated_sections = []
            
            # 팩트 시트가 없으면 더미 섹션 생성
            if not state.get("fact_sheets"):
                logger.warning("Gen Node: 팩트 시트가 없어 더미 섹션 생성")
                generated_sections = [self._create_dummy_section()]
            else:
                # TODO: 실제 구현 시
                # 섹션별 문단 생성
                for fact_sheet in state.get("fact_sheets", []):
                    section = await self._generate_section(fact_sheet, state)
                    generated_sections.append(section)
            
            state["generated_sections"] = generated_sections
            state["current_node"] = "generating"
            state["status"] = "generating"
            
            logger.info(f"Gen Node: {len(generated_sections)}개 섹션 생성 완료")
            
        except Exception as e:
            logger.error(f"Gen Node 처리 중 에러: {e}")
            state["errors"].append(f"Gen Node 실패: {str(e)}")
            state["status"] = "error"
        
        return state
    
    async def _generate_section(
        self,
        fact_sheet: Dict[str, Any],
        state: IFRSAgentState
    ) -> Dict[str, Any]:
        """섹션 생성 (더미 구현)"""
        # TODO: 실제 구현 시
        # 1. IFRS 문체 프롬프트 구성
        # 2. LoRA 모델로 문단 생성
        # 3. 재무 연결성 추출
        # 4. 근거 주석 추가
        
        return {
            "section_id": fact_sheet.get("dp_id", "unknown"),
            "section_name": fact_sheet.get("dp_name", "Unknown Section"),
            "content": f"""
            {fact_sheet.get('dp_name', 'Data Point')}에 대한 정보입니다.
            
            연도별 값:
            - 2022: {fact_sheet.get('values', {}).get(2022, 'N/A')} {fact_sheet.get('unit', '')}
            - 2023: {fact_sheet.get('values', {}).get(2023, 'N/A')} {fact_sheet.get('unit', '')}
            - 2024: {fact_sheet.get('values', {}).get(2024, 'N/A')} {fact_sheet.get('unit', '')}
            
            출처: {fact_sheet.get('source', 'unknown')}
            """,
            "sources": [fact_sheet.get("source", "unknown")],
            "referenced_dps": [fact_sheet.get("dp_id", "")],
            "financial_linkage": "재무 연결성 정보 (더미)",
            "suggested_visuals": ["bar_chart", "line_chart"]
        }
    
    def _create_dummy_section(self) -> Dict[str, Any]:
        """더미 섹션 생성"""
        return {
            "section_id": "dummy_section",
            "section_name": "더미 섹션",
            "content": "이것은 더미 섹션입니다. 실제 Gen Node 구현이 필요합니다.",
            "sources": [],
            "referenced_dps": [],
            "financial_linkage": "",
            "suggested_visuals": []
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
_gen_node_instance: Optional[GenNode] = None


def get_gen_node_instance() -> GenNode:
    """Gen Node 인스턴스 가져오기 (싱글톤, MCP 서버용)"""
    global _gen_node_instance
    if _gen_node_instance is None:
        try:
            _gen_node_instance = GenNode()
            logger.info("Gen Node 인스턴스 생성 완료 (MCP 서버용)")
        except Exception as e:
            logger.error(f"Gen Node 초기화 실패: {e}")
            raise
    return _gen_node_instance


def get_mcp_server() -> Optional[FastMCP]:
    """MCP 서버 인스턴스 가져오기"""
    global _mcp_server
    if not MCP_SERVER_AVAILABLE:
        return None
    
    if _mcp_server is None:
        _mcp_server = FastMCP("Gen Node Server")
        
        @_mcp_server.tool()
        async def process(
            state: Dict[str, Any],
            instruction: Optional[str] = None
        ) -> Dict[str, Any]:
            """Gen Node 처리 (MCP Tool)
            
            Supervisor로부터 받은 State를 처리하고 생성된 섹션을 추가하여 반환합니다.
            
            Args:
                state: IFRSAgentState 딕셔너리
                instruction: Supervisor의 지시사항 (선택적)
            
            Returns:
                수정된 IFRSAgentState 딕셔너리
            """
            try:
                node = get_gen_node_instance()
                
                # instruction이 있으면 state에 추가
                if instruction:
                    state["instruction"] = instruction
                
                # Gen Node 처리
                result_state = await node.process(state)
                
                # Dict로 변환하여 반환
                return {
                    "state": result_state,
                    "success": True,
                    "sections_count": len(result_state.get("generated_sections", [])),
                    "status": result_state.get("status", "unknown")
                }
                
            except Exception as e:
                logger.error(f"Gen Node 처리 실패: {e}")
                import traceback
                traceback.print_exc()
                
                # 에러 발생 시 원본 state에 에러 추가
                state["errors"] = state.get("errors", [])
                state["errors"].append(f"Gen Node 처리 실패: {str(e)}")
                state["status"] = "error"
                
                return {
                    "state": state,
                    "success": False,
                    "error": str(e)
                }
        
        @_mcp_server.tool()
        async def get_status() -> Dict[str, Any]:
            """Gen Node 상태 조회 (MCP Tool)
            
            Returns:
                Gen Node의 현재 상태 정보
            """
            try:
                node = get_gen_node_instance()
                return {
                    "status": "ready",
                    "model": node.llm.model_name if hasattr(node, 'llm') else "unknown"
                }
            except Exception as e:
                return {
                    "status": "error",
                    "error": str(e)
                }
        
        logger.info("Gen Node MCP 서버 초기화 완료")
    
    return _mcp_server


# MCP 서버 실행 진입점
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--mcp":
        # MCP 서버 모드로 실행
        server = get_mcp_server()
        if server:
            logger.info("Gen Node MCP 서버 시작...")
            server.run()
        else:
            print("⚠️ MCP가 설치되지 않았습니다. pip install mcp 필요")
            sys.exit(1)
    else:
        # 일반 모듈로 실행 (테스트 등)
        print("Gen Node 모듈입니다.")
        print("MCP 서버로 실행하려면: python -m ifrs_agent.agent.gen_node --mcp")

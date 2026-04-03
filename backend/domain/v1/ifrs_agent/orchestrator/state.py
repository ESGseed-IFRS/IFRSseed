"""LangGraph 상태 정의

IFRSAgentState는 워크플로우 전체에서 공유되는 상태를 정의합니다.
"""
from typing import TypedDict, List, Dict, Any, Optional
from datetime import datetime


class IFRSAgentState(TypedDict):
    """IFRS 에이전트 워크플로우 공유 상태"""
    
    # 입력 정보
    query: str                              # 사용자 쿼리
    documents: List[str]                    # 업로드된 문서 경로
    target_standards: List[str]            # 대상 기준서 (IFRS_S1, IFRS_S2 등)
    fiscal_year: int                        # 회계연도
    company_id: str                         # 기업 식별자
    
    # 처리 상태
    current_node: str                       # 현재 실행 중인 노드
    iteration_count: int                    # 반복 횟수 (재시도 추적)
    status: str                             # 워크플로우 상태 (initialized, analyzing, retrieving, etc.)
    
    # 추출 데이터
    target_dps: List[str]                   # 필요한 DP 목록 (Supervisor가 식별)
    fact_sheets: List[Dict[str, Any]]      # 추출된 팩트 시트 (RAG Node 출력)
    yearly_data: Dict[int, Dict[str, Any]] # 연도별 데이터 (2022, 2023, 2024)
    
    # 생성 결과
    generated_sections: List[Dict[str, Any]]  # 생성된 섹션들 (Gen Node 출력)
    
    # 검증 결과
    validation_results: List[Dict[str, Any]]  # 검증 결과 목록 (Validation Node 출력)
    
    # 기업 아이덴티티
    corporate_identity: Dict[str, Any]     # 컬러, 스타일 등 (Design Node용)
    
    # 메타 정보
    reference_sources: List[str]           # 참조 출처 목록
    audit_log: List[Dict[str, Any]]       # 감사 로그 (모든 결정 기록)
    errors: List[str]                      # 에러 목록
    
    # Supervisor 지시사항 (선택적)
    instruction: Optional[str]             # Supervisor가 노드에 전달하는 지시사항
    
    # MCP Tool 결과 (선택적)
    mcp_tool_results: List[Dict[str, Any]]  # MCP Tool 호출 결과
    external_data_sources: List[Dict[str, Any]]  # 외부 데이터 출처 정보


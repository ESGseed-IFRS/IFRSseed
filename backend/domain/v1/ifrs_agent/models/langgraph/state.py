"""
LangGraph 워크플로우 상태 정의
"""
from typing import TypedDict, Optional, List, Dict, Any
from datetime import datetime


class WorkflowState(TypedDict, total=False):
    """
    IFRS 에이전트 워크플로우 전역 상태
    
    LangGraph가 관리하는 상태 컨테이너로, 오케스트레이터와 에이전트 간 데이터 전달에 사용
    """
    # 사용자 입력
    user_input: Dict[str, Any]  # action, company_id, category, dp_id 등
    
    # Phase 1: 데이터 수집 결과
    ref_data: Dict[str, Any]  # c_rag 결과 (SR 본문·이미지)
    fact_data: Dict[str, Any]  # dp_rag 결과 (정량: 실데이터, 정성: DP 기준·설명) — 레거시, 단일 DP
    fact_data_by_dp: Dict[str, Dict[str, Any]]  # Phase 1: 다중 DP 결과 {dp_id: fact_data}
    agg_data: Dict[str, Any]  # aggregation_node 결과 (계열사·외부 기업)
    
    # Phase 2: 병합된 데이터
    merged_data: Dict[str, Any]  # gen_node 입력용 통합 데이터 (레거시)
    gen_input: Dict[str, Any]  # Phase 2 필터링 후 gen_node에 전달된 페이로드 (dp_data_list 포함)
    data_selection: Dict[str, Any]  # LLM/규칙 기반 데이터 선택 결과 (include_* 플래그, rationale)
    
    # Phase 3: 생성·검증
    generated_text: str  # gen_node 출력 (생성된 SR 본문)
    validation: Dict[str, Any]  # validator_node 출력 (검증 결과)
    feedback: Optional[List[str]]  # validator 피드백 (재시도용)
    
    # 워크플로우 제어
    status: str  # "pending", "in_progress", "retry", "success", "failed", "max_retries_exceeded"
    attempt: int  # 현재 재시도 횟수 (0부터 시작)
    max_retries: int  # 최대 재시도 횟수 (기본 3)
    
    # Phase 0 (프롬프트 해석)
    prompt_interpretation: Dict[str, Any]  # search_intent, content_focus, ref_pages 등

    # 메타데이터
    workflow_id: str  # 워크플로우 실행 ID
    created_at: datetime  # 워크플로우 시작 시각
    updated_at: datetime  # 마지막 업데이트 시각
    mode: str  # "draft" or "refine"
    
    # 에러 처리
    error: Optional[str]  # 에러 메시지
    error_stack: Optional[str]  # 에러 스택 트레이스

    # Phase 1.5 (상위 DP → 하위 선택 유도)
    dp_selection_required: Optional[List[Dict[str, Any]]]


class AgentResponse(TypedDict, total=False):
    """
    에이전트 응답 표준 구조
    
    모든 에이전트(c_rag, dp_rag, aggregation_node, gen_node, validator_node)가
    반환하는 응답의 공통 구조
    """
    success: bool
    data: Dict[str, Any]
    error: Optional[str]
    metadata: Dict[str, Any]  # elapsed_ms, agent_name 등


class OrchestratorConfig(TypedDict, total=False):
    """
    오케스트레이터 설정
    """
    max_retries: int  # 최대 재시도 횟수 (기본 3)
    timeout_seconds: int  # 전체 워크플로우 타임아웃 (기본 300초)
    parallel_timeout_seconds: int  # 병렬 수집 타임아웃 (기본 60초)
    enable_logging: bool  # 로깅 활성화 (기본 True)
    enable_checkpointing: bool  # 체크포인팅 활성화 (기본 True)


def create_initial_state(
    user_input: Dict[str, Any],
    workflow_id: str,
    max_retries: int = 3
) -> WorkflowState:
    """
    초기 워크플로우 상태 생성
    
    Args:
        user_input: 사용자 요청 (action, company_id, category 등)
        workflow_id: 워크플로우 실행 ID
        max_retries: 최대 재시도 횟수
    
    Returns:
        WorkflowState: 초기화된 워크플로우 상태
    """
    now = datetime.utcnow()
    
    return WorkflowState(
        user_input=user_input,
        ref_data={},
        fact_data={},
        fact_data_by_dp={},
        agg_data={},
        merged_data={},
        gen_input={},
        data_selection={},
        generated_text="",
        validation={},
        feedback=None,
        status="pending",
        attempt=0,
        max_retries=max_retries,
        prompt_interpretation={},
        workflow_id=workflow_id,
        created_at=now,
        updated_at=now,
        mode=user_input.get("action", "create"),
        error=None,
        error_stack=None
    )


def update_state(state: WorkflowState, **kwargs) -> WorkflowState:
    """
    워크플로우 상태 업데이트 헬퍼
    
    Args:
        state: 기존 상태
        **kwargs: 업데이트할 필드
    
    Returns:
        WorkflowState: 업데이트된 상태
    """
    updated = state.copy()
    updated.update(kwargs)
    updated["updated_at"] = datetime.utcnow()
    return updated

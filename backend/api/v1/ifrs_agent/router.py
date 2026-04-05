"""
IFRS Agent API 라우터

IFRS 지속가능성 보고서 생성 워크플로우 API
"""
import logging
from typing import Dict, Any, Optional, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from backend.domain.v1.ifrs_agent.hub.bootstrap import get_infra
from backend.domain.v1.ifrs_agent.models.langgraph import run_workflow

logger = logging.getLogger("ifrs_agent.api")

router = APIRouter(prefix="/ifrs-agent", tags=["IFRS Agent"])


def _build_create_references(final_state: Dict[str, Any]) -> Dict[str, Any]:
    """카테고리 c_rag(sr_data) + dp_rag(fact_data: 정량 실데이터 또는 정성 기준) + agg."""
    ref = final_state.get("ref_data") or {}
    sr_pages: List[Any] = []
    if isinstance(ref, dict):
        sr_pages = [
            ref.get("2024", {}).get("page_number") if isinstance(ref.get("2024"), dict) else None,
            ref.get("2023", {}).get("page_number") if isinstance(ref.get("2023"), dict) else None,
        ]
    return {
        "sr_pages": sr_pages,
        "sr_data": ref if isinstance(ref, dict) else {},
        "fact_data": final_state.get("fact_data", {}),
        "agg_data": final_state.get("agg_data", {}),
    }


# ===== Request/Response Models =====

class CreateReportRequest(BaseModel):
    """SR 초안 생성 요청"""
    company_id: str = Field(..., description="기업 ID")
    category: str = Field(..., description="카테고리 (예: '재생에너지')")
    dp_id: Optional[str] = Field(None, description="Data Point ID (선택)")
    max_retries: int = Field(3, ge=1, le=5, description="최대 재시도 횟수")


class RefineReportRequest(BaseModel):
    """SR 수정 요청"""
    report_id: str = Field(..., description="보고서 ID")
    page_number: int = Field(..., ge=1, description="페이지 번호")
    user_instruction: str = Field(..., description="사용자 수정 지시사항")


class WorkflowResponse(BaseModel):
    """워크플로우 실행 결과"""
    workflow_id: str = Field(..., description="워크플로우 실행 ID")
    status: str = Field(..., description="상태 (success, failed, max_retries_exceeded)")
    generated_text: str = Field("", description="생성된 SR 본문")
    validation: Dict[str, Any] = Field(default_factory=dict, description="검증 결과")
    references: Dict[str, Any] = Field(default_factory=dict, description="참조 데이터")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="메타데이터")
    error: Optional[str] = Field(None, description="에러 메시지")


class WorkflowStatusResponse(BaseModel):
    """워크플로우 상태 조회 결과"""
    workflow_id: str
    status: str
    created_at: str
    updated_at: str
    attempt: int
    max_retries: int


class HealthCheckResponse(BaseModel):
    """헬스체크 응답"""
    status: str = "ok"
    agents: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)


# ===== Endpoints =====

@router.get("/health", response_model=HealthCheckResponse, summary="헬스체크")
async def health_check():
    """
    IFRS Agent 헬스체크
    
    - 등록된 에이전트 및 툴 목록 반환
    """
    try:
        infra = get_infra()
        
        return HealthCheckResponse(
            status="ok",
            agents=infra.agent_registry.list_agents(),
            tools=infra.tool_registry.list_tools()
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/create", response_model=WorkflowResponse, summary="SR 초안 생성")
async def create_report(request: CreateReportRequest = Body(...)):
    """
    SR 초안 생성 워크플로우 실행
    
    **워크플로우**:
    1. Phase 1: 병렬 데이터 수집 (c_rag, dp_rag, aggregation_node)
    2. Phase 2: 데이터 병합
    3. Phase 3: 생성-검증 반복 루프 (최대 max_retries회)
    4. Phase 4: 최종 반환
    
    **Parameters**:
    - `company_id`: 기업 ID
    - `category`: 카테고리 (예: "재생에너지")
    - `dp_id`: Data Point ID (선택)
    - `max_retries`: 최대 재시도 횟수 (기본 3)
    
    **Returns**:
    - `workflow_id`: 워크플로우 실행 ID
    - `status`: "success" | "failed" | "max_retries_exceeded"
    - `generated_text`: 생성된 SR 본문
    - `validation`: 검증 결과
    - `references`: 참조 데이터 (SR 페이지, 계열사 데이터, 팩트 데이터)
    - `metadata`: 메타데이터 (재시도 횟수, 외부 기업 스냅샷 사용 여부 등)
    """
    workflow_id = str(uuid4())
    
    logger.info(
        f"Create report started: workflow_id={workflow_id}, company_id={request.company_id}, category={request.category}"
    )
    
    try:
        # Infra 레이어 초기화
        infra = get_infra()
        
        # 사용자 입력 구성
        user_input = {
            "action": "create",
            "company_id": request.company_id,
            "category": request.category,
            "dp_id": request.dp_id,
            "max_retries": request.max_retries
        }
        
        # 워크플로우 실행
        final_state = await run_workflow(
            user_input=user_input,
            infra=infra,
            workflow_id=workflow_id
        )
        
        # 응답 구성
        response = WorkflowResponse(
            workflow_id=workflow_id,
            status=final_state.get("status", "failed"),
            generated_text=final_state.get("generated_text", ""),
            validation=final_state.get("validation", {}),
            references=_build_create_references(final_state),
            metadata={
                "attempts": final_state.get("attempt", 0) + 1,
                "max_retries": final_state.get("max_retries", 3),
                "mode": final_state.get("mode", "draft"),
                "created_at": str(final_state.get("created_at", "")),
                "updated_at": str(final_state.get("updated_at", ""))
            },
            error=final_state.get("error")
        )
        
        logger.info(
            f"Create report completed: workflow_id={workflow_id}, status={response.status}, attempts={response.metadata['attempts']}"
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Create report failed: workflow_id={workflow_id}, error={e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/refine", response_model=WorkflowResponse, summary="SR 수정")
async def refine_report(request: RefineReportRequest = Body(...)):
    """
    SR 수정 워크플로우 실행
    
    **워크플로우**:
    1. 기존 페이지 로드 (report_id, page_number)
    2. gen_node(refine_mode) 실행
    3. validator_node 선택적 실행 (참고용)
    4. 결과 반환
    
    **Parameters**:
    - `report_id`: 보고서 ID
    - `page_number`: 페이지 번호
    - `user_instruction`: 사용자 수정 지시사항
    
    **Returns**:
    - `workflow_id`: 워크플로우 실행 ID
    - `status`: "success" | "failed"
    - `generated_text`: 수정된 SR 본문
    - `validation`: 검증 결과 (참고용)
    - `metadata`: 메타데이터 (이전 본문, 경고 등)
    """
    workflow_id = str(uuid4())
    
    logger.info(
        f"Refine report started: workflow_id={workflow_id}, report_id={request.report_id}, page_number={request.page_number}"
    )
    
    try:
        # Infra 레이어 초기화
        infra = get_infra()
        
        # 사용자 입력 구성
        user_input = {
            "action": "refine",
            "report_id": request.report_id,
            "page_number": request.page_number,
            "user_instruction": request.user_instruction
        }
        
        # 워크플로우 실행
        final_state = await run_workflow(
            user_input=user_input,
            infra=infra,
            workflow_id=workflow_id
        )
        
        # 응답 구성
        response = WorkflowResponse(
            workflow_id=workflow_id,
            status=final_state.get("status", "failed"),
            generated_text=final_state.get("generated_text", ""),
            validation=final_state.get("validation", {}),
            references={},
            metadata={
                "mode": final_state.get("mode", "refine"),
                "previous_text": final_state.get("previous_text", ""),
                "warnings": final_state.get("warnings", []),
                "created_at": str(final_state.get("created_at", "")),
                "updated_at": str(final_state.get("updated_at", ""))
            },
            error=final_state.get("error")
        )
        
        logger.info(
            f"Refine report completed: workflow_id={workflow_id}, status={response.status}"
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Refine report failed: workflow_id={workflow_id}, error={e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/{workflow_id}/status", response_model=WorkflowStatusResponse, summary="워크플로우 상태 조회")
async def get_workflow_status(workflow_id: str):
    """
    워크플로우 상태 조회
    
    **TODO**: 실제 구현 시 DB에서 조회
    
    **Parameters**:
    - `workflow_id`: 워크플로우 실행 ID
    
    **Returns**:
    - `workflow_id`: 워크플로우 실행 ID
    - `status`: 상태
    - `created_at`: 생성 시각
    - `updated_at`: 업데이트 시각
    - `attempt`: 현재 재시도 횟수
    - `max_retries`: 최대 재시도 횟수
    """
    # TODO: DB에서 조회
    logger.warning(f"get_workflow_status: Mock implementation for workflow_id={workflow_id}")
    
    raise HTTPException(
        status_code=501,
        detail="Not implemented: Workflow status retrieval requires database integration"
    )


@router.get("/agents", summary="등록된 에이전트 목록")
async def list_agents():
    """
    등록된 모든 에이전트 목록 반환
    
    **Returns**:
    - `agents`: 에이전트 이름 목록
    """
    try:
        infra = get_infra()
        return {"agents": infra.agent_registry.list_agents()}
    except Exception as e:
        logger.error(f"List agents failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", summary="등록된 툴 목록")
async def list_tools():
    """
    등록된 모든 툴 목록 반환
    
    **Returns**:
    - `tools`: 툴 이름 목록
    """
    try:
        infra = get_infra()
        return {"tools": infra.tool_registry.list_tools()}
    except Exception as e:
        logger.error(f"List tools failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

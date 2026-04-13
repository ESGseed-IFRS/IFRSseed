"""
IFRS Agent API 라우터

IFRS 지속가능성 보고서 생성 워크플로우 API
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List, AsyncIterator
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Body, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.domain.v1.ifrs_agent.hub.bootstrap import get_infra
from backend.domain.v1.ifrs_agent.hub.orchestrator.workflow_events import QueueWorkflowEventSink
from backend.domain.v1.ifrs_agent.models.langgraph import run_workflow
from backend.domain.v1.data_integration.hub.services.group_aggregation_service import (
    GroupAggregationService,
)

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
        "fact_data_by_dp": final_state.get("fact_data_by_dp", {}),
        "agg_data": final_state.get("agg_data", {}),
    }


def _workflow_response_from_final_state(
    workflow_id: str, final_state: Dict[str, Any]
) -> "WorkflowResponse":
    """`run_workflow` 결과 상태 → API 응답 모델 (create/stream 공통)."""
    _gi = final_state.get("gen_input")
    _ds = final_state.get("data_selection")
    _pi = final_state.get("prompt_interpretation")
    _dp_sel = final_state.get("dp_selection_required")
    _dp_mappings = final_state.get("dp_sentence_mappings", [])
    _data_provenance = final_state.get("data_provenance")
    # 빈 dict {} 는 falsy라 `if _data_provenance` 로 두면 API에서 null 로 나가므로 dict 여부만 본다.
    return WorkflowResponse(
        workflow_id=workflow_id,
        status=final_state.get("status", "failed"),
        generated_text=final_state.get("generated_text", ""),
        dp_sentence_mappings=_dp_mappings if _dp_mappings else [],
        data_provenance=_data_provenance if isinstance(_data_provenance, dict) else None,
        validation=final_state.get("validation", {}),
        references=_build_create_references(final_state),
        metadata={
            "attempts": final_state.get("attempt", 0) + 1,
            "max_retries": final_state.get("max_retries", 3),
            "mode": final_state.get("mode", "draft"),
            "created_at": str(final_state.get("created_at", "")),
            "updated_at": str(final_state.get("updated_at", "")),
            "prompt_interpretation": _pi if _pi else None,
        },
        error=final_state.get("error"),
        gen_input=_gi if _gi else None,
        data_selection=_ds if _ds else None,
        prompt_interpretation=_pi if _pi else None,
        dp_selection_required=_dp_sel if _dp_sel else None,
    )


# ===== Request/Response Models =====

class CreateReportRequest(BaseModel):
    """SR 초안 생성 요청"""
    company_id: str = Field(..., description="기업 ID")
    category: str = Field(..., description="카테고리 (예: '재생에너지')")
    dp_id: Optional[str] = Field(None, description="Data Point ID (선택, 단일)")
    dp_ids: Optional[List[str]] = Field(
        None,
        description="Data Point ID 목록(1개 이상, Phase 3 예정 — 현재는 첫 항목이 dp_id로 전달)",
    )
    prompt: Optional[str] = Field(
        None,
        description="자유 프롬프트(Phase 0: 검색 의도·초점 해석, 전년/전전년 페이지 정규식 추출)",
    )
    ref_pages: Optional[Dict[str, Optional[int]]] = Field(
        None,
        description='직접 참조할 SR 페이지 (예: {"2024": 89, "2023": 75})',
    )
    sr_body_ids: Optional[List[str]] = Field(
        None,
        description="직접 참조할 sr_report_body ID 목록 (첫 번째=2024년, 두 번째=2023년)",
    )
    sr_image_ids: Optional[List[str]] = Field(
        None,
        description="직접 참조할 sr_report_images ID 목록 (선택적, 없으면 page_number 기반)",
    )
    max_retries: int = Field(3, ge=1, le=5, description="최대 재시도 횟수")


class RefineReportRequest(BaseModel):
    """SR 수정 요청"""
    report_id: str = Field(..., description="보고서 ID")
    page_number: int = Field(..., ge=1, description="페이지 번호")
    user_instruction: str = Field(..., description="사용자 수정 지시사항")


class DpSentenceMapping(BaseModel):
    """DP별 문장 매핑"""
    dp_id: str = Field(..., description="Data Point ID")
    dp_name_ko: str = Field("", description="DP 한국어 명칭")
    sentences: List[str] = Field(default_factory=list, description="해당 DP와 관련된 문장 목록")
    rationale: str = Field("", description="매핑 근거")


class WorkflowResponse(BaseModel):
    """워크플로우 실행 결과"""
    workflow_id: str = Field(..., description="워크플로우 실행 ID")
    status: str = Field(..., description="상태 (success, failed, max_retries_exceeded)")
    generated_text: str = Field("", description="생성된 SR 본문")
    dp_sentence_mappings: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="DP별 문장 매핑 (각 DP와 관련된 문장 추출)",
    )
    data_provenance: Optional[Dict[str, Any]] = Field(
        None,
        description="데이터 출처 추적 (quantitative_sources, qualitative_sources, reference_pages)",
    )
    validation: Dict[str, Any] = Field(default_factory=dict, description="검증 결과")
    references: Dict[str, Any] = Field(default_factory=dict, description="참조 데이터 (노드 원본)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="메타데이터")
    error: Optional[str] = Field(None, description="에러 메시지")
    gen_input: Optional[Dict[str, Any]] = Field(
        None,
        description="Phase 2 필터링 후 gen_node에 전달된 입력 (정제본)",
    )
    data_selection: Optional[Dict[str, Any]] = Field(
        None,
        description="데이터 선택 결과 (include_* 플래그, rationale 등)",
    )
    prompt_interpretation: Optional[Dict[str, Any]] = Field(
        None,
        description="Phase 0 프롬프트 해석 (search_intent, content_focus, ref_pages 등)",
    )
    dp_selection_required: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Phase 1.5 DP 계층 검증 실패 시 하위 선택지 제시",
    )


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
        user_input = _create_user_input_from_request(request)
        
        # 워크플로우 실행
        final_state = await run_workflow(
            user_input=user_input,
            infra=infra,
            workflow_id=workflow_id
        )

        response = _workflow_response_from_final_state(workflow_id, final_state)
        
        logger.info(
            f"Create report completed: workflow_id={workflow_id}, status={response.status}, attempts={response.metadata['attempts']}"
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Create report failed: workflow_id={workflow_id}, error={e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _create_user_input_from_request(request: CreateReportRequest) -> Dict[str, Any]:
    dp_id = request.dp_id
    dp_ids = list(request.dp_ids) if request.dp_ids else []
    if dp_ids and not dp_id:
        dp_id = dp_ids[0]
    elif dp_id and not dp_ids:
        dp_ids = [dp_id]
    return {
        "action": "create",
        "company_id": request.company_id,
        "category": request.category,
        "dp_id": dp_id,
        "dp_ids": dp_ids,
        "prompt": request.prompt,
        "ref_pages": request.ref_pages,
        "sr_body_ids": list(request.sr_body_ids) if request.sr_body_ids else [],
        "sr_image_ids": list(request.sr_image_ids) if request.sr_image_ids else [],
        "max_retries": request.max_retries,
    }


@router.post("/reports/create/stream", summary="SR 초안 생성 (SSE 진행 이벤트 + 최종 결과)")
async def create_report_stream(request: CreateReportRequest = Body(...)):
    """
    `POST /reports/create` 와 동일하게 **워크플로를 1회** 실행하되,
    진행 단계는 `text/event-stream`(SSE)으로 실시간 전달한다.

    마지막 비즈니스 이벤트: `step: workflow_finished`, `detail.result`에 WorkflowResponse(JSON).
    이후 큐 센티넬로 스트림 종료.
    """
    workflow_id = str(uuid4())
    q: asyncio.Queue = asyncio.Queue()
    sink = QueueWorkflowEventSink(q, workflow_id)

    async def run_workflow_task() -> None:
        try:
            infra = get_infra()
            user_input = _create_user_input_from_request(request)
            final_state = await run_workflow(
                user_input=user_input,
                infra=infra,
                workflow_id=workflow_id,
                event_sink=sink,
            )
            wr = _workflow_response_from_final_state(workflow_id, final_state)
            await sink.emit(
                {
                    "phase": "system",
                    "step": "workflow_finished",
                    "status": "completed",
                    "detail": {
                        "message_ko": "생성 완료",
                        "result": wr.model_dump(mode="json"),
                    },
                }
            )
        except Exception as e:
            logger.error(
                f"Create report stream workflow failed: workflow_id={workflow_id}, error={e}",
                exc_info=True,
            )
            await sink.emit(
                {
                    "phase": "system",
                    "step": "stream_error",
                    "status": "failed",
                    "detail": {
                        "message_ko": str(e)[:500],
                        "code": "WORKFLOW_FAILED",
                    },
                }
            )
        finally:
            await q.put(None)

    async def event_iter() -> AsyncIterator[str]:
        task = asyncio.create_task(run_workflow_task())
        try:
            while True:
                item = await q.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
        finally:
            await task

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
            error=final_state.get("error"),
            gen_input=None,
            data_selection=None,
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


# ===== DB: 지주 SR 페이지 ↔ sr_body / sr_image ID (프론트 JSON 스키마와 동일) =====


class HoldingSrMappingsPagesPayload(BaseModel):
    """pages 객체: 키는 페이지 번호 문자열, 값은 srBodyIds / srImageIds 배열"""

    model_config = {"extra": "allow"}

    @staticmethod
    def normalize_pages(raw: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
        out: Dict[str, Dict[str, List[str]]] = {}
        for k, v in (raw or {}).items():
            if not isinstance(v, dict):
                continue
            key = str(k)
            b = v.get("srBodyIds")
            i = v.get("srImageIds")
            out[key] = {
                "srBodyIds": list(b) if isinstance(b, list) else [],
                "srImageIds": list(i) if isinstance(i, list) else [],
            }
        return out


class HoldingSrMappingsPutPayload(BaseModel):
    version: int = Field(1, ge=1, le=32767)
    pages: Dict[str, Any] = Field(default_factory=dict)


class PutHoldingSrMappingsRequest(BaseModel):
    company_id: str = Field(..., description="companies.id (UUID)")
    catalog_key: str = Field("sds_2024", description="목차 카탈로그 키 (생성 파일과 일치)")
    payload: HoldingSrMappingsPutPayload


@router.get("/holding-sr-mappings", summary="지주 SR 페이지 매핑 조회 (DB)")
async def get_holding_sr_mappings(
    company_id: str = Query(..., description="companies.id"),
    catalog_key: str = Query("sds_2024"),
):
    """
    저장된 매핑이 없으면 `pages: {}` 와 `updatedAt: null` 을 반환합니다.
    """
    try:
        from backend.domain.shared.tool.ifrs_agent.database.holding_sr_mappings_repo import (
            fetch_holding_sr_mapping_set,
        )

        row = await fetch_holding_sr_mapping_set(company_id.strip(), catalog_key.strip())
        if not row:
            return {"version": 1, "updatedAt": None, "pages": {}}
        return row
    except Exception as e:
        logger.error(f"get_holding_sr_mappings failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/holding-sr-mappings", summary="지주 SR 페이지 매핑 저장 (DB, 전체 pages 교체)")
async def put_holding_sr_mappings(request: PutHoldingSrMappingsRequest = Body(...)):
    try:
        from backend.domain.shared.tool.ifrs_agent.database.holding_sr_mappings_repo import (
            upsert_holding_sr_mapping_set,
        )

        pages = HoldingSrMappingsPagesPayload.normalize_pages(request.payload.pages)
        out = await upsert_holding_sr_mapping_set(
            request.company_id.strip(),
            request.catalog_key.strip(),
            pages,
            schema_version=request.payload.version,
        )
        return out
    except Exception as e:
        logger.error(f"put_holding_sr_mappings failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/holding-sr-mappings", summary="지주 SR 페이지 매핑 삭제 (DB 행 전체)")
async def delete_holding_sr_mappings(
    company_id: str = Query(...),
    catalog_key: str = Query("sds_2024"),
):
    try:
        from backend.domain.shared.tool.ifrs_agent.database.holding_sr_mappings_repo import (
            delete_holding_sr_mapping_set,
        )

        n = await delete_holding_sr_mapping_set(company_id.strip(), catalog_key.strip())
        return {"deleted": n}
    except Exception as e:
        logger.error(f"delete_holding_sr_mappings failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ===== 관리자 API: 페이지 매핑 관리 =====

class AutoMappingRequest(BaseModel):
    """자동 매핑 생성 요청"""
    company_id: str = Field(..., description="기업 ID")
    pages: List[Dict[str, Any]] = Field(..., description="페이지 목록 (page, title, section)")
    year: int = Field(2024, description="대상 연도")


class AutoMappingResponse(BaseModel):
    """자동 매핑 생성 결과"""
    mappings: List[Dict[str, Any]] = Field(..., description="페이지별 매핑 결과")
    total: int = Field(..., description="총 페이지 수")
    success: int = Field(..., description="성공한 매핑 수")
    failed: int = Field(..., description="실패한 매핑 수")


class ValidateMappingRequest(BaseModel):
    """매핑 검증 요청"""
    body_ids: List[str] = Field(..., description="sr_report_body ID 목록")
    image_ids: List[str] = Field(default_factory=list, description="sr_report_images ID 목록")


class ValidateMappingResponse(BaseModel):
    """매핑 검증 결과"""
    valid: bool = Field(..., description="전체 유효성")
    body_results: List[Dict[str, Any]] = Field(..., description="Body ID별 검증 결과")
    image_results: List[Dict[str, Any]] = Field(..., description="Image ID별 검증 결과")


@router.post("/admin/mapping/auto-generate", response_model=AutoMappingResponse, summary="자동 매핑 생성")
async def auto_generate_mapping(request: AutoMappingRequest = Body(...)):
    """
    페이지 목록에 대해 c_rag 검색으로 자동 매핑 생성
    
    **Process**:
    1. 각 페이지의 title을 category로 사용
    2. c_rag로 최적 sr_body 검색
    3. 검색 결과에서 sr_body_id 추출
    4. 신뢰도(similarity) 함께 반환
    
    **Args**:
    - `company_id`: 기업 ID
    - `pages`: 페이지 목록 (page, title, section)
    - `year`: 대상 연도
    
    **Returns**:
    - `mappings`: 페이지별 매핑 (page, sr_body_id, confidence)
    - `total`: 총 페이지 수
    - `success`: 성공한 매핑 수
    - `failed`: 실패한 매핑 수
    """
    try:
        infra = get_infra()
        mappings = []
        success_count = 0
        failed_count = 0
        
        for page_info in request.pages:
            page_num = page_info.get("page")
            category = page_info.get("title", "")
            
            if not category:
                mappings.append({
                    "page": page_num,
                    "sr_body_id": None,
                    "confidence": 0.0,
                    "error": "Empty category"
                })
                failed_count += 1
                continue
            
            try:
                # c_rag로 검색 (비직접 참조 모드)
                result = await infra.call_agent(
                    "c_rag",
                    "collect",
                    {
                        "company_id": request.company_id,
                        "category": category,
                        "years": [request.year],
                        "use_direct_reference": False,  # 검색 모드 강제
                    }
                )
                
                year_str = str(request.year)
                year_data = result.get(year_str, {})
                report_id = year_data.get("report_id")
                page_number = year_data.get("page_number")
                
                if report_id and page_number:
                    # report_id + page_number로 sr_body_id 조회
                    body_row = await infra.call_tool(
                        "query_sr_body_by_page",
                        {
                            "company_id": request.company_id,
                            "year": request.year,
                            "page_number": page_number,
                        }
                    )
                    
                    sr_body_id = body_row.get("id") if body_row else None
                    
                    mappings.append({
                        "page": page_num,
                        "sr_body_id": str(sr_body_id) if sr_body_id else None,
                        "page_number": page_number,
                        "confidence": 0.85,  # c_rag 검색 기본 신뢰도
                        "error": None
                    })
                    success_count += 1
                else:
                    mappings.append({
                        "page": page_num,
                        "sr_body_id": None,
                        "confidence": 0.0,
                        "error": "No SR body found"
                    })
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"Auto mapping failed for page {page_num}: {e}")
                mappings.append({
                    "page": page_num,
                    "sr_body_id": None,
                    "confidence": 0.0,
                    "error": str(e)
                })
                failed_count += 1
        
        return AutoMappingResponse(
            mappings=mappings,
            total=len(request.pages),
            success=success_count,
            failed=failed_count
        )
        
    except Exception as e:
        logger.error(f"Auto generate mapping failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/mapping/validate", response_model=ValidateMappingResponse, summary="매핑 검증")
async def validate_mapping(request: ValidateMappingRequest = Body(...)):
    """
    sr_body_ids, sr_image_ids가 DB에 실제로 존재하는지 검증
    
    **Args**:
    - `body_ids`: sr_report_body ID 목록
    - `image_ids`: sr_report_images ID 목록
    
    **Returns**:
    - `valid`: 전체 유효성 (모두 존재하면 true)
    - `body_results`: Body ID별 검증 결과 (id, exists, error)
    - `image_results`: Image ID별 검증 결과 (id, exists, error)
    """
    try:
        infra = get_infra()
        body_results = []
        image_results = []
        all_valid = True
        
        # Body ID 검증
        for body_id in request.body_ids:
            try:
                result = await infra.call_tool(
                    "query_sr_body_by_id",
                    {"body_id": body_id}
                )
                exists = result is not None
                body_results.append({
                    "id": body_id,
                    "exists": exists,
                    "page_number": result.get("page_number") if exists else None,
                    "error": None if exists else "Not found"
                })
                if not exists:
                    all_valid = False
            except Exception as e:
                body_results.append({
                    "id": body_id,
                    "exists": False,
                    "page_number": None,
                    "error": str(e)
                })
                all_valid = False
        
        # Image ID 검증
        if request.image_ids:
            try:
                results = await infra.call_tool(
                    "query_sr_images_by_ids",
                    {"image_ids": request.image_ids}
                )
                found_ids = {r["id"] for r in results}
                
                for img_id in request.image_ids:
                    exists = img_id in found_ids
                    image_results.append({
                        "id": img_id,
                        "exists": exists,
                        "error": None if exists else "Not found"
                    })
                    if not exists:
                        all_valid = False
            except Exception as e:
                for img_id in request.image_ids:
                    image_results.append({
                        "id": img_id,
                        "exists": False,
                        "error": str(e)
                    })
                all_valid = False
        
        return ValidateMappingResponse(
            valid=all_valid,
            body_results=body_results,
            image_results=image_results
        )
        
    except Exception as e:
        logger.error(f"Validate mapping failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dp/{dp_id}/sources")
async def get_dp_data_sources(
    dp_id: str,
    company_id: str = Query(..., description="지주사 회사 ID"),
    year: int = Query(..., ge=2020, le=2100, description="연도"),
) -> Dict[str, Any]:
    """
    특정 DP의 데이터 출처 목록을 반환합니다.
    
    - 지주사 자체 데이터
    - 승인된 계열사 데이터
    
    Returns:
        {
            "dp_id": str,
            "sources": [
                {
                    "source_type": "holding_own" | "subsidiary_reported",
                    "company_id": str,
                    "company_name": str,
                    "value": float,
                    "unit": str,
                    "submission_date": str | None,
                    "verification_status": str
                }
            ],
            "total_value": float
        }
    """
    try:
        service = GroupAggregationService()
        sources = await asyncio.to_thread(
            service.get_subsidiary_data_sources,
            company_id,
            year,
            dp_id,
        )
        
        total_value = sum(s['value'] for s in sources)
        
        return {
            "dp_id": dp_id,
            "sources": sources,
            "total_value": total_value,
        }
    except Exception as e:
        logger.error(f"Get DP sources failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

"""계열사 데이터 제출 API 라우터"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.domain.v1.data_integration.hub.services.subsidiary_contribution_service import (
    SubsidiaryContributionService,
)
from backend.domain.v1.data_integration.hub.services.subsidiary_submission_service import (
    SubsidiarySubmissionService,
)

subsidiary_router = APIRouter(prefix="/subsidiary", tags=["Subsidiary Data Submission"])


class SubmitDataRequest(BaseModel):
    """계열사 데이터 제출 요청"""
    subsidiary_company_id: str = Field(..., description="계열사 회사 ID (UUID)")
    holding_company_id: str = Field(..., description="지주사 회사 ID (UUID)")
    year: int = Field(..., ge=2020, le=2100, description="제출 연도")
    quarter: Optional[int] = Field(None, ge=1, le=4, description="제출 분기 (선택)")
    scope_1: bool = Field(False, description="Scope 1 데이터 포함 여부")
    scope_2: bool = Field(False, description="Scope 2 데이터 포함 여부")
    scope_3: bool = Field(False, description="Scope 3 데이터 포함 여부")


class SubmitDataResponse(BaseModel):
    """계열사 데이터 제출 응답"""
    success: bool
    message: str
    submission_id: str
    status: str
    total_emission_tco2e: float
    staging_row_count: int


class ApproveRejectRequest(BaseModel):
    """승인/반려 요청"""
    submission_id: str
    reviewed_by: str  # user_id
    rejection_reason: Optional[str] = None


class SubmissionListResponse(BaseModel):
    """제출 이력 목록 응답"""
    submissions: List[Dict[str, Any]]
    total_count: int


class SrDpSubmitRequest(BaseModel):
    """SR 보고서 DP(서술형) 제출 — subsidiary_data_contributions 저장"""

    subsidiary_company_id: str = Field(..., description="제출 계열사 회사 ID (UUID)")
    submission_year: int = Field(..., ge=2020, le=2100, description="보고 연도")
    dp_id: str = Field(..., max_length=128, description="DP 식별자(예: d4)")
    dp_title: str = Field("", max_length=500, description="DP 제목")
    narrative_text: str = Field("", description="textarea 본문")
    submitted_by: Optional[str] = Field(None, max_length=200, description="제출자 표시(이메일·이름 등, 선택)")
    related_dp_ids: Optional[List[str]] = Field(
        None,
        description="연결된 공시 기준 코드 목록(ESRS/GRI/IFRS 등). 비우면 서버에서 dp_id만 사용",
    )


class SrDpSubmitResponse(BaseModel):
    success: bool
    message: str
    contribution_id: str
    status: str


class SrContributionRow(BaseModel):
    """지주 SR 취합용 subsidiary_data_contributions 한 행."""

    id: str
    company_id: str
    subsidiary_name: Optional[str] = None
    facility_name: Optional[str] = None
    report_year: int
    category: Optional[str] = None
    description: Optional[str] = None
    related_dp_ids: List[str] = Field(default_factory=list)
    quantitative_data: Dict[str, Any] = Field(default_factory=dict)
    data_source: Optional[str] = None
    submitted_by: Optional[str] = None
    submission_date: Optional[str] = None


class SrContributionsListResponse(BaseModel):
    contributions: List[SrContributionRow]
    total_count: int


@subsidiary_router.get("/sr-contributions", response_model=SrContributionsListResponse)
async def list_sr_contributions_for_holding(
    holding_company_id: str = Query(..., description="지주 companies.id (UUID)"),
    report_year: int = Query(..., ge=2000, le=2100),
) -> SrContributionsListResponse:
    """지주 산하 계열사·지주 본사의 subsidiary_data_contributions 목록(SR·시드 공통)."""
    service = SubsidiaryContributionService()
    try:
        raw = await asyncio.to_thread(
            service.list_contributions_for_holding,
            holding_company_id,
            report_year,
        )
        rows = [SrContributionRow.model_validate(x) for x in raw]
        return SrContributionsListResponse(contributions=rows, total_count=len(rows))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@subsidiary_router.post("/sr-dp-submit", response_model=SrDpSubmitResponse)
async def submit_sr_dp_narrative(req: SrDpSubmitRequest) -> SrDpSubmitResponse:
    """계열사 SR 공시 항목(DP) 서술을 subsidiary_data_contributions에 기록합니다."""
    service = SubsidiaryContributionService()
    try:
        result = await asyncio.to_thread(
            service.submit_sr_dp_narrative,
            req.subsidiary_company_id,
            req.submission_year,
            req.dp_id,
            req.dp_title,
            req.narrative_text,
            req.submitted_by,
            req.related_dp_ids,
        )
        return SrDpSubmitResponse(
            success=True,
            message="SR DP 공시 내용이 subsidiary_data_contributions에 저장되었습니다.",
            contribution_id=result["contribution_id"],
            status=result["status"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subsidiary_router.post("/submit", response_model=SubmitDataResponse)
async def submit_subsidiary_data(req: SubmitDataRequest) -> SubmitDataResponse:
    """
    계열사가 지주사에게 GHG 데이터를 제출합니다.
    
    - staging_*_data에서 해당 계열사의 데이터를 조회
    - GHG 배출량 계산 (임시)
    - subsidiary_data_submissions 레코드 생성
    """
    service = SubsidiarySubmissionService()
    
    try:
        result = await asyncio.to_thread(
            service.submit_data,
            req.subsidiary_company_id,
            req.holding_company_id,
            req.year,
            req.quarter,
            req.scope_1,
            req.scope_2,
            req.scope_3,
        )
        
        return SubmitDataResponse(
            success=True,
            message=f"계열사 데이터가 성공적으로 제출되었습니다.",
            submission_id=result['submission_id'],
            status=result['status'],
            total_emission_tco2e=result['total_emission_tco2e'],
            staging_row_count=result['staging_row_count'],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subsidiary_router.get("/list", response_model=SubmissionListResponse)
async def list_subsidiary_submissions(
    holding_company_id: Optional[str] = None,
    subsidiary_company_id: Optional[str] = None,
    status: Optional[str] = None,
    year: Optional[int] = None,
) -> SubmissionListResponse:
    """
    계열사 데이터 제출 이력을 조회합니다.
    
    - 지주사: 모든 계열사의 제출 이력 조회 (holding_company_id 필수)
    - 계열사: 자기 회사의 제출 이력 조회 (subsidiary_company_id 필수)
    """
    service = SubsidiarySubmissionService()
    
    try:
        submissions = await asyncio.to_thread(
            service.list_submissions,
            holding_company_id,
            subsidiary_company_id,
            status,
            year,
        )
        
        return SubmissionListResponse(
            submissions=submissions,
            total_count=len(submissions),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subsidiary_router.post("/approve")
async def approve_submission(req: ApproveRejectRequest) -> Dict[str, Any]:
    """
    지주사가 계열사 데이터 제출을 승인합니다.
    """
    service = SubsidiarySubmissionService()
    
    try:
        await asyncio.to_thread(
            service.approve_submission,
            req.submission_id,
            req.reviewed_by,
        )
        
        return {
            "success": True,
            "message": "제출 데이터가 승인되었습니다.",
            "submission_id": req.submission_id,
            "status": "approved",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subsidiary_router.post("/reject")
async def reject_submission(req: ApproveRejectRequest) -> Dict[str, Any]:
    """
    지주사가 계열사 데이터 제출을 반려합니다.
    """
    if not req.rejection_reason:
        raise HTTPException(status_code=400, detail="반려 사유를 입력해주세요.")
    
    service = SubsidiarySubmissionService()
    
    try:
        await asyncio.to_thread(
            service.reject_submission,
            req.submission_id,
            req.reviewed_by,
            req.rejection_reason,
        )
        
        return {
            "success": True,
            "message": "제출 데이터가 반려되었습니다.",
            "submission_id": req.submission_id,
            "status": "rejected",
            "rejection_reason": req.rejection_reason,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

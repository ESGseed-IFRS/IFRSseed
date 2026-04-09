"""GHG 이상치 및 데이터 품질 검증 API."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.domain.v1.ghg_calculation.hub.orchestrator.ghg_comprehensive_validation_orchestrator import (
    GhgComprehensiveValidationOrchestrator,
)
from backend.domain.v1.ghg_calculation.models.states.ghg_anomaly import (
    GhgAnomalyScanRequestDto,
    GhgAnomalyScanResponseDto,
)

anomaly_validation_router = APIRouter(prefix="/anomaly", tags=["GHG Anomaly Validation"])

_orchestrator = GhgComprehensiveValidationOrchestrator()


@anomaly_validation_router.post(
    "/comprehensive-scan",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def post_comprehensive_anomaly_scan(
    body: GhgAnomalyScanRequestDto,
) -> GhgAnomalyScanResponseDto:
    """
    GHG 데이터 종합 이상치 검증.
    
    포함 검증:
    1. 시계열 이상치 (YoY, MoM, MA12, Z-score, IQR)
    2. 데이터 품질 (0값, 음수, 중복, 단위 불일치)
    3. 배출계수 이탈 (±15%)
    4. 원단위 이상 (면적당, 인원당, 생산량당)
    5. 경계·일관성 검증
    """
    try:
        return _orchestrator.run_comprehensive_validation(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@anomaly_validation_router.post(
    "/timeseries-scan",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def post_timeseries_anomaly_scan(
    body: GhgAnomalyScanRequestDto,
) -> GhgAnomalyScanResponseDto:
    """
    시계열 이상치만 검증.
    
    포함 검증:
    - YoY (전년 대비)
    - MoM (전월 대비)
    - MA12 (12개월 이동평균)
    - Z-score (3σ 이탈)
    - IQR (1.5배 이탈)
    """
    try:
        return _orchestrator.run_timeseries_validation(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@anomaly_validation_router.post(
    "/data-quality-scan",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def post_data_quality_scan(
    body: GhgAnomalyScanRequestDto,
) -> GhgAnomalyScanResponseDto:
    """
    데이터 품질 검증.
    
    포함 검증:
    - 0값 검출
    - 음수값 검출
    - 중복 데이터 검출
    - 단위 불일치 검출
    """
    try:
        return _orchestrator.run_data_quality_validation(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@anomaly_validation_router.get(
    "/validation-history",
    response_model=list[GhgAnomalyScanResponseDto],
)
def get_validation_history(
    company_id: UUID = Query(..., description="회사 ID"),
    year: str = Query(..., description="연도 (YYYY)"),
    limit: int = Query(10, ge=1, le=100, description="조회 개수"),
) -> list[GhgAnomalyScanResponseDto]:
    """검증 이력 조회."""
    try:
        # TODO: DB에서 이력 조회 로직 구현
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

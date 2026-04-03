"""GHG Raw Data 조회 API."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.domain.v1.ghg_calculation.hub.orchestrator.ghg_anomaly_orchestrator import (
    GhgAnomalyOrchestrator,
)
from backend.domain.v1.ghg_calculation.hub.orchestrator.raw_data_inquiry_orchestrator import (
    RawDataInquiryOrchestrator,
)
from backend.domain.v1.ghg_calculation.models.states import (
    GhgAnomalyScanRequestDto,
    GhgAnomalyScanResponseDto,
    RawDataInquiryRequestDto,
    RawDataInquiryResponseDto,
)

raw_data_router = APIRouter(prefix="/raw-data", tags=["GHG Raw Data"])

_orchestrator = RawDataInquiryOrchestrator()
_anomaly_orch = GhgAnomalyOrchestrator()


@raw_data_router.post(
    "/inquiry",
    response_model=RawDataInquiryResponseDto,
    response_model_by_alias=True,
)
def post_raw_data_inquiry(body: RawDataInquiryRequestDto) -> RawDataInquiryResponseDto:
    """
    스테이징 테이블을 조회해 카테고리·필터에 맞는 Raw Data 행을 반환합니다.
    에너지 카테고리는 등록된 `source_file` 매퍼가 있는 CSV만 변환합니다 (예: EMS_RENEWABLE_ENERGY.csv).
    """
    try:
        return _orchestrator.inquire_raw_data(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@raw_data_router.post(
    "/anomaly-scan",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def post_raw_data_anomaly_scan(body: GhgAnomalyScanRequestDto) -> GhgAnomalyScanResponseDto:
    """
    스테이징 에너지 월별 시계열 기준 이상치 스캔 (전년 동기·전월·MA12·3σ).
    배치·마감 전 전수 재검증 또는 수동 실행에 사용합니다.
    """
    try:
        res = _anomaly_orch.scan_timeseries(body)
        _anomaly_orch.persist_scan_response(body.company_id, res)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@raw_data_router.get(
    "/anomaly-latest",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def get_raw_data_anomaly_latest(
    company_id: UUID = Query(..., description="companies.id"),
) -> GhgAnomalyScanResponseDto:
    """DB에 저장된 최신 시계열 이상치 스캔 결과(업로드·적재 시 자동 갱신)."""
    try:
        cached = _anomaly_orch.get_latest_persisted_scan(company_id)
        if cached:
            return cached
        return GhgAnomalyScanResponseDto(
            company_id=str(company_id),
            categories=["energy", "waste", "pollution", "chemical"],
            systems=[],
            group_by_system=True,
            timeseries_findings=[],
            series_evaluated=0,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

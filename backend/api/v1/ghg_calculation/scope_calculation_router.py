"""Scope 1·2 산정 API (V2 - 개선)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.domain.v1.ghg_calculation.hub.orchestrator.scope_calculation_orchestrator_v2 import (
    ScopeCalculationOrchestratorV2,
)
from backend.domain.v1.ghg_calculation.hub.repositories.ghg_emission_result_repository import (
    GhgEmissionResultRepository,
)
from backend.domain.v1.ghg_calculation.models.states import (
    GroupScopeResultRowDto,
    GroupScopeResultsResponseDto,
    GroupScopeTrendPointDto,
    GroupScopeTrendResponseDto,
    ScopeRecalculateRequestDto,
    ScopeRecalculateResponseDto,
)

scope_calculation_router = APIRouter(prefix="/scope", tags=["GHG Scope Calculation"])

# V2 Orchestrator 사용: 열량계수, GHG 가스별 계산, 단위 자동 변환 지원
_orch = ScopeCalculationOrchestratorV2()
_result_repo = GhgEmissionResultRepository()


@scope_calculation_router.post(
    "/recalculate",
    response_model=ScopeRecalculateResponseDto,
    response_model_by_alias=True,
)
def post_scope_recalculate(body: ScopeRecalculateRequestDto) -> ScopeRecalculateResponseDto:
    """스테이징 에너지 활동자료와 배출계수로 Scope 1·2를 재산정하고 결과를 저장합니다."""
    try:
        return _orch.recalculate(body.company_id, body.year.strip(), (body.basis or "location").strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@scope_calculation_router.get(
    "/results",
    response_model=ScopeRecalculateResponseDto,
    response_model_by_alias=True,
)
def get_scope_results(
    company_id: UUID = Query(..., description="companies.id"),
    year: str = Query(..., min_length=4, max_length=4),
    basis: str = Query("location"),
) -> ScopeRecalculateResponseDto:
    """저장된 최신 산정 결과(동일 연도·basis)를 반환합니다."""
    try:
        row = _orch.get_stored_results(company_id, year.strip(), basis.strip() or "location")
        if row is None:
            raise HTTPException(status_code=404, detail="저장된 산정 결과가 없습니다.")
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@scope_calculation_router.get(
    "/group-results",
    response_model=GroupScopeResultsResponseDto,
    response_model_by_alias=True,
)
def get_group_scope_results(
    holding_company_id: UUID = Query(..., description="지주 companies.id"),
    year: int = Query(..., ge=2000, le=2100),
    basis: str = Query("location"),
) -> GroupScopeResultsResponseDto:
    """지주 본사 + 자회사·계열사별 연간 산정(ghg_emission_results) 목록."""
    try:
        raw = _result_repo.list_group_annual_by_holding(
            str(holding_company_id), year, (basis or "location").strip() or "location"
        )
        rows = [GroupScopeResultRowDto.model_validate(r) for r in raw]
        return GroupScopeResultsResponseDto(
            holding_company_id=str(holding_company_id),
            year=year,
            basis=(basis or "location").strip() or "location",
            rows=rows,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@scope_calculation_router.get(
    "/group-trend",
    response_model=GroupScopeTrendResponseDto,
    response_model_by_alias=True,
)
def get_group_scope_trend(
    holding_company_id: UUID = Query(..., description="지주 companies.id"),
    year_from: int = Query(..., ge=2000, le=2100),
    year_to: int = Query(..., ge=2000, le=2100),
    basis: str = Query("location"),
) -> GroupScopeTrendResponseDto:
    """지주+자회사 합산 연도별 추세."""
    try:
        raw = _result_repo.aggregate_group_totals_by_year_range(
            str(holding_company_id),
            year_from,
            year_to,
            (basis or "location").strip() or "location",
        )
        points = [GroupScopeTrendPointDto.model_validate(r) for r in raw]
        return GroupScopeTrendResponseDto(
            holding_company_id=str(holding_company_id),
            basis=(basis or "location").strip() or "location",
            points=points,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

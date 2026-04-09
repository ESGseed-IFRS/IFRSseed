"""Scope 1·2 산정 API (V2 - 개선)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.domain.v1.ghg_calculation.hub.orchestrator.scope_calculation_orchestrator_v2 import (
    ScopeCalculationOrchestratorV2,
)
from backend.domain.v1.ghg_calculation.models.states import (
    ScopeRecalculateRequestDto,
    ScopeRecalculateResponseDto,
)

scope_calculation_router = APIRouter(prefix="/scope", tags=["GHG Scope Calculation"])

# V2 Orchestrator 사용: 열량계수, GHG 가스별 계산, 단위 자동 변환 지원
_orch = ScopeCalculationOrchestratorV2()


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

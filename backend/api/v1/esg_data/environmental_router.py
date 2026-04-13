"""ESG Data — `environmental_data` (GHG 산출·활동자료 기반)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.domain.v1.esg_data.hub.orchestrator.environmental_data_orchestrator import EnvironmentalDataOrchestrator

environmental_router = APIRouter(prefix="/environmental", tags=["ESG Data Environmental"])


class EnvironmentalBuildFromGhgRequest(BaseModel):
    company_id: str = Field(..., description="companies.id (UUID 문자열)")
    period_year: int = Field(..., ge=1900, le=2100)
    calculation_basis: str = Field(
        "location",
        description="ghg_emission_results.calculation_basis (예: location, market)",
    )
    dry_run: bool = Field(False, description="True면 집계만 반환하고 DB 미저장")
    status: str = Field("draft", description="environmental_data.status")


class EnvironmentalBuildFromGhgResponse(BaseModel):
    status: str
    company_id: str
    period_year: int
    mode: Optional[str] = None
    id: Optional[str] = None
    dry_run: bool = False
    summary: Dict[str, Any] = Field(default_factory=dict)
    fields: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


class EnvironmentalBuildGroupAggregateRequest(BaseModel):
    holding_company_id: str = Field(..., description="지주 companies.id (UUID)")
    period_year: int = Field(..., ge=1900, le=2100)
    calculation_basis: str = Field(
        "location",
        description="그룹 조회·environmental_data scope2 배분과 동일한 기준 (location / market)",
    )
    target_company_id: Optional[str] = Field(
        None,
        description="집계 결과를 쓸 environmental_data.company_id. 미지정 시 고정 그룹 집계용 UUID",
    )
    frozen_only: bool = Field(
        False,
        description="True면 검증 완료(frozen) 조직만 서버에서 합산",
    )
    dry_run: bool = Field(False, description="True면 집계만 반환하고 DB 미저장")
    status: str = Field("draft", description="environmental_data.status")
    trust_client_totals: bool = Field(
        False,
        description="True면 서버 합산 대신 아래 scope 합계를 그대로 사용",
    )
    client_scope1_total_tco2e: Optional[float] = Field(None, description="trust_client_totals 시 필수")
    client_scope2_total_tco2e: Optional[float] = Field(None, description="trust_client_totals 시 필수")
    client_scope3_total_tco2e: Optional[float] = Field(None, description="trust_client_totals 시 필수")


@environmental_router.post(
    "/build-from-ghg",
    response_model=EnvironmentalBuildFromGhgResponse,
    summary="ghg_emission_results + ghg_activity_data → environmental_data",
)
async def environmental_build_from_ghg(
    request: EnvironmentalBuildFromGhgRequest,
) -> EnvironmentalBuildFromGhgResponse:
    orch = EnvironmentalDataOrchestrator()
    raw = await orch.build_from_ghg_async(
        request.company_id,
        request.period_year,
        calculation_basis=request.calculation_basis,
        dry_run=request.dry_run,
        status=request.status,
    )
    return EnvironmentalBuildFromGhgResponse(
        status=raw.get("status", "error"),
        company_id=raw.get("company_id", request.company_id),
        period_year=raw.get("period_year", request.period_year),
        mode=raw.get("mode"),
        id=raw.get("id"),
        dry_run=bool(raw.get("dry_run")),
        summary=dict(raw.get("summary") or {}),
        fields=raw.get("fields"),
        message=raw.get("message"),
    )


@environmental_router.post(
    "/build-group-aggregate",
    response_model=EnvironmentalBuildFromGhgResponse,
    summary="지주 그룹 GHG 합산 → 단일 environmental_data 연간 행",
)
async def environmental_build_group_aggregate(
    request: EnvironmentalBuildGroupAggregateRequest,
) -> EnvironmentalBuildFromGhgResponse:
    orch = EnvironmentalDataOrchestrator()
    raw = await orch.build_group_aggregate_async(
        request.holding_company_id,
        request.period_year,
        calculation_basis=request.calculation_basis,
        target_company_id=request.target_company_id,
        frozen_only=request.frozen_only,
        dry_run=request.dry_run,
        status=request.status,
        trust_client_totals=request.trust_client_totals,
        client_scope1_total_tco2e=request.client_scope1_total_tco2e,
        client_scope2_total_tco2e=request.client_scope2_total_tco2e,
        client_scope3_total_tco2e=request.client_scope3_total_tco2e,
    )
    return EnvironmentalBuildFromGhgResponse(
        status=raw.get("status", "error"),
        company_id=raw.get("company_id", request.target_company_id or ""),
        period_year=raw.get("period_year", request.period_year),
        mode=raw.get("mode"),
        id=raw.get("id"),
        dry_run=bool(raw.get("dry_run")),
        summary=dict(raw.get("summary") or {}),
        fields=raw.get("fields"),
        message=raw.get("message"),
    )

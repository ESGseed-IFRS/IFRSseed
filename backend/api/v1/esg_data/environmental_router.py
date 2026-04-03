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

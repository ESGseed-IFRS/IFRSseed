"""ESG Data — social_data 스테이징 집계 API."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.domain.v1.esg_data.hub.orchestrator.social_data_orchestrator import SocialDataOrchestrator

social_router = APIRouter(prefix="/social", tags=["ESG Data Social"])


class BuildFromStagingRequest(BaseModel):
    """staging_hr_data / staging_srm_data / staging_ehs_data → social_data."""

    company_id: str = Field(..., description="companies.id (UUID 문자열)")
    period_year: int = Field(..., ge=1900, le=2100, description="집계 대상 연도")
    dry_run: bool = Field(False, description="True면 DB에 쓰지 않고 metrics만 반환")
    include_if_year_missing: bool = Field(
        True,
        description="행에 연도 컬럼이 없으면 period_year로 간주해 포함",
    )


class BuildFromStagingResponse(BaseModel):
    status: str
    company_id: str
    period_year: int
    results: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="data_type별 집계·upsert 결과",
    )


@social_router.post(
    "/build-from-staging",
    response_model=BuildFromStagingResponse,
    summary="스테이징 HR/SRM/EHS → social_data 빌드",
)
async def build_social_from_staging(request: BuildFromStagingRequest) -> BuildFromStagingResponse:
    orchestrator = SocialDataOrchestrator()
    raw = await orchestrator.build_from_staging_async(
        request.company_id,
        request.period_year,
        dry_run=request.dry_run,
        include_if_year_missing=request.include_if_year_missing,
    )
    return BuildFromStagingResponse(
        status=raw.get("status", "success"),
        company_id=raw.get("company_id", request.company_id),
        period_year=raw.get("period_year", request.period_year),
        results=list(raw.get("results") or []),
    )

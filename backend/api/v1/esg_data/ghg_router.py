"""ESG Data — ghg_activity_data 스테이징 적재 API."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import Response
from loguru import logger
from pydantic import BaseModel, Field

from backend.domain.v1.esg_data.hub.orchestrator.ghg_activity_orchestrator import GhgActivityOrchestrator
from backend.domain.v1.esg_data.hub.services.ghg_build_job_store import ghg_build_job_store

ghg_router = APIRouter(prefix="/ghg", tags=["ESG Data GHG"])


class GhgBuildFromStagingRequest(BaseModel):
    """staging_ems_data 등 → ghg_activity_data."""

    company_id: str = Field(..., description="companies.id (UUID 문자열)")
    period_year: int = Field(..., ge=1900, le=2100)
    systems: Optional[List[str]] = Field(
        None,
        description="예: ems, erp, ehs, plm, srm, hr. 생략 시 HR·SRM 등 기본 6종 (mdg 제외)",
    )
    include_mdg: bool = Field(False, description="True일 때 staging_mdg_data 포함")
    dry_run: bool = Field(False, description="True면 DB 미적재, 매핑 결과만 반환")
    include_if_year_missing: bool = Field(
        True,
        description="item에 연도 컬럼이 없으면 period_year로 간주",
    )


class GhgBuildFromStagingResponse(BaseModel):
    status: str
    company_id: str
    period_year: int
    inserted: int = 0
    updated: int = 0
    dry_run: bool = False
    total_mapped: Optional[int] = None
    per_system: Dict[str, Any] = Field(default_factory=dict)
    sample: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None


class GhgBuildAsyncAcceptedResponse(BaseModel):
    job_id: str
    status: str = "queued"
    poll_url_hint: str = Field(
        ...,
        description="GET /esg-data/ghg/build-jobs/{job_id} 로 상태 조회",
    )


class GhgBuildJobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


async def _run_ghg_build_job(job_id: str, payload: Dict[str, Any]) -> None:
    ghg_build_job_store.mark_running(job_id)
    try:
        orch = GhgActivityOrchestrator()
        result = await orch.build_from_staging_async(
            payload["company_id"],
            int(payload["period_year"]),
            systems=payload.get("systems"),
            include_mdg=bool(payload.get("include_mdg", False)),
            dry_run=bool(payload.get("dry_run", False)),
            include_if_year_missing=bool(payload.get("include_if_year_missing", True)),
        )
        ghg_build_job_store.complete(job_id, result)
    except Exception as e:
        logger.exception("ghg build job 실패 job_id={}", job_id)
        ghg_build_job_store.fail(job_id, str(e))


@ghg_router.post(
    "/build-from-staging",
    response_model=GhgBuildFromStagingResponse,
    summary="스테이징 → ghg_activity_data 적재",
)
async def ghg_build_from_staging(request: GhgBuildFromStagingRequest) -> GhgBuildFromStagingResponse:
    orch = GhgActivityOrchestrator()
    raw = await orch.build_from_staging_async(
        request.company_id,
        request.period_year,
        systems=request.systems,
        include_mdg=request.include_mdg,
        dry_run=request.dry_run,
        include_if_year_missing=request.include_if_year_missing,
    )
    return GhgBuildFromStagingResponse(
        status=raw.get("status", "success"),
        company_id=raw.get("company_id", request.company_id),
        period_year=raw.get("period_year", request.period_year),
        inserted=int(raw.get("inserted") or 0),
        updated=int(raw.get("updated") or 0),
        dry_run=bool(raw.get("dry_run")),
        total_mapped=raw.get("total_mapped"),
        per_system=dict(raw.get("per_system") or {}),
        sample=raw.get("sample"),
        message=raw.get("message"),
    )


@ghg_router.post(
    "/build-from-staging-async",
    response_model=GhgBuildAsyncAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="스테이징 → ghg_activity_data 적재 (비동기)",
)
async def ghg_build_from_staging_async(
    request: GhgBuildFromStagingRequest,
    background_tasks: BackgroundTasks,
) -> GhgBuildAsyncAcceptedResponse:
    """백그라운드에서 빌드 실행. 즉시 job_id 반환 후 폴링으로 완료 확인."""
    job_id = ghg_build_job_store.create()
    payload = request.model_dump()
    background_tasks.add_task(_run_ghg_build_job, job_id, payload)
    return GhgBuildAsyncAcceptedResponse(
        job_id=job_id,
        status="queued",
        poll_url_hint=f"/esg-data/ghg/build-jobs/{job_id}",
    )


@ghg_router.get(
    "/build-jobs/{job_id}",
    response_model=GhgBuildJobStatusResponse,
    summary="비동기 GHG 빌드 작업 상태",
)
async def ghg_build_job_status(job_id: str) -> GhgBuildJobStatusResponse:
    row = ghg_build_job_store.get(job_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown job_id")
    return GhgBuildJobStatusResponse(
        job_id=job_id,
        status=row["status"],
        created_at=row.get("created_at"),
        started_at=row.get("started_at"),
        finished_at=row.get("finished_at"),
        result=row.get("result"),
        error=row.get("error"),
    )


@ghg_router.get(
    "/activity-data/export",
    summary="ghg_activity_data 전체 컬럼 JSON보내기",
    response_class=Response,
)
async def ghg_activity_data_export(
    company_id: str = Query(..., description="companies.id (UUID)"),
    period_year: int = Query(..., ge=1900, le=2100),
    tab_type: Optional[str] = Query(None, description="지정 시 해당 tab_type만"),
    omit_nulls: bool = Query(
        False,
        description="True면 null 컬럼 제외(용량 축소). False면 DB와 동일하게 모든 컬럼 키 포함",
    ),
    compact: bool = Query(False, description="True면 들여쓰기 없는 한 줄 JSON"),
    download: bool = Query(True, description="True면 Content-Disposition 첨부파일"),
) -> Response:
    """수치는 JSON number, UUID/날짜는 문자열. 기본은 null 포함·pretty print."""
    orch = GhgActivityOrchestrator()
    data = await orch.export_activity_json_async(
        company_id,
        period_year,
        tab_type=tab_type,
        omit_nulls=omit_nulls,
    )
    body = json.dumps(data, ensure_ascii=False, indent=None if compact else 2)
    headers: Dict[str, str] = {"Content-Type": "application/json; charset=utf-8"}
    if download:
        headers["Content-Disposition"] = (
            f'attachment; filename="ghg_activity_data_{company_id}_{period_year}.json"'
        )
    return Response(content=body, media_type="application/json; charset=utf-8", headers=headers)


@ghg_router.get(
    "/activity-data/summary",
    summary="ghg_activity_data 연도별 건수·tab_type 분포",
)
async def ghg_activity_data_summary(
    company_id: str = Query(...),
    period_year: int = Query(..., ge=1900, le=2100),
) -> Dict[str, Any]:
    orch = GhgActivityOrchestrator()
    return await orch.summarize_activity_async(company_id, period_year)

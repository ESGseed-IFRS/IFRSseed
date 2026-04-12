"""스테이징 수집 API — SDS_ESG_DATA CSV → 6개 스테이징 테이블"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.domain.v1.data_integration.hub.orchestrator import StagingIngestionOrchestrator
from backend.domain.v1.ghg_calculation.models.states import GhgStagingSyncValidationBlockVo
from backend.domain.v1.data_integration.hub.services.staging_csv_file_upload_service import (
    StagingCsvFileUploadService,
)

staging_router = APIRouter(prefix="/staging", tags=["Staging Ingestion"])

_MAX_CSV_BYTES = 10 * 1024 * 1024


class StagingIngestRequest(BaseModel):
    """회사별 데모/수집 루트 경로와 회사 ID (해당 폴더 바로 아래 EMS, ERP … 시스템 폴더가 있어야 함)."""
    base_path: str = Field(
        ...,
        description="회사 폴더 절대 경로 (예: …/SDS_ESG_DATA_REAL/subsidiary_○○주식회사). 그 안의 EMS/*.csv 등이 staging_* 테이블로 적재됩니다.",
    )
    company_id: str = Field(..., description="companies.id (UUID)")
    systems: Optional[List[str]] = Field(
        default=None,
        description="처리할 시스템. 비우면 ems,erp,ehs,plm,srm,hr,mdg 전체",
    )


class StagingIngestResponse(BaseModel):
    success: bool
    message: str
    total_rows_imported: int
    results: dict


class StagingCsvInsertItem(BaseModel):
    system: str
    staging_id: str
    item_count: int


class StagingCsvUploadResponse(BaseModel):
    success: bool
    message: str
    ingest_source: str = "file_upload"
    ingest_source_label: str = "파일 업로드"
    ghg_raw_category: Optional[str] = Field(
        default=None,
        description="CSV ghg_raw_category 열에서 판별한 값(전 행 동일).",
    )
    inserts: List[StagingCsvInsertItem]
    sync_validation: List[GhgStagingSyncValidationBlockVo] = Field(
        default_factory=list,
        description="저장 직후 GHG 동기 검증 결과(스키마·음수·업로드 내 중복).",
    )
    timeseries_scan: Optional[dict[str, Any]] = Field(
        default=None,
        description="저장 직후 시계열 이상치 스캔 요약(findings_count, series_evaluated).",
    )


@staging_router.post("/upload-csv", response_model=StagingCsvUploadResponse)
async def staging_upload_csv(
    company_id: str = Form(..., description="companies.id (UUID)"),
    file: UploadFile = File(
        ...,
        description="source_system 열 필수. ghg_raw_category 열이 있으면 그 값 사용, 없으면 헤더·파일명으로 추정.",
    ),
) -> StagingCsvUploadResponse:
    """
    CSV 1개 업로드 → 행의 source_system(EMS/ERP/…)에 맞는 staging_*_data에 적재.
    ghg_raw_category: CSV에 열이 있으면 전 행 동일 값 사용, 없으면 헤더·파일명 추정.
    ingest_source는 file_upload(표시: 파일 업로드).
    """
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드할 수 있습니다.")
    content = await file.read()
    if len(content) > _MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")

    service = StagingCsvFileUploadService()
    result = await asyncio.to_thread(service.ingest_uploaded_csv, content, filename, company_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    inserts = [StagingCsvInsertItem(**x) for x in result["inserts"]]
    sync_val = [GhgStagingSyncValidationBlockVo(**x) for x in (result.get("sync_validation") or [])]
    return StagingCsvUploadResponse(
        success=True,
        message=result["message"],
        inserts=inserts,
        ghg_raw_category=result.get("ghg_raw_category"),
        sync_validation=sync_val,
        timeseries_scan=result.get("timeseries_scan"),
    )


@staging_router.post("/ingest", response_model=StagingIngestResponse)
async def staging_ingest(req: StagingIngestRequest) -> StagingIngestResponse:
    """
    `base_path` 아래 EMS/ERP/EHS/PLM/SRM/HR/MDG 폴더의 CSV를 파싱해
    각 staging_*_data 테이블에 적재합니다. (재계산은 이 DB만 읽습니다.)
    """
    base_path = Path(req.base_path)
    if not base_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Base path not found: {base_path}")

    try:
        orchestrator = StagingIngestionOrchestrator()
        result = await asyncio.to_thread(
            orchestrator.execute,
            base_path,
            req.company_id,
            req.systems,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return StagingIngestResponse(
        success=result["success"],
        message=result["message"],
        total_rows_imported=result["total_rows_imported"],
        results=result["results"],
    )

"""스테이징 수집 API — SDS_ESG_DATA CSV → 6개 스테이징 테이블"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.domain.v1.data_integration.hub.orchestrator import StagingIngestionOrchestrator


staging_router = APIRouter(prefix="/staging", tags=["Staging Ingestion"])


class StagingIngestRequest(BaseModel):
    """SDS_ESG_DATA 경로와 회사 ID"""
    base_path: str = Field(..., description="SDS_ESG_DATA 루트 폴더 경로 (예: C:/data/SDS_ESG_DATA)")
    company_id: str = Field(..., description="companies.id (UUID)")
    systems: Optional[List[str]] = Field(
        default=None,
        description="처리할 시스템. 비우면 ems,erp,ehs,plm,srm,hr 전체",
    )


class StagingIngestResponse(BaseModel):
    success: bool
    message: str
    total_rows_imported: int
    results: dict


@staging_router.post("/ingest", response_model=StagingIngestResponse)
async def staging_ingest(req: StagingIngestRequest) -> StagingIngestResponse:
    """
    SDS_ESG_DATA 폴더 내 EMS/ERP/EHS/PLM/SRM/HR CSV를 파싱해
    각 staging_*_data 테이블에 적재합니다.
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

"""외부 기업 스냅샷 적재 API — 삼성SDS 언론보도 등."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.core.config.settings import get_settings
from backend.domain.v1.data_integration.hub.orchestrator import SdsNewsIngestOrchestrator
from backend.domain.v1.data_integration.hub.repositories.ingest_state_repository import (
    ingest_state_repository_context,
)
from backend.domain.v1.data_integration.hub.services.external_company.sds_news_ingest_service import (
    TASK_KEY as SDS_NEWS_TASK_KEY,
)

external_company_router = APIRouter(prefix="/external-company", tags=["External Company Data"])


class SdsNewsIngestRequest(BaseModel):
    """`SDS_ANCHOR_COMPANY_ID`가 있으면 anchor_company_id 생략 가능."""

    anchor_company_id: Optional[str] = Field(
        default=None,
        description="companies.id (UUID). 미입력 시 환경변수 SDS_ANCHOR_COMPANY_ID 사용.",
    )
    dry_run: bool = Field(default=False, description="True면 DB에 쓰지 않고 수집·매핑만 수행")
    fetch_full_content: bool = Field(
        default=True,
        description="3단계 크롤 (목록→1차 상세→외부 기사 본문). False면 1단계만.",
    )
    check_etag: bool = Field(
        default=True,
        description="ETag 기반 변경 감지. False면 항상 크롤.",
    )
    max_items: Optional[int] = Field(
        default=None,
        ge=1,
        description="이번 실행에서 처리할 목록 상한. 미입력 시 SDS_NEWS_MAX_ITEMS_PER_RUN(0=무제한).",
    )


class SdsNewsIngestResponse(BaseModel):
    source: str
    inserted: int
    updated: int
    skipped: int
    error_count: int
    errors: List[str] = Field(default_factory=list)
    dry_run_row_count: Optional[int] = None
    feed_etag: Optional[str] = None
    feed_last_modified: Optional[str] = None
    fetched_at: Optional[datetime] = None
    unchanged: bool = Field(default=False, description="ETag 동일로 early return 시 True")
    list_items_total: Optional[int] = Field(default=None, description="목록 파싱 건수(캡 적용 전)")
    list_items_processed: Optional[int] = Field(default=None, description="캡 적용 후 처리 건수")


class SdsNewsIngestStateRow(BaseModel):
    """`ingest_state` 한 행 (진단용)."""

    last_etag: Optional[str] = None
    last_modified: Optional[str] = None
    last_list_source: Optional[str] = Field(
        default=None,
        description="목록 출처 html | news_txt (ETag 비교 시 HEAD 대상)",
    )
    last_fetch_at: Optional[datetime] = None
    last_ingest_batch_id: Optional[str] = None
    updated_at: Optional[datetime] = None


class SdsNewsIngestStateResponse(BaseModel):
    task_key: str
    row: Optional[SdsNewsIngestStateRow] = None


@external_company_router.get("/sds-news/ingest-state", response_model=SdsNewsIngestStateResponse)
def read_sds_news_ingest_state() -> SdsNewsIngestStateResponse:
    """
    SDS 뉴스 ingest용 `ingest_state` 행 조회 (읽기 전용, ETag/소스 디버깅).
    """
    if not (get_settings().database_url or "").strip():
        raise HTTPException(status_code=503, detail="DATABASE_URL이 설정되지 않았습니다.")
    with ingest_state_repository_context() as repo:
        if repo is None:
            raise HTTPException(status_code=503, detail="DB 세션을 열 수 없습니다.")
        r = repo.get_by_task_key(SDS_NEWS_TASK_KEY)
    if r is None:
        return SdsNewsIngestStateResponse(task_key=SDS_NEWS_TASK_KEY, row=None)
    row = SdsNewsIngestStateRow(
        last_etag=r.last_etag,
        last_modified=r.last_modified,
        last_list_source=getattr(r, "last_list_source", None),
        last_fetch_at=r.last_fetch_at,
        last_ingest_batch_id=str(r.last_ingest_batch_id) if r.last_ingest_batch_id else None,
        updated_at=r.updated_at,
    )
    return SdsNewsIngestStateResponse(task_key=SDS_NEWS_TASK_KEY, row=row)


@external_company_router.post("/sds-news/ingest", response_model=SdsNewsIngestResponse)
async def ingest_sds_news(req: SdsNewsIngestRequest) -> SdsNewsIngestResponse:
    """
    삼성SDS 언론보도를 3단계 크롤 (목록→1차 상세→외부 기사)해
    `external_company_data`에 멱등 upsert합니다.
    
    - HTML `#bThumbs`/`#sThumbs` 우선, `news.txt` JSON 폴백
    - ETag 기반 변경 감지로 불필요한 크롤 스킵
    - 병렬 처리 (Settings.sds_news_concurrency)
    
    Data Integration API(`backend/api/v1/data_integration/main.py`)와 동일 프로세스에서 실행됩니다.
    """
    aid: uuid.UUID | None = None
    if req.anchor_company_id:
        try:
            aid = uuid.UUID(req.anchor_company_id.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="anchor_company_id는 유효한 UUID여야 합니다.")

    def _run():
        return SdsNewsIngestOrchestrator().execute(
            aid,
            dry_run=req.dry_run,
            fetch_full_content=req.fetch_full_content,
            check_etag=req.check_etag,
            max_items=req.max_items,
        )

    try:
        r = await asyncio.to_thread(_run)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    dry_n = len(r.dry_run_rows) if r.dry_run_rows is not None else None
    return SdsNewsIngestResponse(
        source=r.source,
        inserted=r.inserted,
        updated=r.updated,
        skipped=r.skipped,
        error_count=len(r.errors),
        errors=r.errors[:50],
        dry_run_row_count=dry_n,
        feed_etag=r.feed_etag,
        feed_last_modified=r.feed_last_modified,
        fetched_at=r.fetched_at,
        unchanged=r.unchanged,
        list_items_total=r.list_items_total,
        list_items_processed=r.list_items_processed,
    )

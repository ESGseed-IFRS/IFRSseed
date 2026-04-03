"""삼성SDS 언론보도 적재 오케스트레이터 — `SdsNewsIngestService` 조율."""

from __future__ import annotations

import uuid

from backend.core.config.settings import get_settings
from backend.domain.v1.data_integration.models.states import IngestResult

from ..services.external_company.sds_news_constants import ENV_ANCHOR_COMPANY_ID
from ..services.external_company.sds_news_ingest_service import SdsNewsIngestService


class SdsNewsIngestOrchestrator:
    """
    앵커 회사 UUID 해석 후 `SdsNewsIngestService.run_ingest`를 호출합니다.
    `ingest_state` 접근은 서비스 내부에서 짧은 세션으로 수행합니다 (장시간 크롤과 DB 연결 분리).
    """

    def __init__(
        self,
        service: SdsNewsIngestService | None = None,
        *,
        list_page_url: str | None = None,
    ) -> None:
        self._service = service or SdsNewsIngestService(list_page_url=list_page_url)

    @staticmethod
    def _resolve_anchor(anchor_company_id: uuid.UUID | None) -> uuid.UUID:
        if anchor_company_id is not None:
            return anchor_company_id
        raw = get_settings().sds_anchor_company_id
        if not raw:
            raise ValueError(
                f"{ENV_ANCHOR_COMPANY_ID} 환경변수를 설정하거나 anchor_company_id 인자를 넘기세요."
            )
        return uuid.UUID(raw.strip())

    def execute(
        self,
        anchor_company_id: uuid.UUID | None = None,
        *,
        fetch_full_content: bool = True,  # 3단계 크롤 (기본 활성화)
        dry_run: bool = False,
        check_etag: bool = True,  # 변경 감지 (기본 활성화)
        max_items: int | None = None,
    ) -> IngestResult:
        aid = self._resolve_anchor(anchor_company_id)
        return self._service.run_ingest(
            aid,
            fetch_full_content=fetch_full_content,
            dry_run=dry_run,
            check_etag=check_etag,
            max_items=max_items,
        )


def run_sds_news_ingest(
    anchor_company_id: uuid.UUID | None = None,
    *,
    fetch_full_content: bool = True,
    dry_run: bool = False,
    check_etag: bool = True,
    max_items: int | None = None,
    list_page_url: str | None = None,
) -> IngestResult:
    """편의 함수: 오케스트레이터 `execute`와 동일."""
    return SdsNewsIngestOrchestrator(list_page_url=list_page_url).execute(
        anchor_company_id,
        fetch_full_content=fetch_full_content,
        dry_run=dry_run,
        check_etag=check_etag,
        max_items=max_items,
    )


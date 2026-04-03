"""스테이징 → social_data 빌드 오케스트레이터 (UCM과 동일하게 async 진입점 제공)."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.v1.esg_data.hub.services.social_data_build_service import SocialDataBuildService


class SocialDataOrchestrator:
    """
    HTTP 등 비동기 경계에서 `SocialDataBuildService`를 호출한다.
    동기 DB·집계는 `asyncio.to_thread`로 실행한다.
    """

    def __init__(self, build_service: Optional[SocialDataBuildService] = None) -> None:
        self._service = build_service or SocialDataBuildService()

    async def build_from_staging_async(
        self,
        company_id: str,
        period_year: int,
        *,
        dry_run: bool = False,
        include_if_year_missing: bool = True,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._service.build_from_staging,
            company_id,
            period_year,
            dry_run=dry_run,
            include_if_year_missing=include_if_year_missing,
        )

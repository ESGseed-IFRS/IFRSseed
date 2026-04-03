"""GHG Raw 동기·시계열 이상치 오케스트레이션."""
from __future__ import annotations

import uuid
from typing import Any

from loguru import logger

from backend.domain.v1.ghg_calculation.hub.repositories.ghg_anomaly_result_repository import (
    GhgAnomalyResultRepository,
)
from backend.domain.v1.ghg_calculation.hub.services.ghg_raw_sync_validation_service import (
    GhgRawSyncValidationService,
)
from backend.domain.v1.ghg_calculation.models.states import (
    GhgAnomalyFindingVo,
    GhgAnomalyScanRequestDto,
    GhgAnomalyScanResponseDto,
)

_DEFAULT_TS_CATEGORIES = ("energy", "waste", "pollution", "chemical")


class GhgAnomalyOrchestrator:
    def __init__(
        self,
        sync_service: GhgRawSyncValidationService | None = None,
        timeseries_service: Any = None,
        result_repository: GhgAnomalyResultRepository | None = None,
    ):
        self._sync = sync_service or GhgRawSyncValidationService()
        self._ts = timeseries_service
        self._results = result_repository

    def validate_upload_items(
        self,
        items: list[dict[str, Any]],
        ghg_raw_category: str,
        *,
        staging_system: str | None = None,
        staging_id: str | None = None,
    ) -> list[GhgAnomalyFindingVo]:
        return self._sync.validate_items(
            items,
            ghg_raw_category,
            staging_system=staging_system,
            staging_id=staging_id,
        )

    def scan_timeseries(self, req: GhgAnomalyScanRequestDto) -> GhgAnomalyScanResponseDto:
        from backend.domain.v1.ghg_calculation.hub.services.ghg_raw_timeseries_anomaly_service import (
            GhgRawTimeseriesAnomalyService,
        )

        ts = self._ts or GhgRawTimeseriesAnomalyService()
        return ts.scan(req)

    def persist_default_timeseries_scan(self, company_id: str | uuid.UUID) -> GhgAnomalyScanResponseDto | None:
        """업로드·적재 직후와 동일한 기본 옵션으로 시계열 스캔 후 DB에 최신본 저장."""
        try:
            cid = uuid.UUID(str(company_id))
            req = GhgAnomalyScanRequestDto(
                company_id=cid,
                categories=list(_DEFAULT_TS_CATEGORIES),
                group_by_system=True,
            )
            res = self.scan_timeseries(req)
            repo = self._results or GhgAnomalyResultRepository()
            repo.upsert_latest(cid, res.model_dump(mode="json"))
            return res
        except Exception:
            logger.exception("[GhgAnomalyOrch] persist_default_timeseries_scan failed company_id={}", company_id)
            return None

    def get_latest_persisted_scan(self, company_id: str | uuid.UUID) -> GhgAnomalyScanResponseDto | None:
        repo = self._results or GhgAnomalyResultRepository()
        raw = repo.get_latest_payload(company_id)
        if not raw:
            return None
        return GhgAnomalyScanResponseDto.model_validate(raw)

    def persist_scan_response(
        self,
        company_id: str | uuid.UUID,
        res: GhgAnomalyScanResponseDto,
    ) -> None:
        repo = self._results or GhgAnomalyResultRepository()
        repo.upsert_latest(company_id, res.model_dump(mode="json"))

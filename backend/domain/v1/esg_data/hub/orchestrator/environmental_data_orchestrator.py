"""비동기 경계에서 `environmental_data` GHG 기반 빌드."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.v1.esg_data.hub.services.environmental_data_build_service import EnvironmentalDataBuildService


class EnvironmentalDataOrchestrator:
    def __init__(self, build_service: Optional[EnvironmentalDataBuildService] = None) -> None:
        self._service = build_service or EnvironmentalDataBuildService()

    async def build_from_ghg_async(
        self,
        company_id: str,
        period_year: int,
        *,
        calculation_basis: str = "location",
        dry_run: bool = False,
        status: str = "draft",
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._service.build_from_ghg,
            company_id,
            period_year,
            calculation_basis=calculation_basis,
            dry_run=dry_run,
            status=status,
        )

"""비동기 경계에서 `environmental_data` GHG 기반 빌드."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.v1.esg_data.hub.services.environmental_data_build_service import (
    DEFAULT_GROUP_AGGREGATE_TARGET_COMPANY_ID,
    EnvironmentalDataBuildService,
)


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

    async def build_group_aggregate_async(
        self,
        holding_company_id: str,
        period_year: int,
        *,
        calculation_basis: str = "location",
        target_company_id: str | None = None,
        frozen_only: bool = False,
        dry_run: bool = False,
        status: str = "draft",
        trust_client_totals: bool = False,
        client_scope1_total_tco2e: float | None = None,
        client_scope2_total_tco2e: float | None = None,
        client_scope3_total_tco2e: float | None = None,
    ) -> Dict[str, Any]:
        tgt = target_company_id or DEFAULT_GROUP_AGGREGATE_TARGET_COMPANY_ID
        return await asyncio.to_thread(
            self._service.build_group_aggregate_to_environmental,
            holding_company_id,
            period_year,
            calculation_basis=calculation_basis,
            target_company_id=tgt,
            frozen_only=frozen_only,
            dry_run=dry_run,
            status=status,
            trust_client_totals=trust_client_totals,
            client_scope1_total_tco2e=client_scope1_total_tco2e,
            client_scope2_total_tco2e=client_scope2_total_tco2e,
            client_scope3_total_tco2e=client_scope3_total_tco2e,
        )

"""스테이징 → ghg_activity_data 빌드 오케스트레이터."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional, Sequence

from backend.domain.v1.esg_data.hub.repositories.ghg_activity_repository import GhgActivityRepository
from backend.domain.v1.esg_data.hub.services.ghg_activity_build_service import GhgActivityBuildService


class GhgActivityOrchestrator:
    def __init__(
        self,
        build_service: Optional[GhgActivityBuildService] = None,
        ghg_repository: Optional[GhgActivityRepository] = None,
    ) -> None:
        self._service = build_service or GhgActivityBuildService()
        self._repo = ghg_repository or GhgActivityRepository()

    async def build_from_staging_async(
        self,
        company_id: str,
        period_year: int,
        *,
        systems: Optional[Sequence[str]] = None,
        include_mdg: bool = False,
        include_if_year_missing: bool = True,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._service.build_from_staging,
            company_id,
            period_year,
            systems=systems,
            include_mdg=include_mdg,
            include_if_year_missing=include_if_year_missing,
            dry_run=dry_run,
        )

    async def export_activity_json_async(
        self,
        company_id: str,
        period_year: int,
        *,
        tab_type: Optional[str] = None,
        omit_nulls: bool = False,
    ) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(
            self._repo.export_json_dicts,
            company_id,
            period_year,
            tab_type=tab_type,
            omit_nulls=omit_nulls,
        )

    async def summarize_activity_async(self, company_id: str, period_year: int) -> Dict[str, Any]:
        return await asyncio.to_thread(self._summarize_activity, company_id, period_year)

    def _summarize_activity(self, company_id: str, period_year: int) -> Dict[str, Any]:
        from collections import Counter

        rows = self._repo.list_by_company_year(company_id, period_year)
        tabs = Counter(r.tab_type for r in rows)
        return {
            "company_id": company_id,
            "period_year": period_year,
            "total": len(rows),
            "by_tab_type": dict(sorted(tabs.items(), key=lambda x: (-x[1], x[0]))),
        }

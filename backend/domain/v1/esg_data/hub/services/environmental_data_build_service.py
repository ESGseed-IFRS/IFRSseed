"""`ghg_emission_results` + `ghg_activity_data` → `environmental_data` 연간 행."""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from backend.domain.v1.esg_data.hub.repositories.environmental_data_repository import EnvironmentalDataRepository
from backend.domain.v1.esg_data.hub.repositories.ghg_activity_repository import GhgActivityRepository
from backend.domain.v1.esg_data.hub.repositories.ghg_emission_results_repository import GhgEmissionResultsRepository
from backend.domain.v1.esg_data.hub.services.environmental_aggregate_service import aggregate_activity_for_environmental


class EnvironmentalDataBuildService:
    def __init__(
        self,
        ghg_repo: Optional[GhgActivityRepository] = None,
        emission_repo: Optional[GhgEmissionResultsRepository] = None,
        env_repo: Optional[EnvironmentalDataRepository] = None,
    ) -> None:
        self._ghg = ghg_repo or GhgActivityRepository()
        self._emission = emission_repo or GhgEmissionResultsRepository()
        self._env = env_repo or EnvironmentalDataRepository()

    def build_from_ghg(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        *,
        calculation_basis: str = "location",
        dry_run: bool = False,
        status: str = "draft",
    ) -> Dict[str, Any]:
        cid_str = str(company_id) if isinstance(company_id, uuid.UUID) else str(company_id)
        activities = self._ghg.list_by_company_year(company_id, period_year)
        agg = aggregate_activity_for_environmental(activities)
        er = self._emission.get_annual(company_id, period_year, calculation_basis=calculation_basis)

        fields: Dict[str, Any] = {}
        if er is not None:
            fields["scope1_total_tco2e"] = er.scope1_total_tco2e
            fields["scope2_location_tco2e"] = er.scope2_location_tco2e
            fields["scope2_market_tco2e"] = er.scope2_market_tco2e
            fields["scope3_total_tco2e"] = er.scope3_total_tco2e
            fields["ghg_calculation_version"] = er.calculation_version

        for k, v in agg.items():
            if v is not None:
                fields[k] = v

        fields["ghg_data_source"] = "ghg_emission_results+ghg_activity_data"

        summary = {
            "emission_result_found": er is not None,
            "activity_row_count": len(activities),
            "calculation_basis": (calculation_basis or "location").strip().lower(),
        }

        if dry_run:
            return {
                "status": "success",
                "company_id": cid_str,
                "period_year": period_year,
                "dry_run": True,
                "summary": summary,
                "fields": {k: fields[k] for k in sorted(fields) if fields[k] is not None},
            }

        res = self._env.upsert_annual(company_id, period_year, fields, status=status)
        return {
            **res,
            "company_id": cid_str,
            "period_year": period_year,
            "summary": summary,
        }

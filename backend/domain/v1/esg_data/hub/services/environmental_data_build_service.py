"""`ghg_emission_results` + `ghg_activity_data` → `environmental_data` 연간 행."""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from backend.domain.v1.ghg_calculation.hub.repositories.ghg_emission_result_repository import (
    GhgEmissionResultRepository,
)
from backend.domain.v1.esg_data.hub.repositories.environmental_data_repository import EnvironmentalDataRepository
from backend.domain.v1.esg_data.hub.repositories.ghg_activity_repository import GhgActivityRepository
from backend.domain.v1.esg_data.hub.repositories.ghg_emission_results_repository import GhgEmissionResultsRepository
from backend.domain.v1.esg_data.hub.services.environmental_aggregate_service import aggregate_activity_for_environmental

DEFAULT_GROUP_AGGREGATE_TARGET_COMPANY_ID = "550e8400-e29b-41d4-a716-446655440001"


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

    def build_group_aggregate_to_environmental(
        self,
        holding_company_id: str | uuid.UUID,
        period_year: int,
        *,
        calculation_basis: str = "location",
        target_company_id: str | uuid.UUID = DEFAULT_GROUP_AGGREGATE_TARGET_COMPANY_ID,
        frozen_only: bool = False,
        dry_run: bool = False,
        status: str = "draft",
        trust_client_totals: bool = False,
        client_scope1_total_tco2e: Optional[float] = None,
        client_scope2_total_tco2e: Optional[float] = None,
        client_scope3_total_tco2e: Optional[float] = None,
    ) -> Dict[str, Any]:
        """지주 그룹 ghg_emission_results 합산 + 동일 법인들의 ghg_activity_data 집계 → environmental_data 1행 upsert."""
        hid_str = str(holding_company_id) if isinstance(holding_company_id, uuid.UUID) else str(holding_company_id)
        target_str = (
            str(target_company_id) if isinstance(target_company_id, uuid.UUID) else str(target_company_id)
        )
        basis = (calculation_basis or "location").strip().lower() or "location"

        grp = GhgEmissionResultRepository()
        group_rows = grp.list_group_annual_by_holding(holding_company_id, period_year, calculation_basis)
        if frozen_only:
            group_rows = [r for r in group_rows if r.get("frozen")]

        if trust_client_totals:
            if (
                client_scope1_total_tco2e is None
                or client_scope2_total_tco2e is None
                or client_scope3_total_tco2e is None
            ):
                return {
                    "status": "error",
                    "company_id": target_str,
                    "period_year": period_year,
                    "message": "trust_client_totals이면 scope1/2/3 합계를 모두 지정해야 합니다.",
                    "summary": {"calculation_basis": basis, "trust_client_totals": True},
                }
            s1 = float(client_scope1_total_tco2e)
            s2 = float(client_scope2_total_tco2e)
            s3 = float(client_scope3_total_tco2e)
            row_count = 0
        else:
            if not group_rows:
                return {
                    "status": "error",
                    "company_id": target_str,
                    "period_year": period_year,
                    "message": "집계할 그룹 산정 행이 없습니다.",
                    "summary": {
                        "holding_company_id": hid_str,
                        "calculation_basis": basis,
                        "frozen_only": frozen_only,
                        "row_count": 0,
                    },
                }
            s1 = sum(float(r["scope1_total"]) for r in group_rows)
            s2 = sum(float(r["scope2_total"]) for r in group_rows)
            s3 = sum(float(r["scope3_total"]) for r in group_rows)
            row_count = len(group_rows)

        activity_rows: list[Any] = []
        for cid in {str(r["company_id"]) for r in group_rows}:
            activity_rows.extend(self._ghg.list_by_company_year(cid, period_year))
        activity_agg = aggregate_activity_for_environmental(activity_rows)

        fields: Dict[str, Any] = {
            "scope1_total_tco2e": s1,
            "scope3_total_tco2e": s3,
            "ghg_data_source": "group_aggregate+ghg_activity_data",
            "ghg_calculation_version": "client_reported" if trust_client_totals else "group_scope_sum_v1",
        }
        # 그룹 조회의 scope2는 위치+시장 합산값이므로, 기준에 맞는 컬럼 한쪽에만 기록합니다.
        if basis == "market":
            fields["scope2_market_tco2e"] = s2
            fields["scope2_location_tco2e"] = None
        else:
            fields["scope2_location_tco2e"] = s2
            fields["scope2_market_tco2e"] = None

        for k, v in activity_agg.items():
            if v is not None:
                fields[k] = v

        summary: Dict[str, Any] = {
            "holding_company_id": hid_str,
            "target_company_id": target_str,
            "calculation_basis": basis,
            "frozen_only": frozen_only,
            "trust_client_totals": trust_client_totals,
            "row_count": row_count,
            "activity_row_count": len(activity_rows),
            "activity_company_count": len({str(r["company_id"]) for r in group_rows}),
            "scope1_total_tco2e": s1,
            "scope2_total_tco2e": s2,
            "scope3_total_tco2e": s3,
        }
        if group_rows:
            summary["company_ids"] = [str(r["company_id"]) for r in group_rows]

        if dry_run:
            return {
                "status": "success",
                "company_id": target_str,
                "period_year": period_year,
                "dry_run": True,
                "summary": summary,
                "fields": {k: fields[k] for k in sorted(fields) if fields[k] is not None},
            }

        res = self._env.upsert_annual(target_str, period_year, fields, status=status)
        return {
            **res,
            "company_id": target_str,
            "period_year": period_year,
            "summary": summary,
        }

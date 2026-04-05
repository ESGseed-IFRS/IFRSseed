"""ghg_emission_results upsert / 조회 (DATABASE_TABLES_STRUCTURE.md)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session


class GhgEmissionResultRepository:
    def upsert_annual_scope_calc(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        calculation_basis: str,
        scope1_total: float,
        scope1_fixed: float,
        scope1_mobile: float,
        scope2_location: float | None,
        scope2_market: float | None,
        scope3_total: float,
        grand_total: float,
        monthly_scope_breakdown: dict[str, Any],
        scope_line_items: dict[str, Any],
        emission_factor_bundle_version: str,
        verification_status: str = "draft",
    ) -> datetime:
        if isinstance(company_id, str):
            company_id = uuid.UUID(company_id)
        now = datetime.now(timezone.utc)
        basis = (calculation_basis or "location").strip() or "location"
        session = get_session()
        try:
            session.execute(
                text(
                    """
                    INSERT INTO ghg_emission_results (
                      company_id, period_year, period_month,
                      scope1_total_tco2e, scope1_fixed_combustion_tco2e, scope1_mobile_combustion_tco2e,
                      scope1_fugitive_tco2e, scope1_incineration_tco2e,
                      scope2_location_tco2e, scope2_market_tco2e, scope2_renewable_tco2e,
                      scope3_total_tco2e, scope3_category_1_tco2e, scope3_category_4_tco2e,
                      scope3_category_6_tco2e, scope3_category_7_tco2e, scope3_category_9_tco2e,
                      scope3_category_11_tco2e, scope3_category_12_tco2e,
                      total_tco2e,
                      applied_framework, calculation_version,
                      calculation_basis, monthly_scope_breakdown, scope_line_items,
                      emission_factor_bundle_version, verification_status,
                      created_at, updated_at
                    ) VALUES (
                      :company_id, :period_year, NULL,
                      :s1tot, :s1fix, :s1mob,
                      0, 0,
                      :s2loc, :s2mkt, 0,
                      :s3tot, 0, 0, 0, 0, 0, 0, 0,
                      :grand,
                      'GHG_Protocol', :calc_ver,
                      :basis, CAST(:monthly AS jsonb), CAST(:lines AS jsonb),
                      :efv, :vstat,
                      :ts, :ts
                    )
                    ON CONFLICT (company_id, period_year, calculation_basis) WHERE (period_month IS NULL)
                    DO UPDATE SET
                      scope1_total_tco2e = EXCLUDED.scope1_total_tco2e,
                      scope1_fixed_combustion_tco2e = EXCLUDED.scope1_fixed_combustion_tco2e,
                      scope1_mobile_combustion_tco2e = EXCLUDED.scope1_mobile_combustion_tco2e,
                      scope1_fugitive_tco2e = EXCLUDED.scope1_fugitive_tco2e,
                      scope1_incineration_tco2e = EXCLUDED.scope1_incineration_tco2e,
                      scope2_location_tco2e = EXCLUDED.scope2_location_tco2e,
                      scope2_market_tco2e = EXCLUDED.scope2_market_tco2e,
                      scope2_renewable_tco2e = EXCLUDED.scope2_renewable_tco2e,
                      scope3_total_tco2e = EXCLUDED.scope3_total_tco2e,
                      scope3_category_1_tco2e = EXCLUDED.scope3_category_1_tco2e,
                      scope3_category_4_tco2e = EXCLUDED.scope3_category_4_tco2e,
                      scope3_category_6_tco2e = EXCLUDED.scope3_category_6_tco2e,
                      scope3_category_7_tco2e = EXCLUDED.scope3_category_7_tco2e,
                      scope3_category_9_tco2e = EXCLUDED.scope3_category_9_tco2e,
                      scope3_category_11_tco2e = EXCLUDED.scope3_category_11_tco2e,
                      scope3_category_12_tco2e = EXCLUDED.scope3_category_12_tco2e,
                      total_tco2e = EXCLUDED.total_tco2e,
                      calculation_version = EXCLUDED.calculation_version,
                      monthly_scope_breakdown = EXCLUDED.monthly_scope_breakdown,
                      scope_line_items = EXCLUDED.scope_line_items,
                      emission_factor_bundle_version = EXCLUDED.emission_factor_bundle_version,
                      verification_status = EXCLUDED.verification_status,
                      updated_at = EXCLUDED.updated_at
                    """
                ),
                {
                    "company_id": str(company_id),
                    "period_year": period_year,
                    "s1tot": scope1_total,
                    "s1fix": scope1_fixed,
                    "s1mob": scope1_mobile,
                    "s2loc": scope2_location,
                    "s2mkt": scope2_market,
                    "s3tot": scope3_total,
                    "grand": grand_total,
                    "calc_ver": emission_factor_bundle_version,
                    "basis": basis,
                    "monthly": json.dumps(monthly_scope_breakdown),
                    "lines": json.dumps(scope_line_items),
                    "efv": emission_factor_bundle_version,
                    "vstat": verification_status,
                    "ts": now,
                },
            )
            session.commit()
        except Exception:
            session.rollback()
            logger.exception("[GhgEmissionResultRepo] upsert_annual_scope_calc failed")
            raise
        finally:
            session.close()
        return now

    def get_annual_scope_calc(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        calculation_basis: str,
    ) -> dict[str, Any] | None:
        if isinstance(company_id, str):
            company_id = uuid.UUID(company_id)
        basis = (calculation_basis or "location").strip() or "location"
        session = get_session()
        try:
            row = session.execute(
                text(
                    """
                    SELECT scope1_total_tco2e, scope1_fixed_combustion_tco2e, scope1_mobile_combustion_tco2e,
                           scope2_location_tco2e, scope2_market_tco2e,
                           scope3_total_tco2e, total_tco2e,
                           monthly_scope_breakdown, scope_line_items,
                           emission_factor_bundle_version, updated_at, verification_status
                    FROM ghg_emission_results
                    WHERE company_id = :cid AND period_year = :y AND calculation_basis = :b
                      AND period_month IS NULL
                    """
                ),
                {"cid": str(company_id), "y": period_year, "b": basis},
            ).mappings().first()
            if row is None:
                return None
            mb = row["monthly_scope_breakdown"]
            li = row["scope_line_items"]
            if isinstance(mb, str):
                mb = json.loads(mb)
            if isinstance(li, str):
                li = json.loads(li)
            s2loc = row["scope2_location_tco2e"]
            s2mkt = row["scope2_market_tco2e"]
            s2 = float(s2loc or 0) + float(s2mkt or 0)
            return {
                "scope1_total": float(row["scope1_total_tco2e"] or 0),
                "scope2_total": s2,
                "scope3_total": float(row["scope3_total_tco2e"] or 0),
                "grand_total": float(row["total_tco2e"] or 0),
                "monthly_breakdown": mb or {},
                "line_items_payload": li or {},
                "emission_factor_version": row["emission_factor_bundle_version"],
                "calculated_at": row["updated_at"],
                "verification_status": row["verification_status"],
            }
        finally:
            session.close()

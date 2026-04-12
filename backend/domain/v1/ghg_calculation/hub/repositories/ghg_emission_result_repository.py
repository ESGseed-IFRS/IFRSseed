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

    def list_group_annual_by_holding(
        self,
        holding_company_id: str | uuid.UUID,
        period_year: int,
        calculation_basis: str = "location",
    ) -> list[dict[str, Any]]:
        """지주사 본사 + parent가 지주인 자회사·계열사의 연간(location 등) 산정 행."""
        if isinstance(holding_company_id, str):
            holding_company_id = uuid.UUID(holding_company_id)
        hid = str(holding_company_id)
        basis = (calculation_basis or "location").strip() or "location"
        y = int(period_year)
        prev_y = y - 1
        session = get_session()
        try:
            rows = session.execute(
                text(
                    """
                    SELECT
                        c.id AS company_id,
                        c.name AS company_name,
                        CASE WHEN c.id = :hid THEN 'holding' ELSE 'subsidiary' END AS role,
                        COALESCE(e.scope1_total_tco2e, 0)::float AS s1,
                        (COALESCE(e.scope2_location_tco2e, 0) + COALESCE(e.scope2_market_tco2e, 0))::float AS s2,
                        COALESCE(e.scope3_total_tco2e, 0)::float AS s3,
                        COALESCE(e.total_tco2e, 0)::float AS grand,
                        COALESCE(pe.total_tco2e, 0)::float AS prev_grand,
                        e.verification_status AS vstat
                    FROM companies c
                    LEFT JOIN ghg_emission_results e
                      ON e.company_id = c.id
                     AND e.period_year = :y
                     AND e.period_month IS NULL
                     AND e.calculation_basis = :basis
                    LEFT JOIN ghg_emission_results pe
                      ON pe.company_id = c.id
                     AND pe.period_year = :prev_y
                     AND pe.period_month IS NULL
                     AND pe.calculation_basis = :basis
                    WHERE c.id = :hid OR c.parent_company_id = :hid_uuid
                    ORDER BY role DESC, c.name
                    """
                ),
                {"hid": hid, "hid_uuid": holding_company_id, "y": y, "prev_y": prev_y, "basis": basis},
            ).mappings().all()

            out: list[dict[str, Any]] = []
            for r in rows:
                pg = float(r["prev_grand"] or 0)
                out.append(
                    {
                        "company_id": str(r["company_id"]),
                        "name": r["company_name"] or "",
                        "role": r["role"],
                        "scope1_total": float(r["s1"] or 0),
                        "scope2_total": float(r["s2"] or 0),
                        "scope3_total": float(r["s3"] or 0),
                        "grand_total": float(r["grand"] or 0),
                        "prev_grand_total": pg if pg > 0 else None,
                        "frozen": str(r["vstat"] or "").lower() == "verified",
                    }
                )
            return out
        finally:
            session.close()

    def aggregate_group_totals_by_year_range(
        self,
        holding_company_id: str | uuid.UUID,
        year_from: int,
        year_to: int,
        calculation_basis: str = "location",
    ) -> list[dict[str, Any]]:
        """지주+자회사 합산 연도별 총배출 (추세 차트용)."""
        if isinstance(holding_company_id, str):
            holding_company_id = uuid.UUID(holding_company_id)
        hid = str(holding_company_id)
        basis = (calculation_basis or "location").strip() or "location"
        y0 = min(int(year_from), int(year_to))
        y1 = max(int(year_from), int(year_to))
        session = get_session()
        try:
            agg = session.execute(
                text(
                    """
                    SELECT
                        e.period_year AS yr,
                        SUM(COALESCE(e.scope1_total_tco2e, 0))::float AS s1,
                        SUM(COALESCE(e.scope2_location_tco2e, 0) + COALESCE(e.scope2_market_tco2e, 0))::float AS s2,
                        SUM(COALESCE(e.scope3_total_tco2e, 0))::float AS s3,
                        SUM(COALESCE(e.total_tco2e, 0))::float AS grand
                    FROM companies c
                    INNER JOIN ghg_emission_results e
                      ON e.company_id = c.id
                     AND e.period_month IS NULL
                     AND e.calculation_basis = :basis
                     AND e.period_year >= :y0
                     AND e.period_year <= :y1
                    WHERE c.id = :hid OR c.parent_company_id = :hid_uuid
                    GROUP BY e.period_year
                    ORDER BY e.period_year
                    """
                ),
                {"hid": hid, "hid_uuid": holding_company_id, "y0": y0, "y1": y1, "basis": basis},
            ).mappings().all()
            return [
                {
                    "year": int(r["yr"]),
                    "scope1_total": float(r["s1"] or 0),
                    "scope2_total": float(r["s2"] or 0),
                    "scope3_total": float(r["s3"] or 0),
                    "grand_total": float(r["grand"] or 0),
                }
                for r in agg
            ]
        finally:
            session.close()

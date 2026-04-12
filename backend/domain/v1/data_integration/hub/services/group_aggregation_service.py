"""그룹 통합 집계 서비스 - 지주사 + 계열사 배출량 취합 (SQLAlchemy 동기 세션)"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from uuid import UUID

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session


def _emission_sql_fragment(scope: str) -> str:
    if scope == "scope2":
        return "COALESCE(e.scope2_location_tco2e, 0) + COALESCE(e.scope2_market_tco2e, 0)"
    if scope == "scope3":
        return "e.scope3_total_tco2e"
    return "e.scope1_total_tco2e"


class GroupAggregationService:
    """지주사가 계열사 데이터를 취합하는 서비스"""

    def aggregate_group_emissions(
        self,
        holding_company_id: str,
        year: int,
        scope: str,
    ) -> Dict[str, Any]:
        """
        지주사 + 승인된 계열사 배출량 집계.

        scope: 'scope1' | 'scope2' | 'scope3'
        ghg_emission_results: period_year, calculation_basis='location', period_month IS NULL
        """
        if scope not in ("scope1", "scope2", "scope3"):
            scope = "scope1"
        expr = _emission_sql_fragment(scope)
        hid = UUID(holding_company_id)
        session = get_session()
        try:
            holding_row = session.execute(
                text(
                    f"""
                    SELECT c.name AS company_name,
                           COALESCE({expr}, 0) AS total_tco2e
                    FROM companies c
                    LEFT JOIN ghg_emission_results e
                      ON e.company_id = c.id
                     AND e.period_year = :yr
                     AND e.period_month IS NULL
                     AND e.calculation_basis = 'location'
                    WHERE c.id = :hid
                    """
                ),
                {"hid": hid, "yr": year},
            ).mappings().first()

            holding_data = {
                "company_name": (holding_row["company_name"] if holding_row else None) or "지주사",
                "emission_tco2e": float(holding_row["total_tco2e"] or 0) if holding_row else 0.0,
                "site_count": 0,
            }

            subs = session.execute(
                text(
                    """
                    SELECT id, name AS company_name
                    FROM companies
                    WHERE parent_company_id = :hid
                      AND group_entity_type IN ('subsidiary', 'affiliate')
                    ORDER BY name
                    """
                ),
                {"hid": hid},
            ).mappings().all()

            sub_emissions: List[Dict[str, Any]] = []
            for sub in subs:
                approved = session.execute(
                    text(
                        """
                        SELECT 1 FROM subsidiary_data_submissions s
                        WHERE s.subsidiary_company_id = :sid
                          AND s.submission_year = :yr
                          AND s.status = 'approved'
                        LIMIT 1
                        """
                    ),
                    {"sid": sub["id"], "yr": year},
                ).first()
                if not approved:
                    continue

                er = session.execute(
                    text(
                        f"""
                        SELECT c.name AS company_name,
                               COALESCE({expr}, 0) AS total_tco2e
                        FROM companies c
                        LEFT JOIN ghg_emission_results e
                          ON e.company_id = c.id
                         AND e.period_year = :yr
                         AND e.period_month IS NULL
                         AND e.calculation_basis = 'location'
                        WHERE c.id = :sid
                        """
                    ),
                    {"sid": sub["id"], "yr": year},
                ).mappings().first()

                if er and float(er["total_tco2e"] or 0) > 0:
                    sub_emissions.append(
                        {
                            "company_id": str(sub["id"]),
                            "company_name": er["company_name"],
                            "emission_tco2e": float(er["total_tco2e"] or 0),
                            "site_count": 0,
                        }
                    )

            total = holding_data["emission_tco2e"] + sum(s["emission_tco2e"] for s in sub_emissions)
            for s in sub_emissions:
                s["ratio_pct"] = round(s["emission_tco2e"] / total * 100, 1) if total > 0 else 0.0

            logger.info(
                f"그룹 배출량 집계: holding={holding_company_id}, year={year}, scope={scope}, "
                f"total={total:.2f} tCO2e, subsidiaries={len(sub_emissions)}"
            )

            return {
                "holding_company": holding_data,
                "subsidiaries": sub_emissions,
                "group_total": total,
                "scope": scope,
                "year": year,
            }
        finally:
            session.close()

    def get_subsidiary_data_sources(
        self,
        holding_company_id: str,
        year: int,
        dp_id: str,
    ) -> List[Dict[str, Any]]:
        """특정 DP에 대한 데이터 출처 목록 (지주사 + 승인 계열사)."""
        scope_map = {
            "GRI_305-1": "scope1",
            "GRI_305-2": "scope2",
            "GRI_305-3": "scope3",
            "IFRS_S2_29": "scope1",
        }
        scope = scope_map.get(dp_id, "scope1")
        if scope not in ("scope1", "scope2", "scope3"):
            scope = "scope1"
        expr = _emission_sql_fragment(scope)
        hid = UUID(holding_company_id)
        session = get_session()
        try:
            holding_row = session.execute(
                text(
                    f"""
                    SELECT c.id AS company_id,
                           c.name AS company_name,
                           COALESCE({expr}, 0) AS emission_tco2e
                    FROM companies c
                    LEFT JOIN ghg_emission_results e
                      ON e.company_id = c.id
                     AND e.period_year = :yr
                     AND e.period_month IS NULL
                     AND e.calculation_basis = 'location'
                    WHERE c.id = :hid
                    """
                ),
                {"hid": hid, "yr": year},
            ).mappings().first()

            sources: List[Dict[str, Any]] = []
            if holding_row and float(holding_row["emission_tco2e"] or 0) > 0:
                sources.append(
                    {
                        "source_type": "holding_own",
                        "company_id": str(holding_row["company_id"]),
                        "company_name": holding_row["company_name"],
                        "value": float(holding_row["emission_tco2e"] or 0),
                        "unit": "tCO2e",
                        "submission_date": None,
                        "verification_status": "제3자 검증 완료",
                    }
                )

            sub_rows = session.execute(
                text(
                    f"""
                    SELECT DISTINCT ON (c.id)
                           c.id AS company_id,
                           c.name AS company_name,
                           COALESCE({expr}, 0) AS emission_tco2e,
                           s.submission_date
                    FROM companies c
                    JOIN subsidiary_data_submissions s
                      ON s.subsidiary_company_id = c.id
                     AND s.holding_company_id = :hid
                     AND s.submission_year = :yr
                     AND s.status = 'approved'
                    LEFT JOIN ghg_emission_results e
                      ON e.company_id = c.id
                     AND e.period_year = :yr
                     AND e.period_month IS NULL
                     AND e.calculation_basis = 'location'
                    WHERE c.parent_company_id = :hid
                    ORDER BY c.id, s.submission_date DESC NULLS LAST, c.name
                    """
                ),
                {"hid": hid, "yr": year},
            ).mappings().all()

            for row in sub_rows:
                if float(row["emission_tco2e"] or 0) <= 0:
                    continue
                sd = row["submission_date"]
                sources.append(
                    {
                        "source_type": "subsidiary_reported",
                        "company_id": str(row["company_id"]),
                        "company_name": row["company_name"],
                        "value": float(row["emission_tco2e"] or 0),
                        "unit": "tCO2e",
                        "submission_date": sd.isoformat() if isinstance(sd, datetime) else None,
                        "verification_status": "계열사 제3자 검증",
                    }
                )

            return sources
        finally:
            session.close()

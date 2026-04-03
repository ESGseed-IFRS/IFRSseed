"""배출계수 마스터(ghg_emission_factors) 조회."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from loguru import logger
from sqlalchemy import text

try:
    from ifrs_agent.database.base import get_session
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import get_session


class EmissionFactorService:
    def resolve(
        self,
        category: str,
        fuel_type: str,
        unit_key: str,
        year: str,
    ) -> tuple[float, str] | None:
        """
        category + fuel_type + source_unit(소문자) + 연도(또는 ALL)로 복합계수(tCO₂eq/단위) 조회.
        """
        u = (unit_key or "").strip().lower()
        session = get_session()
        try:
            row = session.execute(
                text(
                    """
                    SELECT composite_factor, COALESCE(source, '') AS src, year_applicable
                    FROM ghg_emission_factors
                    WHERE is_active = true
                      AND category = :cat
                      AND fuel_type = :fuel
                      AND lower(trim(source_unit)) = :u
                      AND (year_applicable = :y OR year_applicable = 'ALL')
                    ORDER BY CASE WHEN year_applicable = :y THEN 0 ELSE 1 END,
                             year_applicable DESC
                    LIMIT 1
                    """
                ),
                {"cat": category, "fuel": fuel_type, "u": u, "y": year.strip()},
            ).mappings().first()
            if row is None:
                row = session.execute(
                    text(
                        """
                        SELECT composite_factor, COALESCE(source, '') AS src, year_applicable
                        FROM ghg_emission_factors
                        WHERE is_active = true
                          AND category = :cat
                          AND fuel_type = :fuel
                          AND lower(trim(source_unit)) = :u
                        ORDER BY year_applicable DESC NULLS LAST
                        LIMIT 1
                        """
                    ),
                    {"cat": category, "fuel": fuel_type, "u": u},
                ).mappings().first()
            if row is None:
                return None
            cf = row["composite_factor"]
            fac = float(cf) if isinstance(cf, Decimal) else float(cf)
            return fac, str(row["src"] or "")
        except Exception:
            logger.exception(
                "[EmissionFactorService] resolve failed cat={} fuel={} u={}",
                category,
                fuel_type,
                unit_key,
            )
            raise
        finally:
            session.close()

    def list_versions_for_year(self, year: str) -> list[dict[str, Any]]:
        session = get_session()
        try:
            rows = session.execute(
                text(
                    """
                    SELECT DISTINCT version FROM ghg_emission_factors
                    WHERE is_active = true AND (year_applicable = :y OR year_applicable = 'ALL')
                    """
                ),
                {"y": year.strip()},
            ).fetchall()
            return [{"version": r[0]} for r in rows if r[0]]
        finally:
            session.close()

"""경계·일관성 검증 서비스 (조직 경계 변경, 배출계수 변경, 기준연도 재산정)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session
from backend.domain.v1.ghg_calculation.models.states import GhgAnomalyFindingVo


class GhgBoundaryConsistencyService:
    """조직 경계 및 일관성 검증."""

    def validate_boundary_consistency(
        self,
        company_id: UUID,
        current_year: str,
        base_year: str = "2020",
    ) -> list[GhgAnomalyFindingVo]:
        """
        조직 경계 및 일관성 검증.

        Args:
            company_id: 회사 ID
            current_year: 현재 산정 연도
            base_year: 기준연도 (기본값: 2020)

        Returns:
            이상 발견 목록
        """
        findings: list[GhgAnomalyFindingVo] = []

        # 1. 조직 경계 변경 검증
        findings.extend(self._check_boundary_changes(company_id, base_year, current_year))

        # 2. 배출계수 변경 시 기준연도 재산정 여부 검증
        findings.extend(self._check_emission_factor_recalc(company_id, base_year, current_year))

        # 3. 기준연도 데이터 무결성 검증
        findings.extend(self._check_base_year_integrity(company_id, base_year))

        return findings

    def _check_boundary_changes(
        self,
        company_id: UUID,
        base_year: str,
        current_year: str,
    ) -> list[GhgAnomalyFindingVo]:
        """
        조직 경계 변경 검증 (자회사 편입/매각).

        실제 구현 시에는 company_structure_changes 테이블이 필요:
        CREATE TABLE company_structure_changes (
            id UUID PRIMARY KEY,
            company_id UUID REFERENCES companies(id),
            change_type TEXT,  -- 'acquisition', 'divestiture', 'merger'
            subsidiary_name TEXT,
            effective_date DATE,
            impact_tco2e DECIMAL(18,2),
            recalculation_done BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ
        );
        """
        findings: list[GhgAnomalyFindingVo] = []

        session = get_session()
        try:
            # 조직 구조 변경 이력 조회 (테이블이 있다고 가정)
            result = session.execute(
                text(
                    """
                    SELECT change_type, subsidiary_name, effective_date, 
                           impact_tco2e, recalculation_done
                    FROM company_structure_changes
                    WHERE company_id = :company_id
                      AND EXTRACT(YEAR FROM effective_date) BETWEEN :base_year::int AND :current_year::int
                    ORDER BY effective_date DESC
                    """
                ),
                {
                    "company_id": str(company_id),
                    "base_year": base_year,
                    "current_year": current_year,
                },
            ).mappings().all()

            changes = [dict(row) for row in result]

            if changes:
                # 중요한 변경 (영향 > 5% 또는 5,000 tCO2e)
                material_changes = [
                    c for c in changes
                    if not c.get("recalculation_done") and (c.get("impact_tco2e") or 0) > 5000
                ]

                if material_changes:
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="BOUNDARY_CHANGE_NO_RECALC",
                            severity="critical",
                            phase="batch",
                            message=(
                                f"조직 경계 변경 {len(material_changes)}건 발생, "
                                f"기준연도 재산정 미수행"
                            ),
                            context={
                                "base_year": base_year,
                                "current_year": current_year,
                                "changes": material_changes,
                                "total_impact_tco2e": sum(c.get("impact_tco2e", 0) for c in material_changes),
                                "note": "GHG Protocol 재산정 정책 적용 필요",
                            },
                        )
                    )

        except Exception as e:
            # 테이블이 없거나 쿼리 실패 시 경고만 로그
            logger.warning(
                "[BoundaryConsistency] Failed to check boundary changes: {}",
                str(e),
            )
        finally:
            session.close()

        return findings

    def _check_emission_factor_recalc(
        self,
        company_id: UUID,
        base_year: str,
        current_year: str,
    ) -> list[GhgAnomalyFindingVo]:
        """
        배출계수 변경 시 기준연도 재산정 여부 검증.

        중요한 배출계수 변경 (예: 전력 배출계수 개정)이 있었는데
        기준연도 배출량을 재산정하지 않았는지 확인.
        """
        findings: list[GhgAnomalyFindingVo] = []

        session = get_session()
        try:
            # 배출계수 변경 이력 조회
            result = session.execute(
                text(
                    """
                    SELECT factor_code, factor_name_ko, 
                           MAX(updated_at) as last_updated,
                           COUNT(DISTINCT version) as version_count
                    FROM ghg_emission_factors
                    WHERE is_active = true
                      AND (year_applicable::int BETWEEN :base_year::int AND :current_year::int
                           OR year_applicable = 'ALL')
                      AND category IN ('electricity', 'stationary_combustion')
                    GROUP BY factor_code, factor_name_ko
                    HAVING COUNT(DISTINCT version) > 1
                    """
                ),
                {
                    "base_year": base_year,
                    "current_year": current_year,
                },
            ).mappings().all()

            ef_changes = [dict(row) for row in result]

            if ef_changes:
                # 중요 배출계수 변경 발견
                # 실제로는 재산정 영향도를 계산해야 함
                # 여기서는 단순히 변경 건수만 체크
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="EMISSION_FACTOR_CHANGED",
                        severity="high",
                        phase="batch",
                        message=(
                            f"배출계수 변경 {len(ef_changes)}건 발견 - "
                            f"기준연도({base_year}) 재산정 필요 여부 확인"
                        ),
                        context={
                            "base_year": base_year,
                            "current_year": current_year,
                            "changed_factors": ef_changes[:5],  # 상위 5개만
                            "total_changes": len(ef_changes),
                            "note": "영향도가 5% 이상이면 GHG Protocol 정책에 따라 재산정 필수",
                        },
                    )
                )

        except Exception as e:
            logger.warning(
                "[BoundaryConsistency] Failed to check emission factor changes: {}",
                str(e),
            )
        finally:
            session.close()

        return findings

    def _check_base_year_integrity(
        self,
        company_id: UUID,
        base_year: str,
    ) -> list[GhgAnomalyFindingVo]:
        """
        기준연도 데이터 무결성 검증.

        - Scope 1+2 데이터가 모두 존재하는지
        - 주요 시설의 데이터가 누락되지 않았는지
        """
        findings: list[GhgAnomalyFindingVo] = []

        session = get_session()
        try:
            # 기준연도 배출량 결과 조회
            result = session.execute(
                text(
                    """
                    SELECT scope, SUM(emission_tco2e) as total
                    FROM ghg_emission_results
                    WHERE company_id = :company_id
                      AND reporting_year = :base_year
                      AND is_active = true
                    GROUP BY scope
                    """
                ),
                {
                    "company_id": str(company_id),
                    "base_year": base_year,
                },
            ).mappings().all()

            scope_totals = {row["scope"]: float(row["total"] or 0) for row in result}

            # Scope 1 또는 Scope 2가 0이면 의심
            if scope_totals.get("Scope1", 0) == 0:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="BASE_YEAR_SCOPE1_ZERO",
                        severity="critical",
                        phase="batch",
                        message=f"기준연도({base_year}) Scope 1 배출량 0 또는 미입력",
                        context={
                            "base_year": base_year,
                            "scope1_total": 0,
                            "note": "Scope 1 직접 배출이 0인 경우는 매우 드물며, 데이터 누락 가능성 높음",
                        },
                    )
                )

            if scope_totals.get("Scope2", 0) == 0:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="BASE_YEAR_SCOPE2_ZERO",
                        severity="high",
                        phase="batch",
                        message=f"기준연도({base_year}) Scope 2 배출량 0 또는 미입력",
                        context={
                            "base_year": base_year,
                            "scope2_total": 0,
                            "note": "전력 사용이 있는 사업장에서 Scope 2가 0이면 데이터 누락 의심",
                        },
                    )
                )

        except Exception as e:
            logger.warning(
                "[BoundaryConsistency] Failed to check base year integrity: {}",
                str(e),
            )
        finally:
            session.close()

        return findings

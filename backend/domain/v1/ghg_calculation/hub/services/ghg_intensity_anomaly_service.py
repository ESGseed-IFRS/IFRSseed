"""원단위(집약도) 이상치 검증 서비스 (면적당/인원당/생산량당)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from backend.domain.v1.ghg_calculation.hub.repositories.staging_raw_repository import StagingRawRepository
from backend.domain.v1.ghg_calculation.hub.services.raw_data_inquiry_service import (
    aggregate_energy_activity_by_month_for_year,
)
from backend.domain.v1.ghg_calculation.models.states import GhgAnomalyFindingVo


class GhgIntensityAnomalyService:
    """원단위(집약도) 이상치 검증."""

    def __init__(self, repository: StagingRawRepository | None = None):
        self._repo = repository or StagingRawRepository()

    def scan_intensity_anomaly(
        self,
        company_id: UUID,
        year: str,
        categories: list[str],
        # 기준 데이터
        floor_area_sqm: float | None = None,
        employee_count: int | None = None,
        production_volume: float | None = None,
        production_unit: str = "대",
        # 벤치마크 (업종별 기준값)
        benchmark_per_sqm: float | None = None,
        benchmark_per_employee: float | None = None,
        benchmark_per_production: float | None = None,
        # 임계값 (배수)
        area_threshold_ratio: float = 1.5,
        employee_threshold_ratio: float = 1.5,
        production_threshold_pct: float = 25.0,
    ) -> list[GhgAnomalyFindingVo]:
        """
        원단위(집약도) 이상 탐지.

        Args:
            company_id: 회사 ID
            year: 산정 연도
            categories: 카테고리 목록 (energy, waste 등)
            floor_area_sqm: 연면적 (m²)
            employee_count: 임직원 수
            production_volume: 생산량
            production_unit: 생산량 단위 (예: 대, ton, 개)
            benchmark_per_sqm: 업종별 면적당 배출량 벤치마크 (tCO2e/m²)
            benchmark_per_employee: 업종별 인원당 배출량 벤치마크 (tCO2e/인)
            benchmark_per_production: 업종별 생산량당 배출량 벤치마크
            area_threshold_ratio: 면적당 배출량 허용 배수
            employee_threshold_ratio: 인원당 배출량 허용 배수
            production_threshold_pct: 생산량당 배출량 전년대비 허용 변동률 (%)

        Returns:
            이상 발견 목록
        """
        findings: list[GhgAnomalyFindingVo] = []

        # 1. 배출량 집계 (Scope 1+2 또는 전체)
        total_emissions = self._aggregate_emissions(company_id, year, categories)

        if total_emissions <= 0:
            return findings

        # 2. 단위 면적당 배출량 검증
        if floor_area_sqm and floor_area_sqm > 0 and benchmark_per_sqm:
            intensity_per_area = total_emissions / floor_area_sqm
            threshold = benchmark_per_sqm * area_threshold_ratio

            if intensity_per_area > threshold:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="INTENSITY_AREA_HIGH",
                        severity="medium",
                        phase="batch",
                        message=(
                            f"단위면적당 배출량 초과: {intensity_per_area:.2f} tCO2e/m² "
                            f"(벤치마크: {benchmark_per_sqm:.2f}, 임계: {threshold:.2f})"
                        ),
                        context={
                            "intensity_per_sqm": round(intensity_per_area, 4),
                            "benchmark_per_sqm": round(benchmark_per_sqm, 4),
                            "threshold": round(threshold, 4),
                            "ratio": round(intensity_per_area / benchmark_per_sqm, 2),
                            "floor_area_sqm": floor_area_sqm,
                            "total_emissions_tco2e": round(total_emissions, 2),
                            "year": year,
                            "categories": categories,
                        },
                    )
                )

        # 3. 임직원 1인당 배출량 검증
        if employee_count and employee_count > 0 and benchmark_per_employee:
            intensity_per_employee = total_emissions / employee_count
            threshold = benchmark_per_employee * employee_threshold_ratio

            if intensity_per_employee > threshold:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="INTENSITY_EMPLOYEE_HIGH",
                        severity="medium",
                        phase="batch",
                        message=(
                            f"인원당 배출량 초과: {intensity_per_employee:.2f} tCO2e/인 "
                            f"(벤치마크: {benchmark_per_employee:.2f}, 임계: {threshold:.2f})"
                        ),
                        context={
                            "intensity_per_employee": round(intensity_per_employee, 4),
                            "benchmark_per_employee": round(benchmark_per_employee, 4),
                            "threshold": round(threshold, 4),
                            "ratio": round(intensity_per_employee / benchmark_per_employee, 2),
                            "employee_count": employee_count,
                            "total_emissions_tco2e": round(total_emissions, 2),
                            "year": year,
                            "categories": categories,
                        },
                    )
                )

        # 4. 생산량당 배출집약도 검증 (전년 대비)
        if production_volume and production_volume > 0:
            current_intensity = total_emissions / production_volume

            # 전년도 집약도와 비교
            prev_year = str(int(year) - 1)
            prev_emissions = self._aggregate_emissions(company_id, prev_year, categories)

            if prev_emissions > 0:
                # 전년도 생산량은 별도로 받아야 하지만, 여기서는 동일하다고 가정
                # 실제로는 별도 테이블에서 조회 필요
                prev_intensity = prev_emissions / production_volume
                change_pct = abs((current_intensity - prev_intensity) / prev_intensity * 100)

                if change_pct > production_threshold_pct:
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="INTENSITY_PRODUCTION_CHANGE",
                            severity="high",
                            phase="batch",
                            message=(
                                f"생산량당 배출집약도 {change_pct:.1f}% 변동: "
                                f"{current_intensity:.4f} tCO2e/{production_unit} "
                                f"(전년: {prev_intensity:.4f})"
                            ),
                            context={
                                "current_intensity": round(current_intensity, 6),
                                "prev_intensity": round(prev_intensity, 6),
                                "change_pct": round(change_pct, 2),
                                "production_volume": production_volume,
                                "production_unit": production_unit,
                                "current_year": year,
                                "prev_year": prev_year,
                                "current_emissions": round(total_emissions, 2),
                                "prev_emissions": round(prev_emissions, 2),
                                "note": "공정 변경, 원료 전환, 설비 효율 저하 등 확인 필요",
                            },
                        )
                    )

            # 벤치마크와 비교
            if benchmark_per_production:
                if current_intensity > benchmark_per_production * 1.5:
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="INTENSITY_PRODUCTION_HIGH",
                            severity="medium",
                            phase="batch",
                            message=(
                                f"생산량당 배출집약도 초과: {current_intensity:.4f} tCO2e/{production_unit} "
                                f"(업종 벤치마크: {benchmark_per_production:.4f})"
                            ),
                            context={
                                "intensity_per_production": round(current_intensity, 6),
                                "benchmark": round(benchmark_per_production, 6),
                                "ratio": round(current_intensity / benchmark_per_production, 2),
                                "production_volume": production_volume,
                                "production_unit": production_unit,
                                "year": year,
                            },
                        )
                    )

        return findings

    def _aggregate_emissions(
        self,
        company_id: UUID,
        year: str,
        categories: list[str],
    ) -> float:
        """
        특정 연도의 총 배출량 집계 (Scope 1+2 또는 카테고리 기반).

        Returns:
            총 배출량 (tCO2e)
        """
        systems = ("ems", "erp", "ehs", "plm", "srm", "hr", "mdg")
        snapshots = self._repo.list_by_company_and_systems(company_id, systems)

        # energy 카테고리의 경우 활동량 집계 후 배출계수 곱하기
        # 여기서는 간단히 배출량 추정
        if "energy" in categories:
            bucket, _ = aggregate_energy_activity_by_month_for_year(snapshots, year)

            # 배출량 추정 (간략화: 전력 0.0005 tCO2e/kWh, LNG 0.0561 tCO2e/Nm3)
            total = 0.0
            for (_facility, energy_type, unit_key), months in bucket.items():
                annual_usage = sum(months.values())

                # 단순 추정 배출계수 (실제로는 emission_factor_service 사용)
                if "kwh" in unit_key.lower():
                    factor = 0.0005  # 전력 배출계수 (tCO2e/kWh)
                elif "nm3" in unit_key.lower():
                    factor = 0.0561  # LNG (tCO2e/Nm3)
                elif "l" in unit_key.lower():
                    factor = 0.00264  # 경유 (tCO2e/L)
                else:
                    factor = 0.0005

                total += annual_usage * factor

            return total

        # waste, pollution, chemical 등은 별도 계산 필요
        # 여기서는 0 반환 (실제로는 구현 확장)
        return 0.0

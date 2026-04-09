"""GHG 종합 검증 오케스트레이터 (모든 검증 유형 통합 실행)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from backend.domain.v1.ghg_calculation.hub.repositories.staging_raw_repository import StagingRawRepository
from backend.domain.v1.ghg_calculation.hub.services.ghg_boundary_consistency_service import (
    GhgBoundaryConsistencyService,
)
from backend.domain.v1.ghg_calculation.hub.services.ghg_data_quality_service import GhgDataQualityService
from backend.domain.v1.ghg_calculation.hub.services.ghg_emission_factor_validation_service import (
    GhgEmissionFactorValidationService,
)
from backend.domain.v1.ghg_calculation.hub.services.ghg_intensity_anomaly_service import GhgIntensityAnomalyService
from backend.domain.v1.ghg_calculation.hub.services.ghg_raw_timeseries_anomaly_service import (
    GhgRawTimeseriesAnomalyService,
)
from backend.domain.v1.ghg_calculation.models.states import (
    GhgAnomalyFindingVo,
    GhgAnomalyScanRequestDto,
)


class GhgComprehensiveValidationRequestDto(BaseModel):
    """종합 검증 요청 DTO."""

    model_config = {"populate_by_name": True}

    company_id: UUID
    year: str = Field(..., description="산정 연도")
    categories: list[str] = Field(default_factory=lambda: ["energy"], description="검증 카테고리")
    base_year: str = Field(default="2020", description="기준연도")

    # 시계열 이상치 파라미터
    enable_timeseries: bool = Field(default=True, description="시계열 이상치 검증 활성화")
    yoy_threshold_pct: float = Field(default=30.0, ge=0)
    mom_ratio: float = Field(default=2.0, gt=0)
    ma12_ratio: float = Field(default=2.5, gt=0)
    zscore_threshold: float = Field(default=3.0, gt=0)
    iqr_multiplier: float = Field(default=1.5, gt=0)
    enable_iqr: bool = Field(default=True)

    # 데이터 품질 검증
    enable_quality: bool = Field(default=True, description="데이터 품질 검증 활성화")

    # 배출계수 이탈 검증
    enable_emission_factor: bool = Field(default=True, description="배출계수 이탈 검증 활성화")

    # 원단위 이상치 검증
    enable_intensity: bool = Field(default=False, description="원단위 검증 활성화 (메타데이터 필요)")
    floor_area_sqm: float | None = Field(default=None, description="연면적 (m²)")
    employee_count: int | None = Field(default=None, description="임직원 수")
    production_volume: float | None = Field(default=None, description="생산량")
    production_unit: str = Field(default="대", description="생산량 단위")
    benchmark_per_sqm: float | None = Field(default=None, description="업종별 면적당 배출량 벤치마크")
    benchmark_per_employee: float | None = Field(default=None, description="업종별 인원당 배출량 벤치마크")
    benchmark_per_production: float | None = Field(default=None, description="업종별 생산량당 배출량 벤치마크")

    # 경계·일관성 검증
    enable_boundary: bool = Field(default=True, description="경계·일관성 검증 활성화")


class GhgComprehensiveValidationResponseDto(BaseModel):
    """종합 검증 응답 DTO."""

    model_config = {"populate_by_name": True}

    company_id: str
    year: str
    categories: list[str]

    # 검증 결과 (유형별)
    timeseries_findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)
    quality_findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)
    emission_factor_findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)
    intensity_findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)
    boundary_findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)

    # 통계
    total_findings: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

    # 요약
    summary: dict[str, Any] = Field(default_factory=dict)


class GhgComprehensiveValidationOrchestrator:
    """GHG 종합 검증 오케스트레이터."""

    def __init__(
        self,
        repository: StagingRawRepository | None = None,
        timeseries_service: GhgRawTimeseriesAnomalyService | None = None,
        quality_service: GhgDataQualityService | None = None,
        ef_validation_service: GhgEmissionFactorValidationService | None = None,
        intensity_service: GhgIntensityAnomalyService | None = None,
        boundary_service: GhgBoundaryConsistencyService | None = None,
    ):
        self._repo = repository or StagingRawRepository()
        self._timeseries_service = timeseries_service or GhgRawTimeseriesAnomalyService()
        self._quality_service = quality_service or GhgDataQualityService()
        self._ef_validation_service = ef_validation_service or GhgEmissionFactorValidationService()
        self._intensity_service = intensity_service or GhgIntensityAnomalyService()
        self._boundary_service = boundary_service or GhgBoundaryConsistencyService()

    def run_comprehensive_validation(
        self,
        req: GhgComprehensiveValidationRequestDto,
    ) -> GhgComprehensiveValidationResponseDto:
        """
        모든 검증 유형을 통합 실행.

        Returns:
            통합 검증 결과
        """
        timeseries_findings: list[GhgAnomalyFindingVo] = []
        quality_findings: list[GhgAnomalyFindingVo] = []
        ef_findings: list[GhgAnomalyFindingVo] = []
        intensity_findings: list[GhgAnomalyFindingVo] = []
        boundary_findings: list[GhgAnomalyFindingVo] = []

        # 1. 시계열 이상치 검증 (YoY, MoM, MA12, 3σ, IQR)
        if req.enable_timeseries:
            ts_req = GhgAnomalyScanRequestDto(
                company_id=req.company_id,
                categories=req.categories,
                year=req.year,
                yoy_threshold_pct=req.yoy_threshold_pct,
                mom_ratio=req.mom_ratio,
                ma12_ratio=req.ma12_ratio,
                zscore_threshold=req.zscore_threshold,
                iqr_multiplier=req.iqr_multiplier,
                enable_iqr=req.enable_iqr,
            )
            ts_response = self._timeseries_service.scan(ts_req)
            timeseries_findings = ts_response.timeseries_findings

        # 2. 데이터 품질 검증 (0값, 음수, 중복, 단위 불일치)
        if req.enable_quality:
            snapshots = self._repo.list_by_company_and_systems(
                req.company_id,
                ("ems", "erp", "ehs", "plm", "srm", "hr", "mdg"),
            )
            for snap in snapshots:
                cat = (snap.ghg_raw_category or "").strip().lower()
                if cat not in req.categories:
                    continue

                findings = self._quality_service.validate_staging_quality(
                    staging_id=snap.staging_id,
                    raw_data=snap.raw_data,
                    category=cat,
                    staging_system=snap.staging_system,
                )
                quality_findings.extend(findings)

        # 3. 배출계수 이탈 검증 (±15%)
        if req.enable_emission_factor:
            snapshots = self._repo.list_by_company_and_systems(
                req.company_id,
                ("ems", "erp", "ehs"),
            )
            for snap in snapshots:
                cat = (snap.ghg_raw_category or "").strip().lower()
                if cat != "energy":
                    continue

                items = snap.raw_data.get("items") if isinstance(snap.raw_data, dict) else None
                if not isinstance(items, list):
                    continue

                source_file = snap.raw_data.get("source_file", "unknown")
                findings = self._ef_validation_service.validate_emission_factors(
                    items=items,
                    year=req.year,
                    staging_id=snap.staging_id,
                    staging_system=snap.staging_system,
                    source_file=source_file,
                )
                ef_findings.extend(findings)

        # 4. 원단위 이상치 검증 (메타데이터가 제공된 경우만)
        if req.enable_intensity and (req.floor_area_sqm or req.employee_count or req.production_volume):
            findings = self._intensity_service.scan_intensity_anomaly(
                company_id=req.company_id,
                year=req.year,
                categories=req.categories,
                floor_area_sqm=req.floor_area_sqm,
                employee_count=req.employee_count,
                production_volume=req.production_volume,
                production_unit=req.production_unit,
                benchmark_per_sqm=req.benchmark_per_sqm,
                benchmark_per_employee=req.benchmark_per_employee,
                benchmark_per_production=req.benchmark_per_production,
            )
            intensity_findings = findings

        # 5. 경계·일관성 검증
        if req.enable_boundary:
            findings = self._boundary_service.validate_boundary_consistency(
                company_id=req.company_id,
                current_year=req.year,
                base_year=req.base_year,
            )
            boundary_findings = findings

        # 통합 및 통계 계산
        all_findings = (
            timeseries_findings
            + quality_findings
            + ef_findings
            + intensity_findings
            + boundary_findings
        )

        # 심각도별 집계
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for finding in all_findings:
            severity_counts[finding.severity] = severity_counts.get(finding.severity, 0) + 1

        # 요약 생성
        summary = {
            "total_findings": len(all_findings),
            "by_severity": severity_counts,
            "by_phase": {
                "sync": len([f for f in all_findings if f.phase == "sync"]),
                "timeseries": len([f for f in all_findings if f.phase == "timeseries"]),
                "batch": len([f for f in all_findings if f.phase == "batch"]),
            },
            "validation_types_run": {
                "timeseries": req.enable_timeseries,
                "quality": req.enable_quality,
                "emission_factor": req.enable_emission_factor,
                "intensity": req.enable_intensity,
                "boundary": req.enable_boundary,
            },
        }

        return GhgComprehensiveValidationResponseDto(
            company_id=str(req.company_id),
            year=req.year,
            categories=req.categories,
            timeseries_findings=timeseries_findings,
            quality_findings=quality_findings,
            emission_factor_findings=ef_findings,
            intensity_findings=intensity_findings,
            boundary_findings=boundary_findings,
            total_findings=len(all_findings),
            critical_count=severity_counts["critical"],
            high_count=severity_counts["high"],
            medium_count=severity_counts["medium"],
            low_count=severity_counts["low"],
            summary=summary,
        )

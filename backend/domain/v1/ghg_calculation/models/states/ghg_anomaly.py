"""GHG Raw 이상치·동기 검증 DTO."""
from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


AnomalySeverity = Literal["critical", "high", "medium", "low"]
AnomalyPhase = Literal["sync", "timeseries", "batch"]


class GhgAnomalyFindingVo(BaseModel):
    """단일 이상 탐지 결과."""

    model_config = {"populate_by_name": True}

    rule_code: str = Field(..., description="예: NEGATIVE_VALUE, SCHEMA_REQUIRED, DUPLICATE_ROW, YOY_PCT")
    severity: AnomalySeverity = "medium"
    phase: AnomalyPhase = "sync"
    message: str = ""
    csv_row: int | None = Field(default=None, description="CSV 데이터 행 번호(헤더 제외, 1-based)")
    staging_system: str | None = None
    staging_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class GhgStagingSyncValidationBlockVo(BaseModel):
    """스테이징 1건에 대한 동기 검증 결과."""

    system: str
    staging_id: str
    findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)


class GhgAnomalyScanRequestDto(BaseModel):
    """시계열·배치 이상치 스캔 요청."""

    company_id: UUID
    categories: list[str] = Field(
        default_factory=lambda: ["energy"],
        description="스캔 대상 ghg_raw_category 목록 (예: energy, waste, pollution, chemical)",
    )
    systems: list[str] | None = Field(
        default=None,
        description="스캔 대상 시스템 목록(ems, erp, ehs, plm, srm, hr, mdg). 비우면 전체.",
    )
    group_by_system: bool = Field(
        default=False,
        description="True면 시스템별 시계열을 분리해 비교합니다.",
    )
    year: str | None = Field(
        default=None,
        description="해당 연도 월별 포인트만 평가(비우면 전체 스냅샷에서 추출)",
    )
    yoy_threshold_pct: float = Field(default=30.0, ge=0, description="전년 동기 대비 |%| 초과 시 이상")
    mom_ratio: float = Field(default=2.0, gt=0, description="전월 대비 배수 초과 시 이상")
    ma12_ratio: float = Field(default=2.5, gt=0, description="직전 12개월 평균 대비 배수")
    zscore_threshold: float = Field(default=3.0, gt=0, description="최근 12개월 기준 |Z| 초과")
    iqr_multiplier: float = Field(default=1.5, gt=0, description="IQR 배수 (기본 1.5, 극단값은 3.0)")
    enable_iqr: bool = Field(default=True, description="IQR 이상치 검증 활성화")


class GhgAnomalyScanResponseDto(BaseModel):
    """시계열 이상치 스캔 응답."""

    company_id: str
    categories: list[str] = Field(default_factory=list)
    systems: list[str] = Field(default_factory=list)
    group_by_system: bool = False
    timeseries_findings: list[GhgAnomalyFindingVo] = Field(default_factory=list)
    series_evaluated: int = Field(0, description="월별 시계열 그룹 수")

"""Scope 1·2 산정 API DTO."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ScopeCalcLineItemDto(BaseModel):
    name: str
    facility: str
    unit: str = "tCO₂eq"
    jan: float = 0.0
    feb: float = 0.0
    mar: float = 0.0
    apr: float = 0.0
    may: float = 0.0
    jun: float = 0.0
    jul: float = 0.0
    aug: float = 0.0
    sep: float = 0.0
    oct: float = 0.0
    nov: float = 0.0
    dec: float = 0.0
    total: float = 0.0
    ef: str = ""
    ef_source: str = ""
    yoy: float | None = Field(
        default=None,
        description="직전 ghg_emission_results(동일 basis) 라인 total 대비 %; 전년 없거나 매칭 실패 시 None.",
    )
    status: Literal["confirmed", "draft", "warning", "error"] = "confirmed"
    
    # 배출계수 상세 정보 (EmissionFactorMapping 탭용)
    source_unit: str = Field(default="", description="활동자료 단위 (Nm³, kWh 등)")
    ef_unit: str = Field(default="", description="배출계수 단위 (tCO₂eq/TJ, kgCO₂eq/kWh 등)")
    ef_version: str = Field(default="", description="배출계수 버전 (v2.0, 2024년 등)")
    factor_code: str = Field(default="", description="배출계수 코드 (KR_2024_천연가스_LNG 등)")
    calculation_formula: str = Field(default="", description="계산 공식 (활동량 × 열량계수 × 배출계수)")
    heat_content: float | None = Field(default=None, description="열량계수 (TJ/천Nm³ 등)")
    annual_activity: float = Field(default=0.0, description="연간 활동량 (원단위)")


class ScopeCalcCategoryDto(BaseModel):
    id: str
    category: str
    items: list[ScopeCalcLineItemDto] = Field(default_factory=list)


class ScopeMonthlyPointDto(BaseModel):
    month: str
    scope1: float = 0.0
    scope2: float = 0.0
    scope3: float = 0.0


class ScopeRecalculateRequestDto(BaseModel):
    company_id: UUID
    year: str = Field(..., min_length=4, max_length=4)
    basis: str = Field(default="location", description="location | market (시장기반은 후속)")


class ScopePrevYearTotalsDto(BaseModel):
    """`period_year - 1` 행의 연간 합계 (상단 카드 YoY용)."""

    scope1_total: float
    scope2_total: float
    scope3_total: float
    grand_total: float


class ScopeRecalculateResponseDto(BaseModel):
    company_id: str
    year: str
    basis: str
    scope1_total: float
    scope2_total: float
    scope3_total: float = 0.0
    grand_total: float
    monthly_chart: list[ScopeMonthlyPointDto]
    scope1_categories: list[ScopeCalcCategoryDto]
    scope2_categories: list[ScopeCalcCategoryDto]
    scope3_categories: list[ScopeCalcCategoryDto] = Field(default_factory=list, description="Scope 3 카테고리별 배출량")
    emission_factor_version: str = "v1.0"
    calculated_at: datetime
    row_import_status: Literal["confirmed", "draft", "warning", "error"] = "confirmed"
    verification_status: str | None = Field(
        default=None,
        description="ghg_emission_results.verification_status (예: draft, verified).",
    )
    comparison_year: str | None = Field(
        default=None,
        description="전년 대비 기준 연도(직전 period_year). 저장 행이 없으면 None.",
    )
    prev_year_totals: ScopePrevYearTotalsDto | None = Field(
        default=None,
        description="comparison_year 시점의 연간 합계",
    )


class ScopeResultsGetParams(BaseModel):
    company_id: UUID
    year: str
    basis: str = "location"


class GroupScopeResultRowDto(BaseModel):
    """지주 + 자회사(계열사) 연간 산정 한 행."""

    company_id: str
    name: str
    role: Literal["holding", "subsidiary"]
    scope1_total: float = 0.0
    scope2_total: float = 0.0
    scope3_total: float = 0.0
    grand_total: float = 0.0
    prev_grand_total: float | None = None
    frozen: bool = False


class GroupScopeTrendPointDto(BaseModel):
    year: int
    scope1_total: float = 0.0
    scope2_total: float = 0.0
    scope3_total: float = 0.0
    grand_total: float = 0.0


class GroupScopeResultsResponseDto(BaseModel):
    holding_company_id: str
    year: int
    basis: str
    rows: list[GroupScopeResultRowDto]


class GroupScopeTrendResponseDto(BaseModel):
    holding_company_id: str
    basis: str
    points: list[GroupScopeTrendPointDto]

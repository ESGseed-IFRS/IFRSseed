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


class ScopeCalcCategoryDto(BaseModel):
    id: str
    category: str
    items: list[ScopeCalcLineItemDto] = Field(default_factory=list)


class ScopeMonthlyPointDto(BaseModel):
    month: str
    scope1: float = 0.0
    scope2: float = 0.0


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
    emission_factor_version: str = "v1.0"
    calculated_at: datetime
    row_import_status: Literal["confirmed", "draft", "warning", "error"] = "confirmed"
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

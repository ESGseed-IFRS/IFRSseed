"""스테이징 에너지 + 배출계수 기반 Scope 1·2 산정."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from backend.domain.v1.ghg_calculation.hub.repositories.ghg_emission_result_repository import (
    GhgEmissionResultRepository,
)
from backend.domain.v1.ghg_calculation.hub.repositories.staging_raw_repository import StagingRawRepository
from backend.domain.v1.ghg_calculation.hub.services.emission_factor_service import EmissionFactorService
from backend.domain.v1.ghg_calculation.hub.services.raw_data_inquiry_service import (
    aggregate_energy_activity_by_month_for_year,
)
from backend.domain.v1.ghg_calculation.models.states.scope_calculation import (
    ScopeCalcCategoryDto,
    ScopeCalcLineItemDto,
    ScopeMonthlyPointDto,
    ScopePrevYearTotalsDto,
    ScopeRecalculateResponseDto,
)

_MONTH_KEYS = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
_MONTH_LABELS = [f"{i}월" for i in range(1, 13)]


def _classify_emission_factor_row(energy_type: str, unit_key: str) -> tuple[str, str] | None:
    """
    (ghg_emission_factors.category, fuel_type) 반환.
    미매핑 연료·단위는 None.
    """
    et_raw = energy_type or ""
    et = et_raw.lower()
    mobile = "차량" in et_raw or "vehicle" in et
    if "전력" in et_raw or "electric" in et or et in ("ep", "power", "pwr"):
        return ("scope2_electricity", "Grid")
    if "스팀" in et_raw or "증기" in et_raw or "steam" in et:
        return ("scope2_steam", "Steam")
    if "lng" in et:
        return ("scope1_mobile" if mobile else "scope1_fixed", "LNG")
    if "lpg" in et:
        return ("scope1_mobile" if mobile else "scope1_fixed", "LPG")
    if "경유" in et_raw or "diesel" in et:
        return ("scope1_mobile" if mobile else "scope1_fixed", "Diesel")
    if "휘발유" in et_raw or "gasoline" in et or "휘발" in et_raw:
        return ("scope1_mobile" if mobile else "scope1_fixed", "Gasoline")
    if "등유" in et_raw or "kerosene" in et:
        return ("scope1_fixed", "Kerosene")
    if "중유" in et_raw or "bunker" in et or "heavy oil" in et:
        return ("scope1_fixed", "HeavyOil")
    _ = unit_key
    return None


def _import_to_line_status(s: str) -> Literal["confirmed", "draft", "warning", "error"]:
    x = (s or "").lower()
    if x == "error":
        return "error"
    if x == "draft":
        return "draft"
    return "confirmed"


def _emissions_to_line_fields(em: dict[int, float]) -> dict[str, float]:
    out: dict[str, float] = {}
    for i, key in enumerate(_MONTH_KEYS, start=1):
        out[key] = round(em.get(i, 0.0), 6)
    out["total"] = round(sum(em.get(m, 0.0) for m in range(1, 13)), 6)
    return out


def _line_item(
    energy_type: str,
    facility: str,
    em: dict[int, float],
    factor: float,
    ef_source: str,
    row_status: str,
) -> ScopeCalcLineItemDto:
    fields = _emissions_to_line_fields(em)
    st = _import_to_line_status(row_status)
    return ScopeCalcLineItemDto(
        name=f"{energy_type} ({facility})",
        facility=facility,
        unit="tCO₂eq",
        jan=fields["jan"],
        feb=fields["feb"],
        mar=fields["mar"],
        apr=fields["apr"],
        may=fields["may"],
        jun=fields["jun"],
        jul=fields["jul"],
        aug=fields["aug"],
        sep=fields["sep"],
        oct=fields["oct"],
        nov=fields["nov"],
        dec=fields["dec"],
        total=fields["total"],
        ef=f"{factor:.6g}",
        ef_source=ef_source or "—",
        status=st,
    )


def _line_key(facility: str, name: str) -> tuple[str, str]:
    return (facility or "", name or "")


def _prev_line_totals_by_key(payload: dict, scope_key: str) -> dict[tuple[str, str], float]:
    m: dict[tuple[str, str], float] = {}
    for cat in payload.get(scope_key, []) or []:
        if not isinstance(cat, dict):
            continue
        for it in cat.get("items", []) or []:
            if not isinstance(it, dict):
                continue
            k = _line_key(str(it.get("facility", "")), str(it.get("name", "")))
            m[k] = float(it.get("total") or 0.0)
    return m


def _apply_line_yoy(
    categories: list[ScopeCalcCategoryDto],
    prev_by_key: dict[tuple[str, str], float],
) -> None:
    for cat in categories:
        for item in cat.items:
            k = _line_key(item.facility, item.name)
            prev_t = prev_by_key.get(k)
            if prev_t is None or prev_t <= 0:
                item.yoy = None
            else:
                item.yoy = round(((item.total - prev_t) / prev_t) * 100, 2)


def _yoy_from_prev_row(
    company_id: UUID,
    period_year: int,
    basis: str,
    result_repo: GhgEmissionResultRepository,
    scope1_categories: list[ScopeCalcCategoryDto],
    scope2_categories: list[ScopeCalcCategoryDto],
) -> tuple[str | None, ScopePrevYearTotalsDto | None]:
    raw = result_repo.get_annual_scope_calc(company_id, period_year - 1, basis)
    if raw is None:
        return None, None
    prev_dto = ScopePrevYearTotalsDto(
        scope1_total=float(raw["scope1_total"] or 0),
        scope2_total=float(raw["scope2_total"] or 0),
        scope3_total=float(raw["scope3_total"] or 0),
        grand_total=float(raw["grand_total"] or 0),
    )
    li = raw["line_items_payload"]
    if isinstance(li, dict):
        _apply_line_yoy(scope1_categories, _prev_line_totals_by_key(li, "scope1_categories"))
        _apply_line_yoy(scope2_categories, _prev_line_totals_by_key(li, "scope2_categories"))
    return str(period_year - 1), prev_dto


class ScopeCalculationOrchestrator:
    def __init__(
        self,
        staging_repo: StagingRawRepository | None = None,
        ef_service: EmissionFactorService | None = None,
        result_repo: GhgEmissionResultRepository | None = None,
    ) -> None:
        self._staging = staging_repo or StagingRawRepository()
        self._ef = ef_service or EmissionFactorService()
        self._results = result_repo or GhgEmissionResultRepository()

    def recalculate(
        self,
        company_id: UUID,
        year: str,
        basis: str = "location",
    ) -> ScopeRecalculateResponseDto:
        basis_norm = (basis or "location").strip() or "location"
        snaps = self._staging.list_by_company_and_systems(
            company_id,
            ("ems", "erp", "ehs", "plm", "srm", "hr", "mdg"),
        )
        bucket, imp_st = aggregate_energy_activity_by_month_for_year(snaps, year)
        s1_m = {i: 0.0 for i in range(1, 13)}
        s2_m = {i: 0.0 for i in range(1, 13)}
        acc_s1_fixed: list[ScopeCalcLineItemDto] = []
        acc_s1_mobile: list[ScopeCalcLineItemDto] = []
        acc_s2_grid: list[ScopeCalcLineItemDto] = []
        acc_s2_steam: list[ScopeCalcLineItemDto] = []

        for (facility, et, ukey), qty in bucket.items():
            cls = _classify_emission_factor_row(et, ukey)
            if cls is None:
                continue
            cat, fuel = cls
            resolved = self._ef.resolve(cat, fuel, ukey, year)
            if resolved is None:
                continue
            fctr, src = resolved
            em = {m: qty.get(m, 0.0) * fctr for m in range(1, 13)}
            li = _line_item(et, facility, em, fctr, src, imp_st)
            if cat == "scope1_fixed":
                acc_s1_fixed.append(li)
                for m in range(1, 13):
                    s1_m[m] += em[m]
            elif cat == "scope1_mobile":
                acc_s1_mobile.append(li)
                for m in range(1, 13):
                    s1_m[m] += em[m]
            elif cat == "scope2_electricity":
                acc_s2_grid.append(li)
                for m in range(1, 13):
                    s2_m[m] += em[m]
            elif cat == "scope2_steam":
                acc_s2_steam.append(li)
                for m in range(1, 13):
                    s2_m[m] += em[m]

        scope1_total = round(sum(s1_m.values()), 6)
        scope2_total = round(sum(s2_m.values()), 6)
        scope3_total = 0.0
        grand_total = round(scope1_total + scope2_total + scope3_total, 6)

        monthly_chart = [
            ScopeMonthlyPointDto(
                month=_MONTH_LABELS[i - 1],
                scope1=round(s1_m[i], 6),
                scope2=round(s2_m[i], 6),
            )
            for i in range(1, 13)
        ]

        scope1_categories: list[ScopeCalcCategoryDto] = []
        if acc_s1_fixed:
            scope1_categories.append(ScopeCalcCategoryDto(id="s1-fixed", category="고정연소", items=acc_s1_fixed))
        if acc_s1_mobile:
            scope1_categories.append(ScopeCalcCategoryDto(id="s1-mobile", category="이동연소", items=acc_s1_mobile))
        scope2_categories: list[ScopeCalcCategoryDto] = []
        if acc_s2_grid:
            s2_label = "전력 (시장기반)" if basis_norm == "market" else "전력 (위치기반)"
            scope2_categories.append(ScopeCalcCategoryDto(id="s2-grid", category=s2_label, items=acc_s2_grid))
        if acc_s2_steam:
            scope2_categories.append(ScopeCalcCategoryDto(id="s2-steam", category="스팀·열", items=acc_s2_steam))

        period_year = int(year.strip())
        comparison_year, prev_year_totals = _yoy_from_prev_row(
            company_id,
            period_year,
            basis_norm,
            self._results,
            scope1_categories,
            scope2_categories,
        )

        monthly_breakdown = {
            f"{i:02d}": {"scope1": s1_m[i], "scope2": s2_m[i]} for i in range(1, 13)
        }
        line_payload = {
            "scope1_categories": [c.model_dump(mode="json") for c in scope1_categories],
            "scope2_categories": [c.model_dump(mode="json") for c in scope2_categories],
        }
        s1_fixed = round(sum(i.total for i in acc_s1_fixed), 4)
        s1_mobile = round(sum(i.total for i in acc_s1_mobile), 4)
        s2_loc = round(scope2_total, 4) if basis_norm == "location" else None
        s2_mkt = round(scope2_total, 4) if basis_norm == "market" else None
        ef_bundle = "v1.0"
        calc_at = self._results.upsert_annual_scope_calc(
            company_id=company_id,
            period_year=period_year,
            calculation_basis=basis_norm,
            scope1_total=round(scope1_total, 4),
            scope1_fixed=s1_fixed,
            scope1_mobile=s1_mobile,
            scope2_location=s2_loc,
            scope2_market=s2_mkt,
            scope3_total=round(scope3_total, 4),
            grand_total=round(grand_total, 4),
            monthly_scope_breakdown=monthly_breakdown,
            scope_line_items=line_payload,
            emission_factor_bundle_version=ef_bundle,
            verification_status="draft",
        )

        return ScopeRecalculateResponseDto(
            company_id=str(company_id),
            year=year,
            basis=basis_norm,
            scope1_total=scope1_total,
            scope2_total=scope2_total,
            scope3_total=scope3_total,
            grand_total=grand_total,
            monthly_chart=monthly_chart,
            scope1_categories=scope1_categories,
            scope2_categories=scope2_categories,
            emission_factor_version=ef_bundle,
            calculated_at=calc_at,
            row_import_status=_import_to_line_status(imp_st),
            comparison_year=comparison_year,
            prev_year_totals=prev_year_totals,
        )

    def get_stored_results(
        self,
        company_id: UUID,
        year: str,
        basis: str = "location",
    ) -> ScopeRecalculateResponseDto | None:
        basis_norm = (basis or "location").strip() or "location"
        period_y = int(year.strip())
        raw = self._results.get_annual_scope_calc(company_id, period_y, basis_norm)
        if raw is None:
            return None
        li = raw["line_items_payload"]
        s1_cats = [ScopeCalcCategoryDto.model_validate(x) for x in li.get("scope1_categories", [])]
        s2_cats = [ScopeCalcCategoryDto.model_validate(x) for x in li.get("scope2_categories", [])]
        comparison_year, prev_year_totals = _yoy_from_prev_row(
            company_id,
            period_y,
            basis_norm,
            self._results,
            s1_cats,
            s2_cats,
        )
        mb = raw["monthly_breakdown"]
        s1_m: dict[int, float] = {}
        s2_m: dict[int, float] = {}
        for i in range(1, 13):
            key = f"{i:02d}"
            cell = mb.get(key) or {}
            s1_m[i] = float(cell.get("scope1", 0.0))
            s2_m[i] = float(cell.get("scope2", 0.0))
        monthly_chart = [
            ScopeMonthlyPointDto(month=_MONTH_LABELS[i - 1], scope1=s1_m[i], scope2=s2_m[i])
            for i in range(1, 13)
        ]
        ts = raw["calculated_at"]
        if isinstance(ts, datetime):
            calc_at = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        else:
            calc_at = datetime.now(timezone.utc)
        return ScopeRecalculateResponseDto(
            company_id=str(company_id),
            year=year,
            basis=basis_norm,
            scope1_total=raw["scope1_total"],
            scope2_total=raw["scope2_total"],
            scope3_total=raw["scope3_total"],
            grand_total=raw["grand_total"],
            monthly_chart=monthly_chart,
            scope1_categories=s1_cats,
            scope2_categories=s2_cats,
            emission_factor_version=raw["emission_factor_version"] or "v1.0",
            calculated_at=calc_at,
            row_import_status="confirmed",
            comparison_year=comparison_year,
            prev_year_totals=prev_year_totals,
        )

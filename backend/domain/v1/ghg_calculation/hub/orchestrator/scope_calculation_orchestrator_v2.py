"""스테이징 에너지 + 배출계수 기반 Scope 1·2 산정 (V2 - 개선).

새로운 계산 엔진(GhgCalculationEngine)과 확장 배출계수 서비스(EmissionFactorServiceV2)를 사용합니다.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from loguru import logger

from backend.domain.v1.ghg_calculation.hub.repositories.ghg_emission_result_repository import (
    GhgEmissionResultRepository,
)
from backend.domain.v1.ghg_calculation.hub.repositories.staging_raw_repository import StagingRawRepository
from backend.domain.v1.ghg_calculation.hub.services.emission_factor_service_v2 import EmissionFactorServiceV2
from backend.domain.v1.ghg_calculation.hub.services.ghg_calculation_engine import GhgCalculationEngine
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


def _classify_fuel_type_and_unit(energy_type: str, unit_key: str) -> tuple[str, str, str] | None:
    """
    (fuel_type, source_unit, applicable_scope) 반환.
    미매핑 연료·단위는 None.
    
    Returns:
        (fuel_type, source_unit, applicable_scope) 예: ('천연가스_lng', '천Nm³', 'Scope1')
    """
    et_raw = energy_type or ""
    et = et_raw.lower()
    u = (unit_key or "").lower()
    mobile = "차량" in et_raw or "vehicle" in et
    
    # Scope 2: 전력
    if "전력" in et_raw or "electric" in et or et in ("ep", "power", "pwr"):
        return ("electricity", "kWh", "Scope2")
    
    # Scope 2: 스팀/열/지역난방
    if "스팀" in et_raw or "증기" in et_raw or "steam" in et or "열" == et_raw or "district" in et:
        return ("district_heat", "GJ", "Scope2")
    
    # 재생에너지 (배출계수 0 - Scope 2에서 제외 가능, 현재는 skip)
    if "태양" in et_raw or "solar" in et or "지열" in et_raw or "geothermal" in et:
        logger.info(f"재생에너지 건너뜀: {energy_type} (배출계수 0)")
        return None
    
    # Scope 3 or 기타 (냉각탑보충수 등)
    if "냉각탑" in et_raw or "보충수" in et_raw or "cooling" in et:
        logger.info(f"Scope 3 항목 건너뜀: {energy_type}")
        return None
    
    # Scope 1: 천연가스 (LNG)
    if "lng" in et or "천연가스" in et_raw or "natural gas" in et:
        # 스테이징 데이터의 실제 단위를 그대로 사용 (Nm³ 또는 천Nm³)
        # convert_to_tj에서 DB의 천Nm³ 기준 열량계수와 자동 매칭
        if u and 'nm3' in u:
            return ("천연가스_lng", "Nm³", "Scope1")  # 실제 단위 그대로
        return ("천연가스_lng", unit_key or "Nm³", "Scope1")
    
    # Scope 1: LPG
    if "lpg" in et or "액화석유가스" in et_raw:
        return ("액화석유가스_lpg", unit_key or "천L", "Scope1")
    
    # Scope 1: 경유
    if "경유" in et_raw or "diesel" in et:
        return ("경유_diesel", unit_key or "L", "Scope1")
    
    # Scope 1: 휘발유
    if "휘발유" in et_raw or "gasoline" in et or "휘발" in et_raw:
        return ("휘발유_gasoline", unit_key or "L", "Scope1")
    
    # Scope 1: 등유
    if "등유" in et_raw or "kerosene" in et:
        return ("등유_kerosene", unit_key or "L", "Scope1")
    
    # Scope 1: 중유
    if "중유" in et_raw or "bunker" in et or "heavy oil" in et:
        if "b_a" in et or "ba" in et:
            return ("중유_b_a_mfo", unit_key or "L", "Scope1")
        else:
            return ("중유_b_c_hfo", unit_key or "L", "Scope1")
    
    # Scope 1: 도시가스
    if "도시가스" in et_raw or "png" in et:
        return ("도시가스_png", unit_key or "Nm³", "Scope1")
    
    logger.warning(f"미분류 에너지 타입: {energy_type}, 단위: {unit_key}")
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
    *,
    source_unit: str = "",
    ef_unit: str = "",
    ef_version: str = "",
    factor_code: str = "",
    calculation_formula: str = "",
    heat_content: float | None = None,
    annual_activity: float = 0.0,
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
        source_unit=source_unit,
        ef_unit=ef_unit,
        ef_version=ef_version,
        factor_code=factor_code,
        calculation_formula=calculation_formula,
        heat_content=heat_content,
        annual_activity=annual_activity,
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


class ScopeCalculationOrchestratorV2:
    """Scope 산정 Orchestrator (V2 - 개선)."""
    
    def __init__(
        self,
        staging_repo: StagingRawRepository | None = None,
        ef_service: EmissionFactorServiceV2 | None = None,
        calc_engine: GhgCalculationEngine | None = None,
        result_repo: GhgEmissionResultRepository | None = None,
    ) -> None:
        self._staging = staging_repo or StagingRawRepository()
        self._ef = ef_service or EmissionFactorServiceV2()
        self._engine = calc_engine or GhgCalculationEngine()
        self._results = result_repo or GhgEmissionResultRepository()

    def recalculate(
        self,
        company_id: UUID,
        year: str,
        basis: str = "location",
    ) -> ScopeRecalculateResponseDto:
        """
        연간 Scope 1·2 배출량 산정 (V2 - 개선).
        
        개선사항:
        1. 열량계수를 사용한 TJ 변환 지원
        2. GHG 가스별 배출계수 분리 계산
        3. 단위 자동 변환
        """
        basis_norm = (basis or "location").strip() or "location"
        year_int = int(year.strip())
        
        # 1. 스테이징 데이터 조회
        snaps = self._staging.list_by_company_and_systems(
            company_id,
            ("ems", "erp", "ehs", "plm", "srm", "hr", "mdg"),
        )
        logger.info(f"🔍 스테이징 데이터: {len(snaps)}개 스냅샷")
        
        bucket, imp_st = aggregate_energy_activity_by_month_for_year(snaps, year)
        logger.info(f"🔍 집계 후 Bucket: {len(bucket)}개 에너지 타입×시설 조합")
        
        s1_m = {i: 0.0 for i in range(1, 13)}
        s2_m = {i: 0.0 for i in range(1, 13)}
        acc_s1_fixed: list[ScopeCalcLineItemDto] = []
        acc_s1_mobile: list[ScopeCalcLineItemDto] = []
        acc_s2_grid: list[ScopeCalcLineItemDto] = []
        acc_s2_steam: list[ScopeCalcLineItemDto] = []

        # 2. 각 에너지 타입별 배출량 계산
        logger.info(f"🔍 Bucket 크기: {len(bucket)}개 항목")
        for (facility, et, ukey), qty in bucket.items():
            cls = _classify_fuel_type_and_unit(et, ukey)
            if cls is None:
                continue
            
            fuel_type, source_unit, applicable_scope = cls
            
            # 배출계수 조회
            ef_detail = self._ef.resolve_detailed(
                fuel_type=fuel_type,
                source_unit=source_unit,
                year=year_int,
                applicable_scope=applicable_scope,
            )
            
            if ef_detail is None:
                logger.warning(
                    f"배출계수 없음: fuel={fuel_type}, unit={source_unit}, scope={applicable_scope}"
                )
                continue
            
            # 월별 배출량 계산
            em: dict[int, float] = {}
            for m in range(1, 13):
                usage = qty.get(m, 0.0)
                if usage == 0:
                    em[m] = 0.0
                    continue
                
                # Scope 2 전력: 직접 계산
                if applicable_scope == "Scope2" and fuel_type == "electricity":
                    result = self._engine.calculate_electricity_emissions(
                        usage_kwh=usage,
                        electricity_ef_kg_per_kwh=ef_detail.composite_factor,
                    )
                    em[m] = result["total_emission"]
                
                # Scope 1: TJ 변환 후 계산
                else:
                    # TJ 변환
                    tj, _ = self._engine.convert_to_tj(
                        usage_amount=usage,
                        source_unit=source_unit,
                        heat_content_coefficient=ef_detail.heat_content_coefficient,
                        net_calorific_value=ef_detail.net_calorific_value,
                    )
                    
                    # 배출량 계산
                    result = self._engine.calculate_emissions(
                        activity_tj=tj,
                        co2_factor=ef_detail.co2_factor,
                        ch4_factor=ef_detail.ch4_factor,
                        n2o_factor=ef_detail.n2o_factor,
                        composite_factor=ef_detail.composite_factor,
                        ch4_gwp=ef_detail.ch4_gwp or 28,
                        n2o_gwp=ef_detail.n2o_gwp or 265,
                        gwp_basis=ef_detail.gwp_basis,
                    )
                    em[m] = result["total_emission"]
            
            # 연간 활동량 및 계산식 생성
            annual_activity = sum(qty.get(m, 0.0) for m in range(1, 13))
            
            # 🔍 디버그: 연간 활동량 확인
            if annual_activity == 0:
                logger.warning(
                    f"⚠️ 연간 활동량이 0입니다: facility={facility}, et={et}, unit={source_unit}"
                )
            else:
                logger.debug(
                    f"✅ 활동량 계산 완료: {et} ({facility}), {annual_activity:,.0f} {source_unit}"
                )
            
            # 계산식 생성
            if applicable_scope == "Scope2" and fuel_type == "electricity":
                calc_formula = f"{annual_activity:,.0f} {source_unit} × {ef_detail.composite_factor} kgCO₂eq/{source_unit} ÷ 1000"
                ef_unit_str = f"kgCO₂eq/{source_unit}"
            else:
                heat_coef = ef_detail.heat_content_coefficient or 0
                comp_factor = ef_detail.composite_factor or 0
                if heat_coef > 0:
                    calc_formula = f"{annual_activity:,.0f} {source_unit} × {heat_coef} TJ/천{source_unit} × {comp_factor} tCO₂eq/TJ"
                    ef_unit_str = f"tCO₂eq/TJ (열량계수: {heat_coef} TJ/천{source_unit})"
                else:
                    calc_formula = f"{annual_activity:,.0f} {source_unit} × {comp_factor} tCO₂eq/{source_unit}"
                    ef_unit_str = f"tCO₂eq/{source_unit}"
            
            # 라인 아이템 생성
            li = _line_item(
                et,
                facility,
                em,
                ef_detail.composite_factor,
                ef_detail.reference_source,
                imp_st,
                source_unit=source_unit,
                ef_unit=ef_unit_str,
                ef_version=ef_detail.version or "v2.0",
                factor_code=ef_detail.factor_code or "",
                calculation_formula=calc_formula,
                heat_content=ef_detail.heat_content_coefficient,
                annual_activity=annual_activity,
            )
            
            # 🔍 디버그: 생성된 라인 아이템 확인
            logger.debug(
                f"  → 라인 아이템 생성: {li.name}, source_unit=[{li.source_unit}], "
                f"annual_activity={li.annual_activity:,.0f}, total={li.total:,.2f} tCO₂eq"
            )
            
            # 카테고리별 분류
            mobile = "차량" in et or "vehicle" in et
            if applicable_scope == "Scope1":
                if mobile:
                    acc_s1_mobile.append(li)
                else:
                    acc_s1_fixed.append(li)
                for m in range(1, 13):
                    s1_m[m] += em[m]
            elif applicable_scope == "Scope2":
                if fuel_type == "electricity":
                    acc_s2_grid.append(li)
                else:
                    acc_s2_steam.append(li)
                for m in range(1, 13):
                    s2_m[m] += em[m]

        # 3. 총계 계산
        scope1_total = round(sum(s1_m.values()), 6)
        scope2_total = round(sum(s2_m.values()), 6)
        scope3_total = 0.0
        grand_total = round(scope1_total + scope2_total + scope3_total, 6)

        # 4. 월별 차트 데이터
        monthly_chart = [
            ScopeMonthlyPointDto(
                month=_MONTH_LABELS[i - 1],
                scope1=round(s1_m[i], 6),
                scope2=round(s2_m[i], 6),
            )
            for i in range(1, 13)
        ]

        # 5. 카테고리별 그룹화
        scope1_categories: list[ScopeCalcCategoryDto] = []
        if acc_s1_fixed:
            logger.info(f"✅ Scope 1 고정연소: {len(acc_s1_fixed)}개 항목")
            scope1_categories.append(ScopeCalcCategoryDto(id="s1-fixed", category="고정연소", items=acc_s1_fixed))
        if acc_s1_mobile:
            logger.info(f"✅ Scope 1 이동연소: {len(acc_s1_mobile)}개 항목")
            scope1_categories.append(ScopeCalcCategoryDto(id="s1-mobile", category="이동연소", items=acc_s1_mobile))
        
        scope2_categories: list[ScopeCalcCategoryDto] = []
        if acc_s2_grid:
            s2_label = "전력 (시장기반)" if basis_norm == "market" else "전력 (위치기반)"
            logger.info(f"✅ Scope 2 전력: {len(acc_s2_grid)}개 항목")
            scope2_categories.append(ScopeCalcCategoryDto(id="s2-grid", category=s2_label, items=acc_s2_grid))
        if acc_s2_steam:
            logger.info(f"✅ Scope 2 스팀·열: {len(acc_s2_steam)}개 항목")
            scope2_categories.append(ScopeCalcCategoryDto(id="s2-steam", category="스팀·열", items=acc_s2_steam))
        
        logger.info(
            f"🎯 최종 산정 결과: Scope 1 = {scope1_total:,.2f}, "
            f"Scope 2 = {scope2_total:,.2f}, Total = {grand_total:,.2f} tCO₂eq"
        )

        # 6. YoY 비교
        period_year = year_int
        comparison_year, prev_year_totals = _yoy_from_prev_row(
            company_id,
            period_year,
            basis_norm,
            self._results,
            scope1_categories,
            scope2_categories,
        )

        # 7. DB 저장
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
        ef_bundle = "v2.0"
        
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

        # 8. 응답 반환
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
        """저장된 산정 결과 조회."""
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
            emission_factor_version=raw["emission_factor_version"] or "v2.0",
            calculated_at=calc_at,
            row_import_status="confirmed",
            comparison_year=comparison_year,
            prev_year_totals=prev_year_totals,
        )

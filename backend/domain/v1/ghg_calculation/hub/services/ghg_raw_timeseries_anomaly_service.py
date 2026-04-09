"""스테이징 GHG Raw 월별 시계열 이상치 (YoY·MoM·MA12·3σ)."""
from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Any

from backend.domain.v1.ghg_calculation.hub.repositories.staging_raw_repository import StagingRawRepository
from backend.domain.v1.ghg_calculation.hub.services.raw_data_inquiry_service import (
    _month_from_item_datetime_fields,
    _parse_month,
    _pick,
    _to_float,
)
from backend.domain.v1.ghg_calculation.models.states import (
    GhgAnomalyFindingVo,
    GhgAnomalyScanRequestDto,
    GhgAnomalyScanResponseDto,
)

_SYSTEMS = ("ems", "erp", "ehs", "plm", "srm", "hr", "mdg")
_DEFAULT_CATEGORIES = ("energy",)
_SUPPORTED_CATEGORIES = frozenset(("energy", "waste", "pollution", "chemical"))


def _empty_months() -> dict[int, float]:
    return {i: 0.0 for i in range(1, 13)}


def _energy_val_unit(it: dict[str, Any]) -> tuple[float, str]:
    """raw_data_inquiry_service._map_energy_rows와 동일한 수량·단위 선택."""
    usage_unit = _pick(it, "usage_unit", "unit", "단위")
    pw = _to_float(_pick(it, "purewater_m3", "pure_water_m3"))
    rw = _to_float(_pick(it, "raw_water_m3", "intake_water_m3"))
    std = _to_float(
        _pick(it, "usage_amount", "consumption_kwh", "generation_kwh", "usage_ton", "renewable_kwh")
    )
    if pw != 0.0:
        return pw, usage_unit or "m³"
    if rw != 0.0 and std == 0.0:
        return rw, usage_unit or "m³"
    return std, usage_unit or "kWh"


def _resolve_month(it: dict[str, Any]) -> int | None:
    m = _pick(it, "month", "월", "m")
    if m:
        try:
            return int(_parse_month(str(m)))
        except ValueError:
            return None
    md = _month_from_item_datetime_fields(it)
    return md


def _ym_int(year: str, month: int) -> int:
    y = int(year.strip())
    return y * 100 + month


def _norm_category(categories: list[str] | None) -> list[str]:
    raw = categories or list(_DEFAULT_CATEGORIES)
    out: list[str] = []
    for c in raw:
        k = (c or "").strip().lower()
        if k and k in _SUPPORTED_CATEGORIES and k not in out:
            out.append(k)
    return out or list(_DEFAULT_CATEGORIES)


def _norm_systems(systems: list[str] | None) -> list[str]:
    if not systems:
        return list(_SYSTEMS)
    out: list[str] = []
    for s in systems:
        k = (s or "").strip().lower()
        if k in _SYSTEMS and k not in out:
            out.append(k)
    return out or list(_SYSTEMS)


def _category_key_value(cat: str, it: dict[str, Any]) -> tuple[str, float, str] | None:
    facility = _pick(it, "facility", "site_name", "시설명")
    if cat == "energy":
        metric = _pick(it, "energy_type", "re_type", "에너지원", "에너지유형", "purewater_type", "usage_purpose")
        val, unit = _energy_val_unit(it)
        if (not metric) and val == 0.0:
            return None
        return metric or "unknown", val, unit
    if cat == "waste":
        metric = _pick(it, "waste_type", "폐기물", "waste_name")
        unit = _pick(it, "unit", "단위") or "ton"
        val = _to_float(_pick(it, "generation_ton", "amount_ton", "amount", "quantity", "qty", "value", "usage"))
        if (not metric) and val == 0.0:
            return None
        return metric or "unknown", val, unit
    if cat == "pollution":
        metric = _pick(it, "pollutant", "오염물질", "substance_name", "pollutant_name")
        if not metric:
            metric = _pick(it, "discharge_point", "outlet_name", "배출구")
        val = _to_float(
            _pick(
                it,
                "measured_value",
                "measured",
                "value",
                "bod_mg_l",
                "cod_mg_l",
                "ss_mg_l",
                "nox_ton",
                "sox_ton",
                "voc_ton",
                "dust_ton",
                "volume_ton",
            )
        )
        unit = _pick(it, "unit", "단위") or "value"
        if (not metric) and val == 0.0:
            return None
        return metric or "unknown", val, unit
    if cat == "chemical":
        metric = _pick(it, "chemical_name", "chem_name", "substance_name", "material_name", "약품명")
        unit = _pick(it, "unit", "단위") or "kg"
        val = _to_float(_pick(it, "usage_amount_kg", "usage_kg", "amount_kg", "amount", "quantity", "qty", "value"))
        if (not metric) and val == 0.0:
            return None
        return metric or "unknown", val, unit
    return None


class GhgRawTimeseriesAnomalyService:
    def __init__(self, repository: StagingRawRepository | None = None):
        self._repo = repository or StagingRawRepository()

    def scan(self, req: GhgAnomalyScanRequestDto) -> GhgAnomalyScanResponseDto:
        categories = _norm_category(req.categories)
        systems = _norm_systems(req.systems)
        snaps = self._repo.list_by_company_and_systems(req.company_id, systems)

        # (category, [system], facility, metric, unit, year_str) -> month -> sum
        bucket: dict[tuple[str, str, str, str, str, str], dict[int, float]] = defaultdict(_empty_months)

        for snap in snaps:
            cat = (snap.ghg_raw_category or "").strip().lower()
            if cat not in categories:
                continue
            items = snap.raw_data.get("items") if isinstance(snap.raw_data, dict) else None
            if not isinstance(items, list):
                continue
            for raw in items:
                if not isinstance(raw, dict):
                    continue
                it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
                y = _pick(it, "year", "연도", "yr")
                if not y or not str(y).strip():
                    continue
                year_s = str(y).strip()
                mo = _resolve_month(it)
                if mo is None:
                    continue
                kv = _category_key_value(cat, it)
                if kv is None:
                    continue
                metric, val, unit = kv
                facility = _pick(it, "facility", "site_name", "시설명")
                sys_key = snap.staging_system if req.group_by_system else "all"
                key = (cat, sys_key, facility, metric, unit, year_s)
                bucket[key][mo] += val

        merged: dict[tuple[str, str, str, str, str], dict[int, float]] = defaultdict(dict)
        for (cat, sys_key, facility, metric, unit, year_s), months in bucket.items():
            for m in range(1, 13):
                v = months.get(m, 0.0)
                if v == 0.0:
                    continue
                ym = _ym_int(year_s, m)
                merged[(cat, sys_key, facility, metric, unit)][ym] = (
                    merged[(cat, sys_key, facility, metric, unit)].get(ym, 0.0) + v
                )

        findings: list[GhgAnomalyFindingVo] = []
        fy = (req.year or "").strip()

        for (cat, sys_key, facility, metric, unit), by_ym in merged.items():
            series = sorted(by_ym.items(), key=lambda x: x[0])
            if len(series) < 2:
                continue

            for ym, v in series:
                if v <= 0:
                    continue
                y_num = ym // 100
                mo = ym % 100
                if fy and str(y_num) != fy:
                    continue

                prev_m_ym = ym - 1 if mo > 1 else (y_num - 1) * 100 + 12
                pv_m = by_ym.get(prev_m_ym)
                if pv_m is not None and pv_m > 1e-9 and v / pv_m >= req.mom_ratio:
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="MOM_RATIO",
                            severity="high",
                            phase="timeseries",
                            message=(
                                f"전월 대비 {v / pv_m:.2f}배 이상 급증 (임계 {req.mom_ratio}). "
                                f"{cat} / {facility} / {metric} / {ym}"
                            ),
                            context={
                                "category": cat,
                                "system": sys_key,
                                "facility": facility,
                                "metric": metric,
                                "unit": unit,
                                "year_month": ym,
                                "current": v,
                                "prior_month": pv_m,
                            },
                        )
                    )

                yoy_ym = (y_num - 1) * 100 + mo
                pv_y = by_ym.get(yoy_ym)
                if pv_y is not None and pv_y > 1e-9:
                    pct = abs((v - pv_y) / pv_y * 100.0)
                    if pct > req.yoy_threshold_pct:
                        findings.append(
                            GhgAnomalyFindingVo(
                                rule_code="YOY_PCT",
                                severity="high",
                                phase="timeseries",
                                message=(
                                    f"전년 동기 대비 {pct:.1f}% 변동 (임계 ±{req.yoy_threshold_pct}%). "
                                    f"{cat} / {facility} / {metric} / {ym}"
                                ),
                                context={
                                    "category": cat,
                                    "system": sys_key,
                                    "facility": facility,
                                    "metric": metric,
                                    "unit": unit,
                                    "year_month": ym,
                                    "current": v,
                                    "prior_year_same_month": pv_y,
                                    "change_pct": round(pct, 2),
                                },
                            )
                        )

                hist = [val for y2, val in series if y2 < ym][-12:]
                if hist:
                    ma = statistics.mean(hist)
                    if ma > 1e-9 and v > ma * req.ma12_ratio:
                        findings.append(
                            GhgAnomalyFindingVo(
                                rule_code="MA12_RATIO",
                                severity="medium",
                                phase="timeseries",
                                message=(
                                    f"직전 12개월 평균 대비 {v / ma:.2f}배 (임계 {req.ma12_ratio}). "
                                    f"{cat} / {facility} / {metric} / {ym}"
                                ),
                                context={
                                    "category": cat,
                                    "system": sys_key,
                                    "facility": facility,
                                    "metric": metric,
                                    "unit": unit,
                                    "year_month": ym,
                                    "current": v,
                                    "ma12": ma,
                                },
                            )
                        )

                    if len(hist) >= 3:
                        mu = statistics.mean(hist)
                        sigma = statistics.pstdev(hist) if len(hist) > 1 else 0.0
                        if sigma > 1e-9:
                            z = abs((v - mu) / sigma)
                            if z > req.zscore_threshold:
                                findings.append(
                                    GhgAnomalyFindingVo(
                                        rule_code="ZSCORE_12M",
                                        severity="medium",
                                        phase="timeseries",
                                        message=(
                                            f"직전 구간 대비 |Z|={z:.2f} (임계 {req.zscore_threshold}). "
                                            f"{cat} / {facility} / {metric} / {ym}"
                                        ),
                                        context={
                                            "category": cat,
                                            "system": sys_key,
                                            "facility": facility,
                                            "metric": metric,
                                            "unit": unit,
                                            "year_month": ym,
                                            "current": v,
                                            "zscore": round(z, 3),
                                            "window_n": len(hist),
                                        },
                                    )
                                )

                    # IQR 기반 이상치 검증 (비정규분포 대응)
                    if req.enable_iqr and len(hist) >= 4:
                        sorted_hist = sorted(hist)
                        n = len(sorted_hist)
                        q1_idx = n // 4
                        q3_idx = (3 * n) // 4
                        q1 = sorted_hist[q1_idx]
                        q3 = sorted_hist[q3_idx]
                        iqr = q3 - q1

                        if iqr > 1e-9:
                            lower_bound = q1 - req.iqr_multiplier * iqr
                            upper_bound = q3 + req.iqr_multiplier * iqr

                            if v < lower_bound or v > upper_bound:
                                is_extreme = v < (q1 - 3.0 * iqr) or v > (q3 + 3.0 * iqr)
                                findings.append(
                                    GhgAnomalyFindingVo(
                                        rule_code="IQR_OUTLIER" if not is_extreme else "IQR_EXTREME",
                                        severity="high" if is_extreme else "medium",
                                        phase="timeseries",
                                        message=(
                                            f"IQR {req.iqr_multiplier}배 범위 이탈 "
                                            f"[{lower_bound:.1f}, {upper_bound:.1f}]. "
                                            f"{cat} / {facility} / {metric} / {ym}"
                                        ),
                                        context={
                                            "category": cat,
                                            "system": sys_key,
                                            "facility": facility,
                                            "metric": metric,
                                            "unit": unit,
                                            "year_month": ym,
                                            "current": v,
                                            "q1": round(q1, 2),
                                            "q3": round(q3, 2),
                                            "iqr": round(iqr, 2),
                                            "lower_bound": round(lower_bound, 2),
                                            "upper_bound": round(upper_bound, 2),
                                            "is_extreme": is_extreme,
                                        },
                                    )
                                )

        return GhgAnomalyScanResponseDto(
            company_id=str(req.company_id),
            categories=categories,
            systems=systems,
            group_by_system=req.group_by_system,
            timeseries_findings=findings,
            series_evaluated=len(merged),
        )

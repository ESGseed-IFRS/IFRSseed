"""`ghg_activity_data` 행 목록 → `environmental_data`에 넣을 부분 필드 집계."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from backend.domain.v1.esg_data.models.bases.ghg_activity_data import GhgActivityData


def _to_decimal(v: Any) -> Optional[Decimal]:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return v
    try:
        return Decimal(str(v))
    except Exception:
        return None


def _norm_unit(u: Optional[str]) -> str:
    if not u:
        return ""
    return u.strip().lower().replace("·", "").replace(" ", "").replace("_", "")


def usage_amount_to_mwh(amount: Any, unit: Optional[str]) -> Optional[Decimal]:
    """전력·열 등 사용량을 MWh로 환산. 미지원 단위는 None."""
    a = _to_decimal(amount)
    if a is None:
        return None
    u = _norm_unit(unit)
    if u in ("kwh", "kwhr"):
        return a / Decimal(1000)
    if u in ("mwh", "mwhr"):
        return a
    if u == "gj":
        return a / Decimal("3.6")
    if u in ("gcal", "mcal"):
        return a * Decimal("0.001163")
    return None


_HAZARDOUS_YN = frozenset({"y", "yes", "1", "true", "예"})


def _is_hazardous(yn: Optional[str]) -> bool:
    if not yn:
        return False
    return yn.strip().lower() in _HAZARDOUS_YN


def aggregate_activity_for_environmental(rows: List["GhgActivityData"]) -> Dict[str, Optional[Decimal]]:
    """
    연도 내 활동자료 전 행을 합산. 단위 혼재 시 일부 행은 생략될 수 있음(usage_unit 미지원 등).
    """
    total_mwh = Decimal(0)
    ren_mwh = Decimal(0)
    waste_gen = Decimal(0)
    waste_rec = Decimal(0)
    waste_inc = Decimal(0)
    waste_land = Decimal(0)
    haz_waste = Decimal(0)
    water_in = Decimal(0)
    water_cons = Decimal(0)
    water_dis = Decimal(0)
    water_reuse = Decimal(0)
    nox = Decimal(0)
    sox = Decimal(0)
    voc = Decimal(0)
    dust = Decimal(0)

    has_energy = False
    has_ren = False
    has_waste = False
    has_water = False
    has_air = False

    for r in rows:
        tt = (r.tab_type or "").strip()
        if tt == "power_heat_steam":
            m = usage_amount_to_mwh(r.usage_amount, r.usage_unit)
            if m is not None:
                total_mwh += m
                has_energy = True
            rk = _to_decimal(r.renewable_kwh)
            if rk is not None:
                ren_mwh += rk / Decimal(1000)
                has_ren = True
        elif tt == "fuel_vehicle":
            m = usage_amount_to_mwh(r.consumption_amount, r.fuel_unit)
            if m is not None:
                total_mwh += m
                has_energy = True
        elif tt == "renewable_energy":
            g = _to_decimal(r.re_generation_kwh)
            c = _to_decimal(r.re_consumption_kwh)
            for x in (g, c):
                if x is not None:
                    ren_mwh += x / Decimal(1000)
                    has_ren = True
        elif tt == "waste":
            g = _to_decimal(r.generation_amount)
            if g is not None:
                waste_gen += g
                has_waste = True
            ra = _to_decimal(r.recycling_amount)
            if ra is not None:
                waste_rec += ra
                has_waste = True
            ia = _to_decimal(r.incineration_amount)
            if ia is not None:
                waste_inc += ia
                has_waste = True
            lr = _to_decimal(r.landfill_rate_pct)
            if g is not None and lr is not None:
                waste_land += g * lr / Decimal(100)
                has_waste = True
            if _is_hazardous(r.hazardous_waste_yn) and g is not None:
                haz_waste += g
                has_waste = True
        elif tt == "water_usage":
            wi = _to_decimal(r.water_intake_ton)
            if wi is not None:
                water_in += wi
                has_water = True
            wc = _to_decimal(r.water_consumption_ton)
            if wc is not None:
                water_cons += wc
                has_water = True
            wd = _to_decimal(r.water_discharge_ton)
            if wd is not None:
                water_dis += wd
                has_water = True
            wr = _to_decimal(r.water_reuse_ton)
            if wr is not None:
                water_reuse += wr
                has_water = True
        elif tt == "air_emissions":
            val = _to_decimal(r.nox_kg)
            if val is not None:
                nox += val
                has_air = True
            val = _to_decimal(r.sox_kg)
            if val is not None:
                sox += val
                has_air = True
            val = _to_decimal(r.voc_kg)
            if val is not None:
                voc += val
                has_air = True
            val = _to_decimal(r.dust_kg)
            if val is not None:
                dust += val
                has_air = True

    ren_ratio: Optional[Decimal] = None
    if has_energy and total_mwh > 0 and has_ren:
        ren_ratio = (ren_mwh / total_mwh) * Decimal(100)
        if ren_ratio > Decimal(100):
            ren_ratio = Decimal(100)

    out: Dict[str, Optional[Decimal]] = {
        "total_energy_consumption_mwh": total_mwh if has_energy else None,
        "renewable_energy_mwh": ren_mwh if has_ren else None,
        "renewable_energy_ratio": ren_ratio,
        "total_waste_generated": waste_gen if has_waste else None,
        "waste_recycled": waste_rec if has_waste else None,
        "waste_incinerated": waste_inc if has_waste else None,
        "waste_landfilled": waste_land if has_waste else None,
        "hazardous_waste": (haz_waste if has_waste else None),
        "water_withdrawal": water_in if has_water else None,
        "water_consumption": water_cons if has_water else None,
        "water_discharge": water_dis if has_water else None,
        "water_recycling": water_reuse if has_water else None,
        "nox_emission": nox if has_air else None,
        "sox_emission": sox if has_air else None,
        "voc_emission": voc if has_air else None,
        "dust_emission": dust if has_air else None,
    }

    return out

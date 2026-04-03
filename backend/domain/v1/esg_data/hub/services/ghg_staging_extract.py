"""staging raw_data.items[] 항목 → `ghg_activity_data` 컬럼 매핑 (순수 함수)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable, Dict, Mapping, Optional, Set

from backend.domain.v1.esg_data.hub.services.social_staging_extract import extract_year_from_item

_TAB_TYPES: Set[str] = {
    "power_heat_steam",
    "fuel_vehicle",
    "refrigerant",
    "waste",
    "logistics_travel",
    "raw_materials",
    "water_usage",
    "pure_water",
    "air_emissions",
    "renewable_energy",
    "scope3_activity",
}

# item 키(정규화) → DB 컬럼명 (동일 이름은 생략 가능하지만 SDS 별칭 명시)
_ITEM_ALIASES: Dict[str, str] = {
    "record_id": "source_record_id",
    "co2_tco2e": "ghg_co2_tco2e",
    "ch4_tco2e": "ghg_ch4_tco2e",
    "n2o_tco2e": "ghg_n2o_tco2e",
    "hfcs_tco2e": "ghg_hfcs_tco2e",
    "total_tco2e": "ghg_total_tco2e",
    "basis": "ghg_accounting_basis",
    "activity_data": "scope3_activity_amount",
    "activity_unit": "scope3_activity_unit",
    "emission_factor": "scope3_emission_factor",
    "ghg_emission_tco2e": "scope3_ghg_emission_tco2e",
    "category_name": "scope3_category_name",
    "subcategory": "scope3_subcategory",
    "calculation_method": "scope3_calculation_method",
    "ef_unit": "scope3_ef_unit",
    "ef_source": "scope3_ef_source",
    "boundary": "scope3_boundary",
    "source_file": "scope3_source_file",
    "notes": "scope3_notes",
    "emission_source": "emission_source_description",
    "generation_kwh": "re_generation_kwh",
    "consumption_kwh": "re_consumption_kwh",
    "evaporation_m3": "process_evaporation_m3",
    # GHG CSV 등: 단위가 consumption_unit 인 경우 (탭별 후처리에서 fuel_unit 등으로 복사)
}


def _norm_key(k: Any) -> str:
    return str(k).strip().lower().replace(" ", "_")


def _norm_cat(s: Optional[str]) -> str:
    if not s:
        return ""
    return str(s).strip().lower().replace(" ", "_").replace("-", "_")


def _item_norm_map(item: Mapping[str, Any]) -> Dict[str, Any]:
    return {_norm_key(k): v for k, v in item.items()}


def _coerce_decimal(val: Any) -> Optional[Decimal]:
    if val is None or val == "":
        return None
    try:
        return Decimal(str(val).replace(",", "").strip())
    except Exception:
        return None


def _coerce_int(val: Any) -> Optional[int]:
    d = _coerce_decimal(val)
    if d is None:
        return None
    try:
        return int(d)
    except Exception:
        return None


def _parse_date(val: Any) -> Optional[date]:
    if val is None or val == "":
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()[:10]
    try:
        y, m, d_ = s.split("-")
        return date(int(y), int(m), int(d_))
    except Exception:
        return None


def _parse_datetime(val: Any) -> Optional[datetime]:
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip().replace("T", " ")
    for fmt, n in (("%Y-%m-%d %H:%M:%S", 19), ("%Y-%m-%d %H:%M", 16), ("%Y-%m-%d", 10)):
        try:
            return datetime.strptime(s[:n], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(str(val).strip().replace(" ", "T"))
    except ValueError:
        return None


def _normalized_item_keys(item: Mapping[str, Any]) -> Set[str]:
    return set(_item_norm_map(item).keys())


def infer_tab_type(
    system_norm: str,
    ghg_raw_category: Optional[str],
    item: Mapping[str, Any],
) -> str:
    """staging 행의 시스템·카테고리·필드 휴리스틱으로 tab_type 결정."""
    nk = _item_norm_map(item)
    if "tab_type" in nk and _norm_cat(str(nk.get("tab_type"))) in _TAB_TYPES:
        return str(nk["tab_type"]).strip()

    cat = _norm_cat(ghg_raw_category)
    if cat in _TAB_TYPES:
        return cat

    keys = _normalized_item_keys(item)

    if "scope3_category" in nk and str(nk.get("scope3_category") or "").strip():
        return "scope3_activity"
    if "nox_kg" in nk or "sox_kg" in nk or "dust_kg" in nk:
        return "air_emissions"
    fc = str(nk.get("fuel_category") or "").strip().lower()
    if fc in ("fugitive", "탈루") or "탈루" in fc:
        return "refrigerant"
    if "pure_water_m3" in nk or ("usage_purpose" in nk and "raw_water_m3" in nk):
        return "pure_water"
    if keys & {"water_intake_ton", "water_consumption_ton", "wue_l_kwh"}:
        return "water_usage"
    if "re_type" in nk or "re_source" in nk:
        return "renewable_energy"
    if "consumption_amount" in nk and "fuel_type" in nk:
        if "emission_factor_id" in nk or "ghg_total_tco2e" in nk or "total_tco2e" in nk:
            return "fuel_vehicle"
    if "refrigerant_type" in nk or "leak_amount_kg" in nk or "charge_amount_kg" in nk:
        return "refrigerant"
    if {"waste_name", "waste_type", "hazardous_waste_yn", "treatment_contractor"} & keys:
        return "waste"
    if "generation_amount" in nk and "disposal_method" in nk:
        return "waste"
    if "generation_amount" in nk and cat.startswith("waste"):
        return "waste"
    if keys & {"distance_km", "transport_mode", "person_trips"}:
        return "logistics_travel"
    if "supplier_name" in nk and "product_name" in nk:
        return "raw_materials"
    if system_norm in {"plm", "srm"} and ("product_name" in nk or "supplier_name" in nk):
        return "raw_materials"
    if system_norm == "erp" and ("fuel_type" in nk or "consumption_amount" in nk):
        return "fuel_vehicle"
    if system_norm == "hr":
        return "logistics_travel"
    if system_norm == "ehs":
        return "refrigerant"
    if system_norm == "erp":
        return "fuel_vehicle"
    if system_norm in {"plm", "srm"}:
        return "raw_materials"
    return "power_heat_steam"


# DB 컬럼명 (모델과 동기화) — id / company_id / tab_type / created_at 제외 후 채움
_STRING_COLS = {
    "site_name",
    "energy_type",
    "energy_source",
    "usage_unit",
    "fuel_category",
    "fuel_type",
    "fuel_unit",
    "equipment_id",
    "equipment_type",
    "refrigerant_type",
    "waste_type",
    "waste_name",
    "disposal_method",
    "category",
    "transport_mode",
    "origin_country",
    "destination_country",
    "supplier_name",
    "product_name",
    "ghg_reported_yn",
    "data_quality",
    "source_system",
    "source_record_id",
    "site_code",
    "meter_id",
    "ghg_accounting_basis",
    "fuel_code",
    "emission_factor_id",
    "verification_body",
    "verification_level",
    "hazardous_waste_yn",
    "treatment_contractor",
    "water_source",
    "water_stress_area_yn",
    "water_discharge_destination",
    "discharge_quality_compliant_yn",
    "site_type_label",
    "usage_purpose",
    "intake_source",
    "emission_source_description",
    "air_source_fuel_type",
    "air_compliance_status",
    "air_measurement_method",
    "measurement_agency",
    "re_type",
    "re_source",
    "certificate_type",
    "scope3_category",
    "scope3_category_name",
    "scope3_subcategory",
    "scope3_calculation_method",
    "scope3_activity_unit",
    "scope3_ef_unit",
    "scope3_ef_source",
    "scope3_boundary",
    "scope3_source_file",
    "scope3_notes",
}
_INT_COLS = {"period_year", "period_month", "period_quarter", "person_trips"}
_DECIMAL_COLS = {
    "usage_amount",
    "renewable_ratio",
    "consumption_amount",
    "purchase_amount",
    "charge_amount_kg",
    "leak_amount_kg",
    "gwp_factor",
    "generation_amount",
    "incineration_amount",
    "recycling_amount",
    "distance_km",
    "weight_ton",
    "supplier_emission_tco2e",
    "use_phase_emission",
    "eol_emission",
    "renewable_kwh",
    "non_renewable_kwh",
    "pue_monthly",
    "it_load_kw",
    "cooling_power_kwh",
    "grid_emission_factor_market",
    "grid_emission_factor_location",
    "calculated_ghg_market_tco2e",
    "calculated_ghg_location_tco2e",
    "ghg_co2_tco2e",
    "ghg_ch4_tco2e",
    "ghg_n2o_tco2e",
    "ghg_hfcs_tco2e",
    "ghg_total_tco2e",
    "recycling_rate_pct",
    "landfill_rate_pct",
    "incineration_rate_pct",
    "water_intake_ton",
    "water_discharge_ton",
    "water_reuse_ton",
    "water_consumption_ton",
    "water_reuse_rate_pct",
    "cooling_tower_makeup_ton",
    "water_blowdown_ton",
    "water_evaporation_site_ton",
    "wue_l_kwh",
    "raw_water_m3",
    "pure_water_m3",
    "purewater_conversion_ratio",
    "return_water_m3",
    "process_evaporation_m3",
    "conductivity_us_cm",
    "resistivity_mohm_cm",
    "water_usage_cost_krw",
    "operation_hours",
    "nox_kg",
    "sox_kg",
    "dust_kg",
    "co_kg",
    "voc_kg",
    "nox_conc_ppm",
    "sox_conc_ppm",
    "dust_conc_mg_m3",
    "regulatory_limit_nox",
    "re_generation_kwh",
    "re_consumption_kwh",
    "certificate_volume_rec",
    "certificate_cost_krw",
    "re_co2_reduction_tco2e",
    "grid_displacement_factor",
    "scope3_activity_amount",
    "scope3_emission_factor",
    "scope3_ghg_emission_tco2e",
}
_DATE_COLS = {"inspection_date"}


def _apply_aliases(nk: str) -> str:
    return _ITEM_ALIASES.get(nk, nk)


def _fill_source_record_id(
    out: Dict[str, Any],
    nkmap: Dict[str, Any],
    *,
    staging_row_id: Optional[str],
    staging_item_index: int,
) -> None:
    if out.get("source_record_id"):
        return
    for key in (
        "record_id",
        "external_id",
        "line_id",
        "row_id",
        "doc_id",
        "transaction_id",
    ):
        v = nkmap.get(key)
        if v not in (None, ""):
            out["source_record_id"] = str(v).strip()
            return
    if staging_row_id:
        out["source_record_id"] = f"stg:{staging_row_id}:{staging_item_index}"


def map_staging_item_to_row(
    company_id: Any,
    ingest_system: str,
    item: Mapping[str, Any],
    *,
    ghg_raw_category: Optional[str] = None,
    staging_source_file: Optional[str] = None,
    staging_row_id: Optional[str] = None,
    staging_item_index: int = 0,
) -> Optional[Dict[str, Any]]:
    """
    단일 item dict → `GhgActivityData` 생성용 kwargs (None이면 연도 불가 등 스킵).
    ingest_system: staging 키 (ems, erp, …)
    """
    sys_norm = ingest_system.strip().lower()
    period_year = extract_year_from_item(item)
    if period_year is None:
        return None

    tab_type = infer_tab_type(sys_norm, ghg_raw_category, item)
    nkmap = _item_norm_map(item)

    out: Dict[str, Any] = {
        "company_id": company_id,
        "tab_type": tab_type,
        "period_year": period_year,
        "source_system": ingest_system.strip().upper(),
    }

    site = nkmap.get("site_name") or nkmap.get("site")
    out["site_name"] = str(site).strip() if site not in (None, "") else "-"

    if "period_month" in nkmap:
        out["period_month"] = _coerce_int(nkmap["period_month"])
    if "month" in nkmap and "period_month" not in out:
        out["period_month"] = _coerce_int(nkmap["month"])
    if "quarter" in nkmap:
        out["period_quarter"] = _coerce_int(nkmap["quarter"])

    for raw_k, val in item.items():
        nk = _norm_key(raw_k)
        col = _apply_aliases(nk)
        if col in {"company_id", "tab_type", "period_year", "site_name", "created_at", "id"}:
            continue
        if col not in _STRING_COLS | _INT_COLS | _DECIMAL_COLS | _DATE_COLS:
            continue
        if val is None or val == "":
            continue
        if col in _STRING_COLS:
            out[col] = str(val).strip()
        elif col in _INT_COLS:
            v = _coerce_int(val)
            if v is not None:
                out[col] = v
        elif col in _DECIMAL_COLS:
            v = _coerce_decimal(val)
            if v is not None:
                out[col] = v
        elif col in _DATE_COLS:
            v = _parse_date(val)
            if v is not None:
                out[col] = v

    if staging_source_file and "scope3_source_file" not in out:
        out.setdefault("scope3_source_file", staging_source_file)

    st = nkmap.get("synced_at")
    if st is not None:
        parsed = _parse_datetime(st)
        if parsed:
            out["synced_at"] = parsed

    if tab_type == "air_emissions":
        ft = nkmap.get("fuel_type")
        if ft and "air_source_fuel_type" not in out:
            out["air_source_fuel_type"] = str(ft).strip()

    if tab_type in ("fuel_vehicle", "refrigerant"):
        if not out.get("fuel_unit"):
            cu = nkmap.get("consumption_unit")
            if cu not in (None, ""):
                out["fuel_unit"] = str(cu).strip()

    if tab_type == "refrigerant":
        if not out.get("refrigerant_type"):
            ft = out.get("fuel_type") or nkmap.get("fuel_type")
            if ft not in (None, ""):
                out["refrigerant_type"] = str(ft).strip()

    if tab_type == "power_heat_steam" and not out.get("usage_unit"):
        u = nkmap.get("unit")
        if u not in (None, ""):
            out["usage_unit"] = str(u).strip()

    _fill_source_record_id(out, nkmap, staging_row_id=staging_row_id, staging_item_index=staging_item_index)

    return out


def map_staging_items_for_year(
    ingest_system: str,
    staging_rows: list,
    period_year: int,
    *,
    include_if_year_missing: bool = True,
    item_filter: Optional[Callable[[Mapping[str, Any]], bool]] = None,
) -> list:
    """staging ORM 행들에서 해당 연도 items만 펼쳐 매핑 (company_id는 각 staging row에서)."""
    from backend.domain.v1.esg_data.hub.services.social_staging_extract import filter_items_for_period

    mapped: list = []
    for row in staging_rows:
        cid = getattr(row, "company_id", None)
        if cid is None:
            continue
        rd = getattr(row, "raw_data", None) or {}
        if not isinstance(rd, dict):
            continue
        items = rd.get("items") or []
        if not isinstance(items, list):
            continue
        ghg_cat = getattr(row, "ghg_raw_category", None)
        src_file = getattr(row, "source_file_name", None) or rd.get("source_file")
        row_pk = str(getattr(row, "id", "") or "")
        for idx, raw in enumerate(items):
            if not isinstance(raw, Mapping):
                continue
            if item_filter and not item_filter(raw):
                continue
            flt = filter_items_for_period([raw], period_year, include_if_year_missing=include_if_year_missing)
            if not flt:
                continue
            m = map_staging_item_to_row(
                cid,
                ingest_system,
                flt[0],
                ghg_raw_category=ghg_cat,
                staging_source_file=str(src_file) if src_file else None,
                staging_row_id=row_pk or None,
                staging_item_index=idx,
            )
            if m:
                m["_staging_id"] = str(getattr(row, "id", ""))
                mapped.append(m)
    return mapped

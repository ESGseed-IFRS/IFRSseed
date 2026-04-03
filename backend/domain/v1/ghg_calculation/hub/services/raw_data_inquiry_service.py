"""Raw Data 전체 탭 조회 서비스."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from backend.domain.v1.ghg_calculation.hub.repositories.staging_raw_repository import (
    StagingRawRepository,
    StagingRawRowSnapshot,
)
from backend.domain.v1.ghg_calculation.models.states import (
    ChemicalRowVo,
    ConsignmentRowVo,
    EnergyProviderRowVo,
    EnergyUsageRowVo,
    PollutionRowVo,
    RawDataInquiryRequestDto,
    RawDataInquiryResponseDto,
    WasteRowVo,
)


class RawDataInquiryService:
    """company/year/month 기반으로 전 카테고리 데이터를 반환."""

    def __init__(self, repository: StagingRawRepository | None = None):
        self._repo = repository or StagingRawRepository()

    def inquire(self, req: RawDataInquiryRequestDto) -> RawDataInquiryResponseDto:
        snapshots = self._repo.list_by_company_and_systems(
            req.company_id,
            ("ems", "erp", "ehs", "plm", "srm", "hr", "mdg"),
        )

        energy_rows: list[EnergyUsageRowVo] = []
        waste_rows: list[WasteRowVo] = []
        pollution_rows: list[PollutionRowVo] = []
        chemical_rows: list[ChemicalRowVo] = []
        provider_rows: list[EnergyProviderRowVo] = []
        consignment_rows: list[ConsignmentRowVo] = []

        for snap in snapshots:
            cat = (snap.ghg_raw_category or "").strip().lower()
            if not cat:
                continue
            items = snap.raw_data.get("items") if isinstance(snap.raw_data, dict) else None
            if not isinstance(items, list):
                continue
            matched_items = [
                it
                for it in items
                if _matches_period(it, req.year, req.month, req.period_type)
                and _matches_facility_raw(it, req.facility)
            ]
            if not matched_items:
                continue

            if cat == "energy":
                energy_rows.extend(_map_energy_rows(matched_items, snap.import_status))
            elif cat == "waste":
                waste_rows.extend(_map_waste_rows(matched_items, snap.import_status))
            elif cat == "pollution":
                pollution_rows.extend(_map_pollution_rows(matched_items))
            elif cat == "chemical":
                chemical_rows.extend(_map_chemical_rows(matched_items, snap.import_status))
            elif cat == "energy-provider":
                provider_rows.extend(_map_provider_rows(matched_items))
            elif cat == "consignment":
                consignment_rows.extend(_map_consign_rows(matched_items))

        energy_rows, waste_rows, pollution_rows, chemical_rows, provider_rows, consignment_rows = (
            _apply_table_filters(
                req,
                energy_rows,
                waste_rows,
                pollution_rows,
                chemical_rows,
                provider_rows,
                consignment_rows,
            )
        )

        return RawDataInquiryResponseDto(
            category="all",
            year=req.year,
            energy_rows=_reindex(energy_rows, EnergyUsageRowVo),
            waste_rows=_reindex(waste_rows, WasteRowVo),
            pollution_rows=_reindex(pollution_rows, PollutionRowVo),
            chemical_rows=_reindex(chemical_rows, ChemicalRowVo),
            energy_provider_rows=_reindex(provider_rows, EnergyProviderRowVo),
            consignment_rows=_reindex(consignment_rows, ConsignmentRowVo),
        )


def _pick(item: dict[str, Any], *keys: str) -> str:
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return str(item[key]).strip()
    return ""


def _parse_month(v: str) -> str:
    x = v.strip().lstrip("0")
    if not x:
        return "01"
    try:
        n = int(x)
    except ValueError:
        return "01"
    return f"{max(1, min(n, 12)):02d}"


def _matches_facility_raw(raw: Any, facility: str) -> bool:
    if not isinstance(raw, dict):
        return False
    want = (facility or "").strip()
    if not want or want == "전체":
        return True
    it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
    fac = _pick(it, "facility", "site_name", "시설명")
    if not fac:
        return True
    return fac.strip() == want


def _item_month_int(it: dict[str, Any]) -> int | None:
    m = _pick(it, "month", "월", "m")
    if m:
        return int(_parse_month(m))
    md = _month_from_item_datetime_fields(it)
    return md


def _item_quarter_int(it: dict[str, Any]) -> int | None:
    q = _pick(it, "quarter", "분기", "q")
    if not q:
        return None
    try:
        return int(q.lstrip("qQ").strip())
    except ValueError:
        return None


def _matches_period(raw: Any, year: str, month: str, period_type: str = "월") -> bool:
    if not isinstance(raw, dict):
        return False
    it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
    y = _pick(it, "year", "연도", "yr")
    if y and y != year:
        return False
    month_key = (month or "").strip().lower()
    if month_key in ("", "all", "전체", "00"):
        return True

    pt = (period_type or "월").strip()
    if pt not in ("월", "분기", "반기"):
        pt = "월"

    anchor = int(_parse_month(month))

    mn = _item_month_int(it)
    qn = _item_quarter_int(it)

    if pt == "월":
        if mn is not None:
            return mn == anchor
        if qn is not None:
            return qn == _quarter_from_month(str(anchor).zfill(2))
        return True

    if pt == "분기":
        target_q = (anchor - 1) // 3 + 1
        if mn is not None:
            return (mn - 1) // 3 + 1 == target_q
        if qn is not None:
            return qn == target_q
        return True

    if pt == "반기":
        target_h = 1 if anchor <= 6 else 2
        if mn is not None:
            return (1 if mn <= 6 else 2) == target_h
        if qn is not None:
            item_h = 1 if qn <= 2 else 2
            return item_h == target_h
        return True

    return True


def _apply_table_filters(
    req: RawDataInquiryRequestDto,
    energy_rows: list[EnergyUsageRowVo],
    waste_rows: list[WasteRowVo],
    pollution_rows: list[PollutionRowVo],
    chemical_rows: list[ChemicalRowVo],
    provider_rows: list[EnergyProviderRowVo],
    consignment_rows: list[ConsignmentRowVo],
) -> tuple[
    list[EnergyUsageRowVo],
    list[WasteRowVo],
    list[PollutionRowVo],
    list[ChemicalRowVo],
    list[EnergyProviderRowVo],
    list[ConsignmentRowVo],
]:
    fac = (req.facility or "").strip()
    kw = (req.search_keyword or "").strip().lower()
    st = (req.sub_type or "").strip() or "전체"

    def fac_ok(f: str) -> bool:
        if not fac or fac == "전체":
            return True
        return (f or "").strip() == fac

    out_e: list[EnergyUsageRowVo] = []
    for r in energy_rows:
        if not fac_ok(r.facility):
            continue
        if st not in ("", "전체"):
            et = (r.energy_type or "").strip()
            if st == "순수(정제수)":
                if et != "순수" and "순수" not in et:
                    continue
            elif et != st:
                continue
        if kw and kw not in f"{r.facility} {r.energy_type}".lower():
            continue
        out_e.append(r)

    out_w: list[WasteRowVo] = []
    for r in waste_rows:
        if not fac_ok(r.facility):
            continue
        if kw and kw not in f"{r.facility} {r.waste_type} {r.vendor}".lower():
            continue
        out_w.append(r)

    out_p: list[PollutionRowVo] = []
    for r in pollution_rows:
        if not fac_ok(r.facility):
            continue
        pol = r.pollutant or ""
        if st == "수질":
            if "(수질)" not in pol and "수질" not in pol:
                continue
        elif st == "대기":
            if "(대기)" not in pol and "대기" not in pol:
                continue
        if kw and kw not in f"{r.facility} {r.pollutant} {r.outlet_name}".lower():
            continue
        out_p.append(r)

    out_c: list[ChemicalRowVo] = []
    for r in chemical_rows:
        if not fac_ok(r.facility):
            continue
        if kw and kw not in f"{r.facility} {r.chemical_name} {r.cas_no}".lower():
            continue
        out_c.append(r)

    out_pr: list[EnergyProviderRowVo] = []
    for r in provider_rows:
        if kw and kw not in f"{r.provider_name} {r.energy_type} {r.contract_no}".lower():
            continue
        out_pr.append(r)

    out_co: list[ConsignmentRowVo] = []
    for r in consignment_rows:
        if kw and kw not in f"{r.vendor_name} {r.waste_type} {r.permit_no}".lower():
            continue
        out_co.append(r)

    return out_e, out_w, out_p, out_c, out_pr, out_co


def _status(import_status: str | None) -> str:
    s = (import_status or "").lower()
    if s == "failed":
        return "error"
    if s in ("pending", "processing"):
        return "draft"
    return "confirmed"


def _fmt_num(v: Any) -> str:
    if v in ("", None):
        return ""
    s = str(v).replace(",", "").strip()
    if not s:
        return ""
    try:
        f = float(s)
    except ValueError:
        return str(v)
    if abs(f - round(f)) < 1e-9:
        return f"{int(round(f)):,}"
    return f"{f:,.2f}".rstrip("0").rstrip(".")


def _to_float(v: Any) -> float:
    if v in ("", None):
        return 0.0
    s = str(v).replace(",", "").strip()
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _quarter_from_month(month: str) -> int:
    m = int(_parse_month(month))
    if m <= 3:
        return 1
    if m <= 6:
        return 2
    if m <= 9:
        return 3
    return 4


def _quarter_month_slot(q: int) -> int:
    return {1: 1, 2: 4, 3: 7, 4: 10}.get(q, 10)


def _month_from_iso_datetime_string(s: str) -> int | None:
    """'2024-01-05 08:00:00', ISO 날짜 등에서 월(1–12) 추출."""
    head = s.strip().replace("T", " ").split()[0]
    if len(head) >= 7 and head[4] == "-":
        try:
            mo = int(head[5:7])
            return max(1, min(12, mo))
        except ValueError:
            return None
    return None


def _month_from_item_datetime_fields(it: dict[str, Any]) -> int | None:
    for key in ("created_at", "synced_at", "updated_at", "reporting_date", "기준일"):
        raw = _pick(it, key)
        if raw:
            m = _month_from_iso_datetime_string(raw)
            if m is not None:
                return m
    return None


def _resolve_bucket_month(it: dict[str, Any]) -> int:
    """피벗 월: 명시 월 > 일시 필드 월 > 분기 대표월(1·4·7·10) > 1."""
    m = _pick(it, "month", "월", "m")
    if m:
        return int(_parse_month(m))
    md = _month_from_item_datetime_fields(it)
    if md is not None:
        return md
    q = _pick(it, "quarter", "분기", "q")
    if q:
        try:
            qn = int(q.lstrip("qQ").strip())
            return _quarter_month_slot(qn)
        except ValueError:
            pass
    return 1


def _empty_months() -> dict[int, float]:
    return {i: 0.0 for i in range(1, 13)}


def _month_fields(months: dict[int, float]) -> dict[str, str]:
    return {
        "jan": _fmt_num(months[1]),
        "feb": _fmt_num(months[2]),
        "mar": _fmt_num(months[3]),
        "apr": _fmt_num(months[4]),
        "may": _fmt_num(months[5]),
        "jun": _fmt_num(months[6]),
        "jul": _fmt_num(months[7]),
        "aug": _fmt_num(months[8]),
        "sep": _fmt_num(months[9]),
        "oct": _fmt_num(months[10]),
        "nov": _fmt_num(months[11]),
        "dec": _fmt_num(months[12]),
    }


def _map_energy_rows(items: list[Any], import_status: str | None) -> list[EnergyUsageRowVo]:
    bucket: dict[tuple[str, str, str], dict[int, float]] = defaultdict(_empty_months)
    for raw in items:
        if not isinstance(raw, dict):
            continue
        it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
        facility = _pick(it, "facility", "site_name", "시설명")
        et = _pick(it, "energy_type", "re_type", "에너지원", "에너지유형", "purewater_type", "usage_purpose")
        usage_unit = _pick(it, "usage_unit", "unit", "단위")
        m = _pick(it, "month", "월", "m")
        if m:
            month = int(_parse_month(m))
        else:
            md = _month_from_item_datetime_fields(it)
            if md is None:
                continue
            month = md
        # EMS_PUREWATER_USAGE 등: 수량이 purewater_m3 / raw_water_m3 컬럼에만 있음
        pw = _to_float(_pick(it, "purewater_m3", "pure_water_m3"))
        rw = _to_float(_pick(it, "raw_water_m3", "intake_water_m3"))
        std = _to_float(
            _pick(it, "usage_amount", "consumption_kwh", "generation_kwh", "usage_ton", "renewable_kwh")
        )
        if pw != 0.0:
            val = pw
            unit = usage_unit or "m³"
        elif rw != 0.0 and std == 0.0:
            val = rw
            unit = usage_unit or "m³"
        else:
            val = std
            unit = usage_unit or "kWh"
        if (not et) and val == 0:
            continue
        bucket[(facility, et, unit)][month] += val
    out: list[EnergyUsageRowVo] = []
    st = _status(import_status)
    for i, ((facility, et, unit), months) in enumerate(sorted(bucket.items()), start=1):
        mf = _month_fields(months)
        total = sum(months.values())
        if total == 0:
            continue
        out.append(
            EnergyUsageRowVo(
                id=i,
                facility=facility,
                energy_type=et,
                unit=unit,
                jan=mf["jan"],
                feb=mf["feb"],
                mar=mf["mar"],
                apr=mf["apr"],
                may=mf["may"],
                jun=mf["jun"],
                jul=mf["jul"],
                aug=mf["aug"],
                sep=mf["sep"],
                oct=mf["oct"],
                nov=mf["nov"],
                dec=mf["dec"],
                total=_fmt_num(total),
                source="if",
                status=st,  # type: ignore[arg-type]
            )
        )
    return out


def _map_waste_rows(items: list[Any], import_status: str | None) -> list[WasteRowVo]:
    bucket: dict[tuple[str, str, str, str, str], dict[int, float]] = defaultdict(_empty_months)
    for raw in items:
        if not isinstance(raw, dict):
            continue
        it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
        facility = _pick(it, "facility", "site_name", "시설명")
        wt = _pick(it, "waste_type", "waste_category", "폐기물종류", "waste")
        dm = _pick(it, "disposal_method", "treatment_method", "treatment_method", "처리방법")
        vendor = _pick(it, "vendor", "treatment_contractor", "contractor_name", "위탁업체")
        unit = _pick(it, "unit", "usage_unit", "단위") or "톤"
        month_slot = _resolve_bucket_month(it)
        val = _to_float(_pick(it, "generation_ton", "amount_ton", "quantity", "amount", "usage_amount"))
        bucket[(facility, wt, dm, vendor, unit)][month_slot] += val
    out: list[WasteRowVo] = []
    st = _status(import_status)
    for i, ((facility, wt, dm, vendor, unit), months) in enumerate(sorted(bucket.items()), start=1):
        mf = _month_fields(months)
        total = sum(months.values())
        out.append(
            WasteRowVo(
                id=i,
                facility=facility,
                waste_type=wt,
                disposal_method=dm,
                unit=unit,
                jan=mf["jan"],
                feb=mf["feb"],
                mar=mf["mar"],
                apr=mf["apr"],
                may=mf["may"],
                jun=mf["jun"],
                jul=mf["jul"],
                aug=mf["aug"],
                sep=mf["sep"],
                oct=mf["oct"],
                nov=mf["nov"],
                dec=mf["dec"],
                total=_fmt_num(total),
                vendor=vendor,
                status=st,  # type: ignore[arg-type]
            )
        )
    return out


def _map_pollution_rows(items: list[Any]) -> list[PollutionRowVo]:
    bucket: dict[tuple[str, str, str, str, float], dict[int, float]] = defaultdict(_empty_months)
    for raw in items:
        if not isinstance(raw, dict):
            continue
        it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
        facility = _pick(it, "facility", "site_name", "시설명")
        outlet = _pick(it, "outlet_name", "discharge_point", "배출구명", "outlet")
        month_slot = _resolve_bucket_month(it)
        # air/water 헤더 동시 지원
        candidates: list[tuple[str, str, Any, str]] = [
            ("NOx", "kg", it.get("nox_kg"), "regulatory_limit_nox"),
            ("SOx", "kg", it.get("sox_kg"), ""),
            ("Dust", "kg", it.get("dust_kg"), ""),
            ("CO", "kg", it.get("co_kg"), ""),
            ("BOD", "mg/L", it.get("bod_mg_l"), "regulatory_limit_bod"),
            ("COD", "mg/L", it.get("cod_mg_l"), ""),
            ("SS", "mg/L", it.get("ss_mg_l"), ""),
        ]
        emitted = False
        for pname, unit, raw_val, limit_key in candidates:
            val = _to_float(raw_val)
            if val == 0:
                continue
            limit = _to_float(it.get(limit_key)) if limit_key else 0.0
            bucket[(facility, outlet, pname, unit, limit)][month_slot] += val
            emitted = True
        if emitted:
            continue
        # fallback 구조형 데이터
        pollutant = _pick(it, "pollutant", "오염물질")
        if pollutant:
            unit = _pick(it, "unit", "단위") or "-"
            val = _to_float(_pick(it, "concentration", "measured_value", "value", "amount"))
            limit = _to_float(_pick(it, "legal_limit", "법적기준", "limit"))
            bucket[(facility, outlet, pollutant, unit, limit)][month_slot] += val
    out: list[PollutionRowVo] = []
    for i, ((facility, outlet, pollutant, unit, limit), months) in enumerate(sorted(bucket.items()), start=1):
        vals = [v for v in months.values() if v > 0]
        avg = (sum(vals) / len(vals)) if vals else 0.0
        st = "normal"
        if limit > 0 and avg > limit * 1.1:
            st = "exceed"
        elif limit > 0 and avg > limit:
            st = "warning"
        mf = _month_fields(months)
        out.append(
            PollutionRowVo(
                id=i,
                facility=facility,
                outlet_name=outlet,
                pollutant=pollutant,
                unit=unit,
                jan=mf["jan"],
                feb=mf["feb"],
                mar=mf["mar"],
                apr=mf["apr"],
                may=mf["may"],
                jun=mf["jun"],
                jul=mf["jul"],
                aug=mf["aug"],
                sep=mf["sep"],
                oct=mf["oct"],
                nov=mf["nov"],
                dec=mf["dec"],
                avg=_fmt_num(avg),
                legal_limit=_fmt_num(limit),
                status=st,  # type: ignore[arg-type]
            )
        )
    return out


def _map_chemical_rows(items: list[Any], import_status: str | None) -> list[ChemicalRowVo]:
    bucket: dict[tuple[str, str, str, str, str], dict[int, float]] = defaultdict(_empty_months)
    for raw in items:
        if not isinstance(raw, dict):
            continue
        it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
        facility = _pick(it, "facility", "site_name", "시설명")
        name = _pick(it, "chemical_name", "chem_name", "약품명")
        cas = _pick(it, "cas_no", "cas_number", "cas")
        hazard = _pick(it, "hazard_class", "유해물질_분류")
        unit = _pick(it, "unit", "usage_unit", "단위") or "kg"
        month_slot = _resolve_bucket_month(it)
        val = _to_float(_pick(it, "usage_amount_kg", "usage_kg", "usage_amount", "usage", "quantity", "amount"))
        bucket[(facility, name, cas, hazard, unit)][month_slot] += val
    out: list[ChemicalRowVo] = []
    st = _status(import_status)
    if st == "error":
        st = "draft"
    for i, ((facility, name, cas, hazard, unit), months) in enumerate(sorted(bucket.items()), start=1):
        mf = _month_fields(months)
        total = sum(months.values())
        out.append(
            ChemicalRowVo(
                id=i,
                facility=facility,
                chemical_name=name,
                cas_no=cas,
                unit=unit,
                jan=mf["jan"],
                feb=mf["feb"],
                mar=mf["mar"],
                apr=mf["apr"],
                may=mf["may"],
                jun=mf["jun"],
                jul=mf["jul"],
                aug=mf["aug"],
                sep=mf["sep"],
                oct=mf["oct"],
                nov=mf["nov"],
                dec=mf["dec"],
                total=_fmt_num(total),
                hazard_class=hazard,
                status=st,  # type: ignore[arg-type]
            )
        )
    return out


def _map_provider_rows(items: list[Any]) -> list[EnergyProviderRowVo]:
    out: list[EnergyProviderRowVo] = []
    for i, raw in enumerate(items, start=1):
        if not isinstance(raw, dict):
            continue
        it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
        st = (_pick(it, "status", "상태").lower() or "active")
        if st not in ("active", "expired", "pending"):
            st = "active"
        out.append(
            EnergyProviderRowVo(
                id=i,
                provider_name=_pick(it, "provider_name", "supplier_name", "supplier", "업체명"),
                energy_type=_pick(it, "energy_type", "에너지유형", "type"),
                contract_no=_pick(it, "contract_no", "contract_type", "계약번호"),
                supply_start=_pick(it, "supply_start", "contract_start", "공급시작", "start_date"),
                supply_end=_pick(it, "supply_end", "contract_end", "공급종료", "end_date"),
                renewable_ratio=_pick(it, "renewable_ratio", "재생비율") or "-",
                cert_no=_pick(it, "cert_no", "인증번호") or "-",
                status=st,  # type: ignore[arg-type]
            )
        )
    return out


def _map_consign_rows(items: list[Any]) -> list[ConsignmentRowVo]:
    out: list[ConsignmentRowVo] = []
    for i, raw in enumerate(items, start=1):
        if not isinstance(raw, dict):
            continue
        it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
        st = (_pick(it, "status", "상태").lower() or "active")
        if st not in ("active", "expired"):
            st = "active"
        out.append(
            ConsignmentRowVo(
                id=i,
                vendor_name=_pick(it, "vendor_name", "contractor_name", "업체명", "consignee"),
                biz_no=_pick(it, "biz_no", "business_no", "biz_number", "business_registration_number", "사업자번호"),
                waste_type=_pick(it, "waste_type", "폐기물종류"),
                permit_no=_pick(it, "permit_no", "license_number", "허가번호"),
                permit_expiry=_pick(it, "permit_expiry", "license_expiry", "허가만료"),
                contract_start=_pick(it, "contract_start", "계약시작"),
                contract_end=_pick(it, "contract_end", "계약종료"),
                status=st,  # type: ignore[arg-type]
            )
        )
    return out


def _reindex(rows: list[Any], model: type) -> list[Any]:
    out: list[Any] = []
    for i, row in enumerate(rows, start=1):
        payload = row.model_dump()
        payload["id"] = i
        out.append(model.model_validate(payload))
    return out


def _item_year_str(it: dict[str, Any]) -> str | None:
    y = _pick(it, "year", "연도", "yr")
    if y:
        return y.strip()
    for key in ("reporting_date", "기준일", "created_at", "synced_at", "updated_at"):
        raw = _pick(it, key)
        if not raw:
            continue
        head = raw.strip().replace("T", " ").split()[0]
        if len(head) >= 4 and head[:4].isdigit():
            return head[:4]
    return None


def _merge_worse_import_status(a: str, b: str) -> str:
    order = {"error": 3, "draft": 2, "confirmed": 1}
    return a if order.get(a, 0) >= order.get(b, 0) else b


def normalize_energy_unit_key(unit: str) -> str:
    """배출계수 매칭용 단위 키 (소문자)."""
    x = (unit or "").strip().lower().replace("³", "3").replace(" ", "").replace("·", "")
    if "nm" in x and "3" in x:
        return "nm3"
    if "mwh" in x:
        return "mwh"
    if "kwh" in x or x == "kw-h":
        return "kwh"
    if x in ("l", "liter", "litre", "ℓ"):
        return "l"
    if "gj" in x:
        return "gj"
    if "mj" in x:
        return "mj"
    if x in ("m3", "ton", "t", "㎥"):
        return x
    return x or "unknown"


def aggregate_energy_activity_by_month_for_year(
    snapshots: list[StagingRawRowSnapshot],
    year: str,
) -> tuple[dict[tuple[str, str, str], dict[int, float]], str]:
    """
    스테이징 energy 스냅샷에서 특정 연도 행만 모아
    (시설, 에너지유형, 정규화단위) 버킷별 월별 활동량을 합산합니다.
    반환: (버킷, 가장 보수적인 import_status 한 개 — confirmed < draft < error)
    """
    bucket: dict[tuple[str, str, str], dict[int, float]] = defaultdict(_empty_months)
    worst = "confirmed"
    want = year.strip()
    for snap in snapshots:
        cat = (snap.ghg_raw_category or "").strip().lower()
        if cat != "energy":
            continue
        items = snap.raw_data.get("items") if isinstance(snap.raw_data, dict) else None
        if not isinstance(items, list):
            continue
        st = _status(snap.import_status)
        for raw in items:
            if not isinstance(raw, dict):
                continue
            it = {str(k).lstrip("\ufeff").strip(): v for k, v in raw.items()}
            iy = _item_year_str(it)
            if iy is None or iy != want:
                continue
            facility = _pick(it, "facility", "site_name", "시설명") or "전사"
            et = _pick(it, "energy_type", "re_type", "에너지원", "에너지유형", "purewater_type", "usage_purpose")
            usage_unit = _pick(it, "usage_unit", "unit", "단위")
            m = _pick(it, "month", "월", "m")
            if m:
                month = int(_parse_month(m))
            else:
                md = _month_from_item_datetime_fields(it)
                if md is None:
                    continue
                month = md
            pw = _to_float(_pick(it, "purewater_m3", "pure_water_m3"))
            rw = _to_float(_pick(it, "raw_water_m3", "intake_water_m3"))
            std = _to_float(
                _pick(it, "usage_amount", "consumption_kwh", "generation_kwh", "usage_ton", "renewable_kwh")
            )
            if pw != 0.0:
                val = pw
                unit = usage_unit or "m3"
            elif rw != 0.0 and std == 0.0:
                val = rw
                unit = usage_unit or "m3"
            else:
                val = std
                unit = usage_unit or "kWh"
            if (not et) and val == 0:
                continue
            ukey = normalize_energy_unit_key(unit)
            key = (facility, et, ukey)
            bucket[key][month] += val
            worst = _merge_worse_import_status(worst, st)
    return dict(bucket), worst

"""SDS_ESG_DATA_REAL EMS_ENERGY_USAGE.csv에 Scope 1 활동(도시가스·경유) 행 추가 (데모용).

스테이징 재계산(ScopeCalculationOrchestratorV2)은 EMS의 energy_type·usage_amount·usage_unit을 사용합니다.
실행: 저장소 루트에서 python backend/scripts/seeds/patch_scope1_ems_energy_csv.py
"""
from __future__ import annotations

import csv
from pathlib import Path

_REPO = Path(__file__).resolve().parents[3]
_DATA = _REPO / "backend" / "SDS_ESG_DATA_REAL"


def _simple_append(
    rel: str,
    site_code: str,
    site_facility: str,
    company_id: str,
    company_name: str,
    gas_nm3: float,
    diesel_l: float,
) -> None:
    path = _DATA / rel
    if not path.is_file():
        print(f"[SKIP] 파일 없음: {rel}")
        return
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        fieldnames = r.fieldnames
        assert fieldnames
        rows = list(r)
    if any((row.get("energy_type") or "").startswith("도시가스") for row in rows):
        print(f"[SKIP] already patched: {rel}")
        return
    for m in range(1, 13):
        rows.append(
            {
                "site_code": site_code,
                "site_name": site_facility,
                "company_id": company_id,
                "company_name": company_name,
                "year": "2024",
                "month": str(m),
                "energy_type": "도시가스",
                "consumption_kwh": "0",
                "emission_factor": "",
                "emission_tco2e": "",
                "facility": site_facility,
                "usage_amount": str(gas_nm3),
                "usage_unit": "Nm³",
                "ghg_raw_category": "energy",
            }
        )
        rows.append(
            {
                "site_code": site_code,
                "site_name": site_facility,
                "company_id": company_id,
                "company_name": company_name,
                "year": "2024",
                "month": str(m),
                "energy_type": "경유(차량)",
                "consumption_kwh": "0",
                "emission_factor": "",
                "emission_tco2e": "",
                "facility": site_facility,
                "usage_amount": str(diesel_l),
                "usage_unit": "L",
                "ghg_raw_category": "energy",
            }
        )
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"[OK] {rel} (+24 rows)")


def _wide_row(
    record_id: str,
    site_code: str,
    site_name: str,
    site_type: str,
    month: int,
    energy_type: str,
    energy_source: str,
    usage_amount: float,
    usage_unit: str,
    meter_suffix: str,
    facility: str,
) -> dict[str, str]:
    ts = f"2024-{month:02d}-05 08:00:00"
    return {
        "record_id": record_id,
        "site_code": site_code,
        "site_name": site_name,
        "site_type": site_type,
        "year": "2024",
        "month": str(month),
        "energy_type": energy_type,
        "energy_source": energy_source,
        "usage_amount": str(usage_amount),
        "usage_unit": usage_unit,
        "renewable_kwh": "0",
        "renewable_ratio": "0.0",
        "pue_monthly": "",
        "it_load_kw": "",
        "cooling_power_kwh": "",
        "cost_krw": "0",
        "meter_id": meter_suffix,
        "data_quality": "M1",
        "source_system": "EMS",
        "synced_at": ts,
        "created_at": ts,
        "updated_at": "2024-03-10 10:00:00",
        "updated_by": "user_001",
        "non_renewable_kwh": "0.0",
        "grid_emission_factor_market": "",
        "grid_emission_factor_location": "",
        "energy_supplier_id": "SUP-GAS-001" if "가스" in energy_type else "SUP-FUEL-001",
        "rec_purchased_kwh": "0",
        "ppa_kwh": "0",
        "ghg_market_tco2e": "0",
        "ghg_location_tco2e": "0",
        "consumption_kwh": "0.0",
        "facility": facility,
        "ghg_raw_category": "energy",
    }


def _wide_append_multicampus() -> None:
    rel = "subsidiary_멀티캠퍼스 주식회사/EMS/EMS_ENERGY_USAGE.csv"
    path = _DATA / rel
    if not path.is_file():
        print(f"[SKIP] 파일 없음: {rel}")
        return
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        fieldnames = r.fieldnames
        rows = list(r)
    if any("도시가스" in (row.get("energy_type") or "") for row in rows):
        print(f"[SKIP] already patched: {rel}")
        return
    n = len(rows)
    for m in range(1, 13):
        rows.append(
            _wide_row(
                f"EMS-MC-01-2024-GAS-{m:02d}",
                "SITE-MC01",
                "멀티캠퍼스 역삼",
                "교육센터",
                m,
                "도시가스",
                "지역도시가스",
                3800.0 + (m % 3) * 120,
                "Nm³",
                f"MTR-SITE-MC01-GAS-{m:02d}",
                "멀티캠퍼스 역삼",
            )
        )
        rows.append(
            _wide_row(
                f"EMS-MC-02-2024-DSL-{m:02d}",
                "SITE-MC02",
                "멀티캠퍼스 선릉",
                "교육센터",
                m,
                "경유(차량)",
                "자가차량",
                420.0,
                "L",
                f"MTR-SITE-MC02-DSL-{m:02d}",
                "멀티캠퍼스 선릉",
            )
        )
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"[OK] {rel} (+24 rows, was {n})")


def _wide_append_openhands() -> None:
    rel = "subsidiary_오픈핸즈 주식회사/EMS/EMS_ENERGY_USAGE.csv"
    path = _DATA / rel
    if not path.is_file():
        print(f"[SKIP] 파일 없음: {rel}")
        return
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        fieldnames = r.fieldnames
        rows = list(r)
    if any("도시가스" in (row.get("energy_type") or "") for row in rows):
        print(f"[SKIP] already patched: {rel}")
        return
    n = len(rows)
    for m in range(1, 13):
        rows.append(
            _wide_row(
                f"EMS-OH-2024-GAS-{m:02d}",
                "SITE-OH01",
                "오픈핸즈 본사",
                "오피스",
                m,
                "도시가스",
                "지역도시가스",
                2100.0,
                "Nm³",
                f"MTR-SITE-OH01-GAS-{m:02d}",
                "오픈핸즈 본사",
            )
        )
        rows.append(
            _wide_row(
                f"EMS-OH-2024-DSL-{m:02d}",
                "SITE-OH01",
                "오픈핸즈 본사",
                "오피스",
                m,
                "경유(차량)",
                "법인차량",
                380.0,
                "L",
                f"MTR-SITE-OH01-DSL-{m:02d}",
                "오픈핸즈 본사",
            )
        )
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"[OK] {rel} (+24 rows, was {n})")


def _holding_short_extend() -> None:
    """holding_삼성에스디에스: 짧은 스키마 → facility/usage 컬럼 추가 후 연료 행 추가."""
    rel = "holding_삼성에스디에스/EMS/EMS_ENERGY_USAGE.csv"
    path = _DATA / rel
    if not path.is_file():
        print(f"[SKIP] 파일 없음(홀딩 폴더 미동기화 또는 미포함): {rel}")
        return
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        old_fn = r.fieldnames or []
        rows = list(r)
    if "facility" in old_fn and any((row.get("energy_type") or "") == "경유" for row in rows):
        print(f"[SKIP] already patched: {rel}")
        return
    new_fn = list(old_fn) + ["facility", "usage_amount", "usage_unit", "ghg_raw_category"]
    out: list[dict[str, str]] = []
    for row in rows:
        ck = row.get("consumption_kwh") or "0"
        sn = row.get("site_name") or "수원 데이터센터"
        row = dict(row)
        row["facility"] = sn
        row["usage_amount"] = ck
        row["usage_unit"] = "kWh"
        row["ghg_raw_category"] = "energy"
        out.append(row)
    cid = out[0].get("company_id", "")
    cname = out[0].get("company_name", "")
    for m in range(1, 13):
        out.append(
            {
                "site_code": "SITE-DC01",
                "site_name": "수원 데이터센터",
                "company_id": cid,
                "company_name": cname,
                "year": "2024",
                "month": str(m),
                "energy_type": "경유",
                "consumption_kwh": "0",
                "emission_factor": "",
                "emission_tco2e": "",
                "facility": "수원 데이터센터",
                "usage_amount": "1850",
                "usage_unit": "L",
                "ghg_raw_category": "energy",
            }
        )
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=new_fn, extrasaction="ignore")
        w.writeheader()
        w.writerows(out)
    print(f"[OK] {rel} (header extended +12 경유 비상발전)")


def _wide_row_holding31(
    record_id: str,
    month: int,
    energy_type: str,
    energy_source: str,
    usage_amount: float,
    usage_unit: str,
    meter_id: str,
) -> dict[str, str]:
    ts = f"2024-{month:02d}-06 10:00:00"
    return {
        "record_id": record_id,
        "site_code": "SITE-DC01",
        "site_name": "수원 데이터센터",
        "site_type": "데이터센터",
        "year": "2024",
        "month": str(month),
        "energy_type": energy_type,
        "energy_source": energy_source,
        "usage_amount": str(usage_amount),
        "usage_unit": usage_unit,
        "renewable_kwh": "0",
        "renewable_ratio": "0.0",
        "pue_monthly": "",
        "it_load_kw": "",
        "cooling_power_kwh": "",
        "cost_krw": "0",
        "meter_id": meter_id,
        "data_quality": "M1",
        "source_system": "EMS",
        "synced_at": ts,
        "created_at": ts,
        "updated_at": "2024-03-10 10:00:00",
        "updated_by": "user_001",
        "non_renewable_kwh": "0.0",
        "grid_emission_factor_market": "",
        "grid_emission_factor_location": "",
        "energy_supplier_id": "SUP-DC-GEN-001",
        "rec_purchased_kwh": "0",
        "ppa_kwh": "0",
        "ghg_market_tco2e": "0",
        "ghg_location_tco2e": "0",
    }


def _holding_wide_append() -> None:
    rel = "holding_삼성에스디에스 주식회사/EMS/EMS_ENERGY_USAGE.csv"
    path = _DATA / rel
    if not path.is_file():
        print(f"[SKIP] 파일 없음(홀딩 폴더 미동기화 또는 미포함): {rel}")
        return
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        fieldnames = r.fieldnames
        rows = list(r)
    if any(
        (row.get("record_id") or "").startswith("EMS-E-2024-DIESEL")
        for row in rows
    ):
        print(f"[SKIP] already patched: {rel}")
        return
    for m in range(1, 13):
        rows.append(
            _wide_row_holding31(
                f"EMS-E-2024-DIESEL-{m:02d}",
                m,
                "경유",
                "비상발전기",
                1650.0,
                "L",
                f"MTR-DC01-DSL-{m:02d}",
            )
        )
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"[OK] {rel} (+12 rows 비상발전 경유)")


def main() -> None:
    if not _DATA.is_dir():
        raise SystemExit(f"Missing {_DATA}")

    _simple_append(
        "subsidiary_시큐아이 주식회사/EMS/EMS_ENERGY_USAGE.csv",
        "SITE-SI01",
        "시큐아이 서울",
        "SUB-005",
        "시큐아이 주식회사",
        2650.0,
        580.0,
    )
    _simple_append(
        "subsidiary_에스코어 주식회사/EMS/EMS_ENERGY_USAGE.csv",
        "SITE-SC01",
        "에스코어 판교",
        "SUB-004",
        "에스코어 주식회사",
        5200.0,
        720.0,
    )
    _simple_append(
        "subsidiary_엠로 주식회사/EMS/EMS_ENERGY_USAGE.csv",
        "SITE-ML01",
        "엠로 본사",
        "SUB-002",
        "엠로 주식회사",
        1800.0,
        12400.0,
    )
    _simple_append(
        "subsidiary_미라콤아이앤씨 주식회사/EMS/EMS_ENERGY_USAGE.csv",
        "SITE-MI01",
        "미라콤 서울",
        "SUB-006",
        "미라콤아이앤씨 주식회사",
        2400.0,
        490.0,
    )

    _wide_append_multicampus()
    _wide_append_openhands()
    _holding_short_extend()
    _holding_wide_append()


if __name__ == "__main__":
    main()

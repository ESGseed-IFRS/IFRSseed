"""ghg_staging_extract 매핑·tab_type 추론 단위 테스트."""

from __future__ import annotations

import uuid

from backend.domain.v1.esg_data.hub.services.ghg_staging_extract import (
    infer_tab_type,
    map_staging_item_to_row,
)


def test_infer_fugitive_refrigerant() -> None:
    item = {
        "year": 2024,
        "month": 1,
        "site_name": "수원",
        "fuel_category": "탈루",
        "fuel_type": "HFC-410A",
        "consumption_amount": 100,
        "emission_factor_id": "EF-1",
    }
    assert infer_tab_type("ems", None, item) == "refrigerant"


def test_infer_scope12_fixed_fuel_vehicle() -> None:
    item = {
        "year": 2024,
        "fuel_category": "고정연소",
        "fuel_type": "LNG",
        "consumption_amount": 85000,
        "emission_factor_id": "EF-LNG",
        "total_tco2e": 120.5,
    }
    assert infer_tab_type("ems", None, item) == "fuel_vehicle"


def test_infer_scope3() -> None:
    item = {
        "year": 2024,
        "quarter": 1,
        "scope3_category": "Cat.1",
        "activity_data": 1000,
    }
    assert infer_tab_type("ems", None, item) == "scope3_activity"


def test_map_item_aliases_tco2e() -> None:
    cid = uuid.uuid4()
    item = {
        "year": 2024,
        "month": 2,
        "site_name": "본사",
        "record_id": "GHG-1",
        "fuel_type": "LNG",
        "consumption_amount": 10,
        "co2_tco2e": 1.1,
        "total_tco2e": 3.3,
    }
    m = map_staging_item_to_row(cid, "ems", item)
    assert m is not None
    assert m["tab_type"] == "fuel_vehicle"
    assert m["source_record_id"] == "GHG-1"
    assert m["ghg_co2_tco2e"] is not None
    assert m["ghg_total_tco2e"] is not None


def test_refrigerant_type_from_fuel_type() -> None:
    cid = uuid.uuid4()
    item = {
        "year": 2024,
        "month": 1,
        "site_name": "DC",
        "fuel_category": "탈루",
        "fuel_type": "HFC-410A",
        "consumption_amount": 10,
        "consumption_unit": "kg",
    }
    m = map_staging_item_to_row(
        cid,
        "ems",
        item,
        staging_row_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        staging_item_index=3,
    )
    assert m is not None
    assert m.get("refrigerant_type") == "HFC-410A"
    assert m.get("fuel_unit") == "kg"


def test_synthetic_source_record_id() -> None:
    cid = uuid.uuid4()
    item = {"year": 2024, "site_name": "S", "usage_amount": 1, "energy_type": "전력"}
    m = map_staging_item_to_row(
        cid,
        "ems",
        item,
        staging_row_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        staging_item_index=0,
    )
    assert m is not None
    assert m.get("source_record_id") == "stg:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:0"


def test_air_emission_fuel_copy() -> None:
    cid = uuid.uuid4()
    item = {
        "year": 2024,
        "quarter": 1,
        "site_name": "DC",
        "nox_kg": 1,
        "fuel_type": "경유",
    }
    m = map_staging_item_to_row(cid, "ehs", item)
    assert m is not None
    assert m["tab_type"] == "air_emissions"
    assert m.get("air_source_fuel_type") == "경유"

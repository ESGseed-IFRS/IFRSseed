"""environmental_aggregate_service 집계 단위 테스트."""

from __future__ import annotations

from decimal import Decimal

from backend.domain.v1.esg_data.hub.services.environmental_aggregate_service import (
    aggregate_activity_for_environmental,
    usage_amount_to_mwh,
)
from backend.domain.v1.esg_data.models.bases.ghg_activity_data import GhgActivityData


def test_usage_amount_to_mwh_kwh() -> None:
    assert usage_amount_to_mwh(Decimal("3000"), "kWh") == Decimal("3")


def test_aggregate_power_and_renewable() -> None:
    p = GhgActivityData()
    p.tab_type = "power_heat_steam"
    p.usage_amount = Decimal("1000")
    p.usage_unit = "kWh"
    p.renewable_kwh = Decimal("500")
    out = aggregate_activity_for_environmental([p])
    assert out["total_energy_consumption_mwh"] == Decimal("1")
    assert out["renewable_energy_mwh"] == Decimal("0.5")
    assert out["renewable_energy_ratio"] == Decimal("50")


def test_aggregate_waste_water_air() -> None:
    w = GhgActivityData()
    w.tab_type = "waste"
    w.generation_amount = Decimal("10")
    w.recycling_amount = Decimal("2")
    w.landfill_rate_pct = Decimal("40")
    w.hazardous_waste_yn = "Y"

    wa = GhgActivityData()
    wa.tab_type = "water_usage"
    wa.water_intake_ton = Decimal("100")
    wa.water_consumption_ton = Decimal("80")

    a = GhgActivityData()
    a.tab_type = "air_emissions"
    a.nox_kg = Decimal("1.5")
    a.sox_kg = Decimal("0.5")

    out = aggregate_activity_for_environmental([w, wa, a])
    assert out["total_waste_generated"] == Decimal("10")
    assert out["waste_recycled"] == Decimal("2")
    assert out["waste_landfilled"] == Decimal("4")
    assert out["hazardous_waste"] == Decimal("10")
    assert out["water_withdrawal"] == Decimal("100")
    assert out["water_consumption"] == Decimal("80")
    assert out["nox_emission"] == Decimal("1.5")
    assert out["sox_emission"] == Decimal("0.5")

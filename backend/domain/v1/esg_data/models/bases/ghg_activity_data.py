"""GHG 활동자료 ORM — `ghg_activity_data` (Alembic 035, 036)."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, Column, Date, DateTime, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.db import Base

_TAB_TYPES_SQL = (
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
)
_CHK = "tab_type IN (" + ", ".join(f"'{t}'" for t in _TAB_TYPES_SQL) + ")"


class GhgActivityData(Base):
    """단일 테이블 STI: tab_type별 희소 컬럼."""

    __tablename__ = "ghg_activity_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tab_type = Column(Text, nullable=False)
    site_name = Column(Text, nullable=False)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=True)

    energy_type = Column(Text, nullable=True)
    energy_source = Column(Text, nullable=True)
    usage_amount = Column(Numeric(18, 4), nullable=True)
    usage_unit = Column(Text, nullable=True)
    renewable_ratio = Column(Numeric(5, 2), nullable=True)

    fuel_category = Column(Text, nullable=True)
    fuel_type = Column(Text, nullable=True)
    consumption_amount = Column(Numeric(18, 4), nullable=True)
    fuel_unit = Column(Text, nullable=True)
    purchase_amount = Column(Numeric(18, 4), nullable=True)

    equipment_id = Column(Text, nullable=True)
    equipment_type = Column(Text, nullable=True)
    refrigerant_type = Column(Text, nullable=True)
    charge_amount_kg = Column(Numeric(18, 4), nullable=True)
    leak_amount_kg = Column(Numeric(18, 4), nullable=True)
    gwp_factor = Column(Numeric(18, 4), nullable=True)
    inspection_date = Column(Date, nullable=True)

    waste_type = Column(Text, nullable=True)
    waste_name = Column(Text, nullable=True)
    generation_amount = Column(Numeric(18, 4), nullable=True)
    disposal_method = Column(Text, nullable=True)
    incineration_amount = Column(Numeric(18, 4), nullable=True)
    recycling_amount = Column(Numeric(18, 4), nullable=True)

    category = Column(Text, nullable=True)
    transport_mode = Column(Text, nullable=True)
    origin_country = Column(Text, nullable=True)
    destination_country = Column(Text, nullable=True)
    distance_km = Column(Numeric(18, 4), nullable=True)
    weight_ton = Column(Numeric(18, 4), nullable=True)
    person_trips = Column(Integer, nullable=True)

    supplier_name = Column(Text, nullable=True)
    product_name = Column(Text, nullable=True)
    supplier_emission_tco2e = Column(Numeric(18, 4), nullable=True)
    use_phase_emission = Column(Numeric(18, 4), nullable=True)
    eol_emission = Column(Numeric(18, 4), nullable=True)
    ghg_reported_yn = Column(Text, nullable=True)

    data_quality = Column(Text, nullable=True)
    source_system = Column(Text, nullable=True)
    synced_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source_record_id = Column(Text, nullable=True)
    site_code = Column(Text, nullable=True)
    period_quarter = Column(Integer, nullable=True)

    renewable_kwh = Column(Numeric(18, 4), nullable=True)
    non_renewable_kwh = Column(Numeric(18, 4), nullable=True)
    pue_monthly = Column(Numeric(10, 4), nullable=True)
    it_load_kw = Column(Numeric(18, 4), nullable=True)
    cooling_power_kwh = Column(Numeric(18, 4), nullable=True)
    grid_emission_factor_market = Column(Numeric(18, 6), nullable=True)
    grid_emission_factor_location = Column(Numeric(18, 6), nullable=True)
    calculated_ghg_market_tco2e = Column(Numeric(18, 4), nullable=True)
    calculated_ghg_location_tco2e = Column(Numeric(18, 4), nullable=True)
    meter_id = Column(Text, nullable=True)

    ghg_accounting_basis = Column(Text, nullable=True)
    fuel_code = Column(Text, nullable=True)
    emission_factor_id = Column(Text, nullable=True)
    ghg_co2_tco2e = Column(Numeric(18, 4), nullable=True)
    ghg_ch4_tco2e = Column(Numeric(18, 4), nullable=True)
    ghg_n2o_tco2e = Column(Numeric(18, 4), nullable=True)
    ghg_hfcs_tco2e = Column(Numeric(18, 4), nullable=True)
    ghg_total_tco2e = Column(Numeric(18, 4), nullable=True)
    verification_body = Column(Text, nullable=True)
    verification_level = Column(Text, nullable=True)

    recycling_rate_pct = Column(Numeric(5, 2), nullable=True)
    landfill_rate_pct = Column(Numeric(5, 2), nullable=True)
    incineration_rate_pct = Column(Numeric(5, 2), nullable=True)
    hazardous_waste_yn = Column(Text, nullable=True)
    treatment_contractor = Column(Text, nullable=True)

    water_source = Column(Text, nullable=True)
    water_intake_ton = Column(Numeric(18, 4), nullable=True)
    water_discharge_ton = Column(Numeric(18, 4), nullable=True)
    water_reuse_ton = Column(Numeric(18, 4), nullable=True)
    water_consumption_ton = Column(Numeric(18, 4), nullable=True)
    water_reuse_rate_pct = Column(Numeric(5, 2), nullable=True)
    water_stress_area_yn = Column(Text, nullable=True)
    cooling_tower_makeup_ton = Column(Numeric(18, 4), nullable=True)
    water_blowdown_ton = Column(Numeric(18, 4), nullable=True)
    water_evaporation_site_ton = Column(Numeric(18, 4), nullable=True)
    wue_l_kwh = Column(Numeric(18, 6), nullable=True)
    water_discharge_destination = Column(Text, nullable=True)
    discharge_quality_compliant_yn = Column(Text, nullable=True)

    site_type_label = Column(Text, nullable=True)
    usage_purpose = Column(Text, nullable=True)
    intake_source = Column(Text, nullable=True)
    raw_water_m3 = Column(Numeric(18, 4), nullable=True)
    pure_water_m3 = Column(Numeric(18, 4), nullable=True)
    purewater_conversion_ratio = Column(Numeric(10, 6), nullable=True)
    return_water_m3 = Column(Numeric(18, 4), nullable=True)
    process_evaporation_m3 = Column(Numeric(18, 4), nullable=True)
    conductivity_us_cm = Column(Numeric(18, 6), nullable=True)
    resistivity_mohm_cm = Column(Numeric(18, 4), nullable=True)
    water_usage_cost_krw = Column(Numeric(18, 2), nullable=True)

    emission_source_description = Column(Text, nullable=True)
    air_source_fuel_type = Column(Text, nullable=True)
    operation_hours = Column(Numeric(18, 4), nullable=True)
    nox_kg = Column(Numeric(18, 4), nullable=True)
    sox_kg = Column(Numeric(18, 4), nullable=True)
    dust_kg = Column(Numeric(18, 4), nullable=True)
    co_kg = Column(Numeric(18, 4), nullable=True)
    voc_kg = Column(Numeric(18, 4), nullable=True)
    nox_conc_ppm = Column(Numeric(18, 4), nullable=True)
    sox_conc_ppm = Column(Numeric(18, 4), nullable=True)
    dust_conc_mg_m3 = Column(Numeric(18, 4), nullable=True)
    regulatory_limit_nox = Column(Numeric(18, 4), nullable=True)
    air_compliance_status = Column(Text, nullable=True)
    air_measurement_method = Column(Text, nullable=True)
    measurement_agency = Column(Text, nullable=True)

    re_type = Column(Text, nullable=True)
    re_source = Column(Text, nullable=True)
    re_generation_kwh = Column(Numeric(18, 4), nullable=True)
    re_consumption_kwh = Column(Numeric(18, 4), nullable=True)
    certificate_type = Column(Text, nullable=True)
    certificate_volume_rec = Column(Numeric(18, 4), nullable=True)
    certificate_cost_krw = Column(Numeric(18, 2), nullable=True)
    re_co2_reduction_tco2e = Column(Numeric(18, 4), nullable=True)
    grid_displacement_factor = Column(Numeric(18, 6), nullable=True)

    scope3_category = Column(Text, nullable=True)
    scope3_category_name = Column(Text, nullable=True)
    scope3_subcategory = Column(Text, nullable=True)
    scope3_calculation_method = Column(Text, nullable=True)
    scope3_activity_amount = Column(Numeric(18, 4), nullable=True)
    scope3_activity_unit = Column(Text, nullable=True)
    scope3_emission_factor = Column(Numeric(18, 6), nullable=True)
    scope3_ef_unit = Column(Text, nullable=True)
    scope3_ef_source = Column(Text, nullable=True)
    scope3_ghg_emission_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_boundary = Column(Text, nullable=True)
    scope3_source_file = Column(Text, nullable=True)
    scope3_notes = Column(Text, nullable=True)

    __table_args__ = (CheckConstraint(_CHK, name="chk_ghg_activity_data_tab_type"),)

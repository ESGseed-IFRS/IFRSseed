"""ghg_activity_data 확장: SDS_ESG_DATA(용수·순수·대기·재생에너지·Scope3·DC PUE 등) 대응 컬럼 및 tab_type.

Revision ID: 036_ghg_act_sds_cols (≤32자 — alembic_version.version_num VARCHAR(32))
Revises: 035_ghg_activity_data
Create Date: 2026-04-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "036_ghg_act_sds_cols"
down_revision = "035_ghg_activity_data"
branch_labels = None
depends_on = None

_TAB_TYPES = (
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
_CHK_TAB = "tab_type IN (" + ", ".join(f"'{t}'" for t in _TAB_TYPES) + ")"


def upgrade() -> None:
    op.drop_constraint(
        "chk_ghg_activity_data_tab_type",
        "ghg_activity_data",
        type_="check",
    )

    # 공통·계보
    op.add_column("ghg_activity_data", sa.Column("source_record_id", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("site_code", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("period_quarter", sa.Integer(), nullable=True))

    # power_heat_steam / EMS_ENERGY_USAGE, EMS_DC_PUE_MONTHLY
    op.add_column("ghg_activity_data", sa.Column("renewable_kwh", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("non_renewable_kwh", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("pue_monthly", sa.Numeric(10, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("it_load_kw", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("cooling_power_kwh", sa.Numeric(18, 4), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("grid_emission_factor_market", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "ghg_activity_data",
        sa.Column("grid_emission_factor_location", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "ghg_activity_data",
        sa.Column("calculated_ghg_market_tco2e", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column(
        "ghg_activity_data",
        sa.Column("calculated_ghg_location_tco2e", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("meter_id", sa.Text(), nullable=True))

    # GHG_SCOPE12_SUMMARY (연료·탈루 등 산정 결과/요약)
    op.add_column("ghg_activity_data", sa.Column("ghg_accounting_basis", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("fuel_code", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("emission_factor_id", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("ghg_co2_tco2e", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("ghg_ch4_tco2e", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("ghg_n2o_tco2e", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("ghg_hfcs_tco2e", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("ghg_total_tco2e", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("verification_body", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("verification_level", sa.Text(), nullable=True))

    # waste / ENV_WASTE_DETAIL
    op.add_column("ghg_activity_data", sa.Column("recycling_rate_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("landfill_rate_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("incineration_rate_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("hazardous_waste_yn", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("treatment_contractor", sa.Text(), nullable=True))

    # water_usage / ENV_WATER_DETAIL
    op.add_column("ghg_activity_data", sa.Column("water_source", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_intake_ton", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_discharge_ton", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_reuse_ton", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_consumption_ton", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_reuse_rate_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_stress_area_yn", sa.Text(), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("cooling_tower_makeup_ton", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("water_blowdown_ton", sa.Numeric(18, 4), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("water_evaporation_site_ton", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("wue_l_kwh", sa.Numeric(18, 6), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("water_discharge_destination", sa.Text(), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("discharge_quality_compliant_yn", sa.Text(), nullable=True),
    )

    # pure_water / EMS_PUREWATER_USAGE
    op.add_column("ghg_activity_data", sa.Column("site_type_label", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("usage_purpose", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("intake_source", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("raw_water_m3", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("pure_water_m3", sa.Numeric(18, 4), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("purewater_conversion_ratio", sa.Numeric(10, 6), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("return_water_m3", sa.Numeric(18, 4), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("process_evaporation_m3", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column(
        "ghg_activity_data",
        sa.Column("conductivity_us_cm", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "ghg_activity_data",
        sa.Column("resistivity_mohm_cm", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("water_usage_cost_krw", sa.Numeric(18, 2), nullable=True))

    # air_emissions / EHS_AIR_EMISSION
    op.add_column(
        "ghg_activity_data",
        sa.Column("emission_source_description", sa.Text(), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("air_source_fuel_type", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("operation_hours", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("nox_kg", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("sox_kg", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("dust_kg", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("co_kg", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("voc_kg", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("nox_conc_ppm", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("sox_conc_ppm", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("dust_conc_mg_m3", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("regulatory_limit_nox", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("air_compliance_status", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("air_measurement_method", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("measurement_agency", sa.Text(), nullable=True))

    # renewable_energy / EMS_RENEWABLE_ENERGY
    op.add_column("ghg_activity_data", sa.Column("re_type", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("re_source", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("re_generation_kwh", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("re_consumption_kwh", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("certificate_type", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("certificate_volume_rec", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("certificate_cost_krw", sa.Numeric(18, 2), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("re_co2_reduction_tco2e", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column(
        "ghg_activity_data",
        sa.Column("grid_displacement_factor", sa.Numeric(18, 6), nullable=True),
    )

    # scope3_activity / GHG_SCOPE3_DETAIL
    op.add_column("ghg_activity_data", sa.Column("scope3_category", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_category_name", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_subcategory", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_calculation_method", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_activity_amount", sa.Numeric(18, 4), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_activity_unit", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_emission_factor", sa.Numeric(18, 6), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_ef_unit", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_ef_source", sa.Text(), nullable=True))
    op.add_column(
        "ghg_activity_data",
        sa.Column("scope3_ghg_emission_tco2e", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column("ghg_activity_data", sa.Column("scope3_boundary", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_source_file", sa.Text(), nullable=True))
    op.add_column("ghg_activity_data", sa.Column("scope3_notes", sa.Text(), nullable=True))

    op.create_check_constraint(
        "chk_ghg_activity_data_tab_type",
        "ghg_activity_data",
        _CHK_TAB,
    )

    op.create_index(
        "idx_ghg_activity_source_rec",
        "ghg_activity_data",
        ["company_id", "source_system", "source_record_id"],
        unique=False,
        postgresql_where=sa.text("source_record_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_ghg_activity_source_rec", table_name="ghg_activity_data")
    op.drop_constraint(
        "chk_ghg_activity_data_tab_type",
        "ghg_activity_data",
        type_="check",
    )

    cols = [
        "scope3_notes",
        "scope3_source_file",
        "scope3_boundary",
        "scope3_ghg_emission_tco2e",
        "scope3_ef_source",
        "scope3_ef_unit",
        "scope3_emission_factor",
        "scope3_activity_unit",
        "scope3_activity_amount",
        "scope3_calculation_method",
        "scope3_subcategory",
        "scope3_category_name",
        "scope3_category",
        "grid_displacement_factor",
        "re_co2_reduction_tco2e",
        "certificate_cost_krw",
        "certificate_volume_rec",
        "certificate_type",
        "re_consumption_kwh",
        "re_generation_kwh",
        "re_source",
        "re_type",
        "measurement_agency",
        "air_measurement_method",
        "air_compliance_status",
        "regulatory_limit_nox",
        "dust_conc_mg_m3",
        "sox_conc_ppm",
        "nox_conc_ppm",
        "voc_kg",
        "co_kg",
        "dust_kg",
        "sox_kg",
        "nox_kg",
        "operation_hours",
        "air_source_fuel_type",
        "emission_source_description",
        "water_usage_cost_krw",
        "resistivity_mohm_cm",
        "conductivity_us_cm",
        "process_evaporation_m3",
        "return_water_m3",
        "purewater_conversion_ratio",
        "pure_water_m3",
        "raw_water_m3",
        "intake_source",
        "usage_purpose",
        "site_type_label",
        "discharge_quality_compliant_yn",
        "water_discharge_destination",
        "wue_l_kwh",
        "water_evaporation_site_ton",
        "water_blowdown_ton",
        "cooling_tower_makeup_ton",
        "water_stress_area_yn",
        "water_reuse_rate_pct",
        "water_consumption_ton",
        "water_reuse_ton",
        "water_discharge_ton",
        "water_intake_ton",
        "water_source",
        "treatment_contractor",
        "hazardous_waste_yn",
        "incineration_rate_pct",
        "landfill_rate_pct",
        "recycling_rate_pct",
        "verification_level",
        "verification_body",
        "ghg_total_tco2e",
        "ghg_hfcs_tco2e",
        "ghg_n2o_tco2e",
        "ghg_ch4_tco2e",
        "ghg_co2_tco2e",
        "emission_factor_id",
        "fuel_code",
        "ghg_accounting_basis",
        "meter_id",
        "calculated_ghg_location_tco2e",
        "calculated_ghg_market_tco2e",
        "grid_emission_factor_location",
        "grid_emission_factor_market",
        "cooling_power_kwh",
        "it_load_kw",
        "pue_monthly",
        "non_renewable_kwh",
        "renewable_kwh",
        "period_quarter",
        "site_code",
        "source_record_id",
    ]
    for c in cols:
        op.drop_column("ghg_activity_data", c)

    _CHK_TAB_OLD = "tab_type IN (" + ", ".join(
        f"'{t}'"
        for t in (
            "power_heat_steam",
            "fuel_vehicle",
            "refrigerant",
            "waste",
            "logistics_travel",
            "raw_materials",
        )
    ) + ")"
    op.create_check_constraint(
        "chk_ghg_activity_data_tab_type",
        "ghg_activity_data",
        _CHK_TAB_OLD,
    )

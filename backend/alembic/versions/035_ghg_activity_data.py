"""GHG 활동자료 원시 테이블 ghg_activity_data 생성.

Revision ID: 035_ghg_activity_data
Revises: 034_social_data_natural_key
Create Date: 2026-04-02

스키마는 DATABASE_TABLES_STRUCTURE.md §1.1 `ghg_activity_data` 를 따릅니다.
tab_type별로 희소 컬럼을 두는 단일 테이블(와이드) 패턴입니다.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "035_ghg_activity_data"
down_revision = "034_social_data_natural_key"
branch_labels = None
depends_on = None


_TAB_TYPES = (
    "power_heat_steam",
    "fuel_vehicle",
    "refrigerant",
    "waste",
    "logistics_travel",
    "raw_materials",
)
_CHK_TAB = "tab_type IN (" + ", ".join(f"'{t}'" for t in _TAB_TYPES) + ")"


def upgrade() -> None:
    op.create_table(
        "ghg_activity_data",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tab_type", sa.Text(), nullable=False),
        sa.Column("site_name", sa.Text(), nullable=False),
        sa.Column("period_year", sa.Integer(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=True),
        # power_heat_steam
        sa.Column("energy_type", sa.Text(), nullable=True),
        sa.Column("energy_source", sa.Text(), nullable=True),
        sa.Column("usage_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("usage_unit", sa.Text(), nullable=True),
        sa.Column("renewable_ratio", sa.Numeric(5, 2), nullable=True),
        # fuel_vehicle
        sa.Column("fuel_category", sa.Text(), nullable=True),
        sa.Column("fuel_type", sa.Text(), nullable=True),
        sa.Column("consumption_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("fuel_unit", sa.Text(), nullable=True),
        sa.Column("purchase_amount", sa.Numeric(18, 4), nullable=True),
        # refrigerant
        sa.Column("equipment_id", sa.Text(), nullable=True),
        sa.Column("equipment_type", sa.Text(), nullable=True),
        sa.Column("refrigerant_type", sa.Text(), nullable=True),
        sa.Column("charge_amount_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("leak_amount_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("gwp_factor", sa.Numeric(18, 4), nullable=True),
        sa.Column("inspection_date", sa.Date(), nullable=True),
        # waste
        sa.Column("waste_type", sa.Text(), nullable=True),
        sa.Column("waste_name", sa.Text(), nullable=True),
        sa.Column("generation_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("disposal_method", sa.Text(), nullable=True),
        sa.Column("incineration_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("recycling_amount", sa.Numeric(18, 4), nullable=True),
        # logistics_travel
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("transport_mode", sa.Text(), nullable=True),
        sa.Column("origin_country", sa.Text(), nullable=True),
        sa.Column("destination_country", sa.Text(), nullable=True),
        sa.Column("distance_km", sa.Numeric(18, 4), nullable=True),
        sa.Column("weight_ton", sa.Numeric(18, 4), nullable=True),
        sa.Column("person_trips", sa.Integer(), nullable=True),
        # raw_materials
        sa.Column("supplier_name", sa.Text(), nullable=True),
        sa.Column("product_name", sa.Text(), nullable=True),
        sa.Column("supplier_emission_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("use_phase_emission", sa.Numeric(18, 4), nullable=True),
        sa.Column("eol_emission", sa.Numeric(18, 4), nullable=True),
        sa.Column("ghg_reported_yn", sa.Text(), nullable=True),
        # 메타
        sa.Column("data_quality", sa.Text(), nullable=True),
        sa.Column("source_system", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name="fk_ghg_activity_data_company_id"),
        sa.CheckConstraint(_CHK_TAB, name="chk_ghg_activity_data_tab_type"),
    )
    op.create_index(
        "idx_ghg_activity_company",
        "ghg_activity_data",
        ["company_id", "period_year", "period_month"],
        unique=False,
    )
    op.create_index(
        "idx_ghg_activity_tab",
        "ghg_activity_data",
        ["company_id", "tab_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_ghg_activity_tab", table_name="ghg_activity_data")
    op.drop_index("idx_ghg_activity_company", table_name="ghg_activity_data")
    op.drop_table("ghg_activity_data")

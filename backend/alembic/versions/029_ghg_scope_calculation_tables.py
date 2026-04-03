"""GHG 배출계수 마스터 및 산정 결과(ghg_emission_results) 저장.

Revision ID: 029_ghg_scope_calculation_tables
Revises: 028_ghg_anomaly_scan_results
Create Date: 2026-04-01

산정 결과는 DATABASE_TABLES_STRUCTURE.md 의 ghg_emission_results 를 따릅니다.
월별·라인 UI 복원용 JSONB(monthly_scope_breakdown, scope_line_items)는 보조 컬럼입니다.
basis(location/market) 구분은 calculation_basis 로 저장합니다.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "029_ghg_scope_calculation_tables"
down_revision = "028_ghg_anomaly_scan_results"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ghg_emission_factors",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("fuel_type", sa.Text(), nullable=False),
        sa.Column("sub_category", sa.Text(), nullable=True),
        sa.Column("source_unit", sa.Text(), nullable=False),
        sa.Column("composite_factor", sa.Numeric(24, 12), nullable=False),
        sa.Column("year_applicable", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("version", sa.Text(), nullable=False, server_default="v1.0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "category",
            "fuel_type",
            "sub_category",
            "source_unit",
            "year_applicable",
            "version",
            name="uq_ghg_emission_factors_natural",
        ),
    )
    op.create_index("ix_ghg_ef_year_active", "ghg_emission_factors", ["year_applicable", "is_active"])

    op.create_table(
        "ghg_emission_results",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_year", sa.Integer(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=True),
        sa.Column("scope1_total_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope1_fixed_combustion_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope1_mobile_combustion_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope1_fugitive_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope1_incineration_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope2_location_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope2_market_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope2_renewable_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_total_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_1_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_4_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_6_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_7_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_9_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_11_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("scope3_category_12_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("total_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("applied_framework", sa.Text(), nullable=True),
        sa.Column("calculation_version", sa.Text(), nullable=True),
        sa.Column("data_quality_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("data_quality_level", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("calculation_basis", sa.Text(), nullable=False, server_default="location"),
        sa.Column("monthly_scope_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("scope_line_items", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("emission_factor_bundle_version", sa.Text(), nullable=True),
        sa.Column("verification_status", sa.Text(), nullable=True, server_default="draft"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ghg_results_company", "ghg_emission_results", ["company_id", "period_year"])
    op.create_index(
        "idx_ghg_results_framework",
        "ghg_emission_results",
        ["company_id", "applied_framework"],
    )
    op.create_index(
        "uq_ghg_emission_results_company_year_basis",
        "ghg_emission_results",
        ["company_id", "period_year", "calculation_basis"],
        unique=True,
        postgresql_where=sa.text("period_month IS NULL"),
    )

    op.execute(
        """
        INSERT INTO ghg_emission_factors
          (category, fuel_type, sub_category, source_unit, composite_factor, year_applicable, source, version, is_active)
        VALUES
          ('scope1_fixed', 'LNG', '', 'Nm3', 0.002179, '2024', '환경부 고시(예시)', 'v1.0', true),
          ('scope1_fixed', 'Diesel', '', 'L', 0.00268, '2024', 'IPCC/고시(예시)', 'v1.0', true),
          ('scope1_fixed', 'Gasoline', '', 'L', 0.00231, '2024', 'IPCC/고시(예시)', 'v1.0', true),
          ('scope1_fixed', 'LPG', '', 'L', 0.00166, '2024', 'IPCC/고시(예시)', 'v1.0', true),
          ('scope1_fixed', 'Kerosene', '', 'L', 0.00252, '2024', 'IPCC/고시(예시)', 'v1.0', true),
          ('scope1_fixed', 'HeavyOil', '', 'L', 0.00277, '2024', 'IPCC/고시(예시)', 'v1.0', true),
          ('scope1_mobile', 'Diesel', '', 'L', 0.00262, '2024', '이동연소(예시)', 'v1.0', true),
          ('scope1_mobile', 'Gasoline', '', 'L', 0.00210, '2024', '이동연소(예시)', 'v1.0', true),
          ('scope1_mobile', 'LPG', '', 'L', 0.00182, '2024', '이동연소(예시)', 'v1.0', true),
          ('scope2_electricity', 'Grid', '', 'kWh', 0.0004267, '2024', '국가 전력계수(예시)', 'v1.0', true),
          ('scope2_electricity', 'Grid', '', 'MWh', 0.4267, '2024', '국가 전력계수(예시)', 'v1.0', true),
          ('scope2_steam', 'Steam', '', 'MJ', 0.000056, '2024', '스팀·열(예시)', 'v1.0', true)
        ON CONFLICT ON CONSTRAINT uq_ghg_emission_factors_natural DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("uq_ghg_emission_results_company_year_basis", table_name="ghg_emission_results")
    op.drop_index("idx_ghg_results_framework", table_name="ghg_emission_results")
    op.drop_index("idx_ghg_results_company", table_name="ghg_emission_results")
    op.drop_table("ghg_emission_results")
    op.drop_index("ix_ghg_ef_year_active", table_name="ghg_emission_factors")
    op.drop_table("ghg_emission_factors")

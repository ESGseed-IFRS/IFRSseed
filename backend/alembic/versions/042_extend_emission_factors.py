"""배출계수 테이블 확장 - 열량계수, GHG 가스별 분리, GWP 지원.

Revision ID: 042_extend_emission_factors
Revises: 041_governance_disc_cols
Create Date: 2026-04-09

Excel 배출계수 마스터(GHG_배출계수_마스터_v2.xlsx) 구조를 반영하여
emission_factors 테이블을 확장합니다.

주요 변경사항:
1. 열량 변환 계수 추가 (heat_content_coefficient, net_calorific_value)
2. GHG 가스별 배출계수 분리 (co2_factor, ch4_factor, n2o_factor)
3. GWP 기준 및 값 추가 (gwp_basis, ch4_gwp, n2o_gwp)
4. 복합 배출계수 및 단위 추가 (composite_factor, composite_factor_unit)
5. 원천 단위 및 연료 타입 추가 (source_unit, fuel_type)
6. 버전 및 메모 추가 (version, notes)

참조: backend/domain/v1/ghg_calculation/docs/GHG_ANOMALY_VALIDATION_IMPLEMENTATION.md
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "042_extend_emission_factors"
down_revision = "041_governance_disc_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. 열량 변환 계수 컬럼 추가
    op.add_column(
        "emission_factors",
        sa.Column("heat_content_coefficient", sa.Numeric(18, 8), nullable=True,
                  comment="열량계수 (예: 0.0388 TJ/천Nm³)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("heat_content_unit", sa.Text(), nullable=True,
                  comment="열량계수 단위 (예: TJ/천Nm³)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("net_calorific_value", sa.Numeric(18, 4), nullable=True,
                  comment="순발열량 (MJ/kg 또는 MJ/Nm³)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("ncv_unit", sa.Text(), nullable=True,
                  comment="순발열량 단위 (예: MJ/kg, MJ/Nm³)")
    )
    
    # 2. GHG 가스별 배출계수 분리
    op.add_column(
        "emission_factors",
        sa.Column("co2_factor", sa.Numeric(18, 6), nullable=True,
                  comment="CO₂ 배출계수 (tCO₂/TJ)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("ch4_factor", sa.Numeric(18, 6), nullable=True,
                  comment="CH₄ 배출계수 (tCH₄/TJ)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("n2o_factor", sa.Numeric(18, 6), nullable=True,
                  comment="N₂O 배출계수 (tN₂O/TJ)")
    )
    
    # 3. 복합 배출계수 및 단위
    op.add_column(
        "emission_factors",
        sa.Column("composite_factor", sa.Numeric(18, 6), nullable=True,
                  comment="복합 배출계수 (tCO₂eq/TJ) = CO₂ + CH₄×GWP + N₂O×GWP")
    )
    op.add_column(
        "emission_factors",
        sa.Column("composite_factor_unit", sa.Text(), nullable=True,
                  comment="복합 배출계수 단위 (예: tCO₂eq/TJ)")
    )
    
    # 4. GWP 기준 및 값
    op.add_column(
        "emission_factors",
        sa.Column("gwp_basis", sa.Text(), nullable=True, server_default="AR5",
                  comment="GWP 기준 (AR5 | AR6)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("ch4_gwp", sa.Numeric(10, 2), nullable=True, server_default="28",
                  comment="CH₄ GWP (AR5: 28, AR6: 29.8)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("n2o_gwp", sa.Numeric(10, 2), nullable=True, server_default="265",
                  comment="N₂O GWP (AR5: 265, AR6: 273)")
    )
    
    # 5. 원천 단위 및 연료 타입
    op.add_column(
        "emission_factors",
        sa.Column("source_unit", sa.Text(), nullable=True,
                  comment="사용자 입력 단위 (예: 천Nm³, 천L, kWh)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("fuel_type", sa.Text(), nullable=True,
                  comment="연료 타입 (lng, diesel, electricity 등)")
    )
    
    # 6. 버전 및 메모
    op.add_column(
        "emission_factors",
        sa.Column("version", sa.Text(), nullable=True, server_default="v1.0",
                  comment="배출계수 버전 (v1.0, v2.0 등)")
    )
    op.add_column(
        "emission_factors",
        sa.Column("notes", sa.Text(), nullable=True,
                  comment="실무 산정 메모")
    )
    
    # 7. 인덱스 추가
    op.create_index(
        "idx_emission_factors_fuel_type",
        "emission_factors",
        ["fuel_type"],
        unique=False,
    )
    op.create_index(
        "idx_emission_factors_year",
        "emission_factors",
        ["reference_year"],
        unique=False,
    )
    op.create_index(
        "idx_emission_factors_active_dates",
        "emission_factors",
        ["is_active", "effective_from", "effective_to"],
        unique=False,
    )
    
    # 8. 기존 데이터 마이그레이션 (emission_factor → composite_factor)
    op.execute("""
        UPDATE emission_factors 
        SET composite_factor = emission_factor,
            composite_factor_unit = 'tCO₂eq/' || COALESCE(unit, 'TJ')
        WHERE emission_factor IS NOT NULL
    """)


def downgrade() -> None:
    # 인덱스 제거
    op.drop_index("idx_emission_factors_active_dates", table_name="emission_factors")
    op.drop_index("idx_emission_factors_year", table_name="emission_factors")
    op.drop_index("idx_emission_factors_fuel_type", table_name="emission_factors")
    
    # 컬럼 제거 (역순)
    op.drop_column("emission_factors", "notes")
    op.drop_column("emission_factors", "version")
    op.drop_column("emission_factors", "fuel_type")
    op.drop_column("emission_factors", "source_unit")
    op.drop_column("emission_factors", "n2o_gwp")
    op.drop_column("emission_factors", "ch4_gwp")
    op.drop_column("emission_factors", "gwp_basis")
    op.drop_column("emission_factors", "composite_factor_unit")
    op.drop_column("emission_factors", "composite_factor")
    op.drop_column("emission_factors", "n2o_factor")
    op.drop_column("emission_factors", "ch4_factor")
    op.drop_column("emission_factors", "co2_factor")
    op.drop_column("emission_factors", "ncv_unit")
    op.drop_column("emission_factors", "net_calorific_value")
    op.drop_column("emission_factors", "heat_content_unit")
    op.drop_column("emission_factors", "heat_content_coefficient")

"""MDG 스타일 배출계수(emission_factors) 및 산정 근거(ghg_calculation_evidence).

Revision ID: 030_emission_factors_evidence (≤32자 — alembic_version.version_num 제한)
Revises: 029_ghg_scope_calculation_tables
Create Date: 2026-04-01

스키마는 backend/domain/v1/ifrs_agent/docs/DATABASE_TABLES_STRUCTURE.md
§ ghg_emission_factors(문서) / ghg_calculation_evidence 를 따릅니다.

- 운영 산정용 ghg_emission_factors(029)와 별도로, 문서의 factor_code 기반 마스터는
  테이블명 emission_factors 로 둡니다.
- ghg_activity_data 가 아직 스키마에 없으므로 activity_data_id 에는 FK를 두지 않습니다.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "030_emission_factors_evidence"
down_revision = "029_ghg_scope_calculation_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "emission_factors",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("factor_code", sa.Text(), nullable=False),
        sa.Column("factor_name_ko", sa.Text(), nullable=False),
        sa.Column("factor_name_en", sa.Text(), nullable=True),
        sa.Column("emission_factor", sa.Numeric(18, 6), nullable=True),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("applicable_scope", sa.Text(), nullable=True),
        sa.Column("applicable_category", sa.Text(), nullable=True),
        sa.Column("reference_year", sa.Integer(), nullable=True),
        sa.Column("reference_source", sa.Text(), nullable=True),
        sa.Column("reference_url", sa.Text(), nullable=True),
        sa.Column("gwp_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("factor_code", name="uq_emission_factors_factor_code"),
    )
    op.create_index(
        "idx_emission_factors_scope",
        "emission_factors",
        ["applicable_scope", "applicable_category"],
        unique=False,
    )

    op.create_table(
        "ghg_calculation_evidence",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_data_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tab_type", sa.Text(), nullable=False),
        sa.Column("applied_factor_id", sa.Text(), nullable=True),
        sa.Column("applied_factor_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("applied_factor_version", sa.Text(), nullable=True),
        sa.Column("applied_gwp_basis", sa.Text(), nullable=True),
        sa.Column("calculation_method", sa.Text(), nullable=True),
        sa.Column("calculation_formula", sa.Text(), nullable=True),
        sa.Column("activity_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("activity_unit", sa.Text(), nullable=True),
        sa.Column("ghg_emission_tco2e", sa.Numeric(18, 4), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("calculated_by", sa.Text(), nullable=False),
        sa.Column("calculation_version", sa.Text(), nullable=True),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("previous_evidence_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scope_type", sa.Text(), nullable=True),
        sa.Column("scope_category", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name="fk_ghg_calc_evidence_company_id",
        ),
        sa.ForeignKeyConstraint(
            ["previous_evidence_id"],
            ["ghg_calculation_evidence.id"],
            name="fk_ghg_calc_evidence_previous_id",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "idx_ghg_calc_evidence_activity",
        "ghg_calculation_evidence",
        ["activity_data_id"],
        unique=False,
    )
    op.create_index(
        "idx_ghg_calc_evidence_company",
        "ghg_calculation_evidence",
        ["company_id", "calculated_at"],
        unique=False,
    )
    op.create_index(
        "idx_ghg_calc_evidence_latest",
        "ghg_calculation_evidence",
        ["company_id", "activity_data_id", "is_latest"],
        unique=False,
    )
    op.create_index(
        "idx_ghg_calc_evidence_factor",
        "ghg_calculation_evidence",
        ["applied_factor_id"],
        unique=False,
    )
    op.create_index(
        "idx_ghg_calc_evidence_scope",
        "ghg_calculation_evidence",
        ["company_id", "scope_type", "scope_category"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_ghg_calc_evidence_scope", table_name="ghg_calculation_evidence")
    op.drop_index("idx_ghg_calc_evidence_factor", table_name="ghg_calculation_evidence")
    op.drop_index("idx_ghg_calc_evidence_latest", table_name="ghg_calculation_evidence")
    op.drop_index("idx_ghg_calc_evidence_company", table_name="ghg_calculation_evidence")
    op.drop_index("idx_ghg_calc_evidence_activity", table_name="ghg_calculation_evidence")
    op.drop_table("ghg_calculation_evidence")
    op.drop_index("idx_emission_factors_scope", table_name="emission_factors")
    op.drop_table("emission_factors")

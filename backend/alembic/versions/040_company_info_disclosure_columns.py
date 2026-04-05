"""company_info: 지배구조·재무·ESG 메타 컬럼 확장 (DART/보고서 정합)

Revision ID: 040_company_info_disclosure_cols
Revises: 039_ingest_state_list_source
Create Date: 2026-04-05

- 이사회·위원회·CFO/CSO
- 결산·상장·재무 규모
- 본사 주소/도시, 임직원 세분
- 지속가능경영보고·프레임워크·인증 플래그
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "040_company_info_disclosure_cols"
down_revision = "039_ingest_state_list_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_info", sa.Column("board_chairman_name", sa.Text(), nullable=True))
    op.add_column("company_info", sa.Column("board_total_members", sa.Integer(), nullable=True))
    op.add_column("company_info", sa.Column("board_independent_members", sa.Integer(), nullable=True))
    op.add_column("company_info", sa.Column("board_female_members", sa.Integer(), nullable=True))
    op.add_column("company_info", sa.Column("audit_committee_chairman", sa.Text(), nullable=True))
    op.add_column(
        "company_info",
        sa.Column("esg_committee_exists", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.add_column("company_info", sa.Column("esg_committee_chairman", sa.Text(), nullable=True))
    op.add_column("company_info", sa.Column("cfo_name", sa.Text(), nullable=True))
    op.add_column("company_info", sa.Column("cso_name", sa.Text(), nullable=True))

    op.add_column("company_info", sa.Column("fiscal_year_end", sa.String(length=5), nullable=True))
    op.add_column("company_info", sa.Column("stock_code", sa.String(length=20), nullable=True))
    op.add_column("company_info", sa.Column("listing_market", sa.String(length=20), nullable=True))
    op.add_column("company_info", sa.Column("total_revenue_krw", sa.BigInteger(), nullable=True))
    op.add_column("company_info", sa.Column("total_assets_krw", sa.BigInteger(), nullable=True))
    op.add_column("company_info", sa.Column("headquarters_address", sa.Text(), nullable=True))
    op.add_column("company_info", sa.Column("headquarters_city", sa.Text(), nullable=True))
    op.add_column("company_info", sa.Column("female_employees", sa.Integer(), nullable=True))
    op.add_column("company_info", sa.Column("female_ratio_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("company_info", sa.Column("permanent_employees", sa.Integer(), nullable=True))
    op.add_column("company_info", sa.Column("contract_employees", sa.Integer(), nullable=True))

    op.add_column(
        "company_info",
        sa.Column(
            "sustainability_report_published",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
        ),
    )
    op.add_column("company_info", sa.Column("sustainability_report_year", sa.Integer(), nullable=True))
    op.add_column("company_info", sa.Column("gri_standards_version", sa.String(length=50), nullable=True))
    op.add_column(
        "company_info",
        sa.Column("tcfd_aligned", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.add_column(
        "company_info",
        sa.Column("cdp_participant", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.add_column(
        "company_info",
        sa.Column("iso14001_certified", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.add_column(
        "company_info",
        sa.Column("iso45001_certified", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("company_info", "iso45001_certified")
    op.drop_column("company_info", "iso14001_certified")
    op.drop_column("company_info", "cdp_participant")
    op.drop_column("company_info", "tcfd_aligned")
    op.drop_column("company_info", "gri_standards_version")
    op.drop_column("company_info", "sustainability_report_year")
    op.drop_column("company_info", "sustainability_report_published")
    op.drop_column("company_info", "contract_employees")
    op.drop_column("company_info", "permanent_employees")
    op.drop_column("company_info", "female_ratio_percent")
    op.drop_column("company_info", "female_employees")
    op.drop_column("company_info", "headquarters_city")
    op.drop_column("company_info", "headquarters_address")
    op.drop_column("company_info", "total_assets_krw")
    op.drop_column("company_info", "total_revenue_krw")
    op.drop_column("company_info", "listing_market")
    op.drop_column("company_info", "stock_code")
    op.drop_column("company_info", "fiscal_year_end")
    op.drop_column("company_info", "cso_name")
    op.drop_column("company_info", "cfo_name")
    op.drop_column("company_info", "esg_committee_chairman")
    op.drop_column("company_info", "esg_committee_exists")
    op.drop_column("company_info", "audit_committee_chairman")
    op.drop_column("company_info", "board_female_members")
    op.drop_column("company_info", "board_independent_members")
    op.drop_column("company_info", "board_total_members")
    op.drop_column("company_info", "board_chairman_name")

"""add_back_mdg_and_ghg_raw_category

Revision ID: 7f4d9d2a8c11
Revises: 2dde0dc639ba
Create Date: 2026-03-31 23:40:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "7f4d9d2a8c11"
down_revision = "2dde0dc639ba"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if not insp.has_table("staging_mdg_data"):
        op.create_table(
            "staging_mdg_data",
            sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
            sa.Column("company_id", sa.UUID(), nullable=False),
            sa.Column("source_file_name", sa.Text(), nullable=True),
            sa.Column("ghg_raw_category", sa.Text(), nullable=True),
            sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("import_status", sa.Text(), server_default=sa.text("'pending'::text"), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id", name=op.f("staging_mdg_data_pkey")),
        )
        op.create_index(op.f("idx_staging_mdg_status"), "staging_mdg_data", ["company_id", "import_status"], unique=False)
        op.create_index(op.f("idx_staging_mdg_imported"), "staging_mdg_data", ["imported_at"], unique=False)

    for table_name in (
        "staging_erp_data",
        "staging_plm_data",
        "staging_ehs_data",
        "staging_ems_data",
        "staging_srm_data",
        "staging_hr_data",
    ):
        if not insp.has_table(table_name):
            continue
        cols = {c["name"] for c in insp.get_columns(table_name)}
        if "ghg_raw_category" not in cols:
            op.add_column(table_name, sa.Column("ghg_raw_category", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    for table_name in (
        "staging_erp_data",
        "staging_plm_data",
        "staging_ehs_data",
        "staging_ems_data",
        "staging_srm_data",
        "staging_hr_data",
    ):
        if not insp.has_table(table_name):
            continue
        cols = {c["name"] for c in insp.get_columns(table_name)}
        if "ghg_raw_category" in cols:
            op.drop_column(table_name, "ghg_raw_category")

    if insp.has_table("staging_mdg_data"):
        op.drop_index(op.f("idx_staging_mdg_status"), table_name="staging_mdg_data")
        op.drop_index(op.f("idx_staging_mdg_imported"), table_name="staging_mdg_data")
        op.drop_table("staging_mdg_data")
